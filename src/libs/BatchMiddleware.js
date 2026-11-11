'kiwi public';

import * as BatchHandlers from './BatchHandlers';

/**
 * Robust IRCv3 BATCH middleware.
 * Handles nested batches, multiple batch IDs, and recursive resolution.
 */

export default function batchMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        // Active batches indexed by ID
        client.active_batches = client.active_batches || new Map();

        const resetBatches = () => {
            client.active_batches.clear();
            if (network.active_outgoing_batches) {
                network.active_outgoing_batches.clear();
            }
        };
        client.on('connecting', resetBatches);
        client.on('close', resetBatches);

        rawEvents.use((command, message, rawLine, clientInstance, next) => {
            if (message.is_batch_handled) {
                next();
                return;
            }
            handleRawEvent(network, command, message, rawLine, clientInstance, next);
        });
    };
}

function handleRawEvent(network, command, message, rawLine, client, next) {
    const batchTag = message.tags.batch;
    const batchIds = batchTag ? batchTag.split(',') : [];

    // 1. Handle BATCH start/end commands
    if (command === 'BATCH') {
        const firstParam = message.params[0] || '';
        const isStart = firstParam.startsWith('+');
        const batchId = firstParam.substring(1);

        if (isStart) {
            const type = message.params[1];
            const params = message.params.slice(2);

            // Track which batches are currently "active" to support nesting
            const parentIds = Array.from(client.active_batches.keys());

            client.active_batches.set(batchId, {
                id: batchId,
                type: type,
                params: params,
                commands: [],
                tags: message.tags,
                parent_ids: parentIds,
            });
        } else {
            // Batch End
            const batch = client.active_batches.get(batchId);
            if (batch) {
                resolveBatch(network, client, batch);
                client.active_batches.delete(batchId);
                network.active_outgoing_batches.delete(batchId);
            }
        }
        // Always "swallow" BATCH commands so irc-framework's flat handler doesn't interfere
        return;
    }

    // 2. Capture constituent commands
    if (batchIds.length > 0) {
        let swallowed = false;
        batchIds.forEach((id) => {
            const batch = client.active_batches.get(id);
            if (batch) {
                batch.commands.push(message);
                swallowed = true;
            }
        });

        // If it belongs to any active batch, we swallow it from the main handler
        // because it will be re-emitted (possibly transformed) when the batch ends.
        if (swallowed) {
            return;
        }
    }

    // 3. Not a batch command or constituent, proceed as normal
    next();
}

function resolveBatch(network, client, batch) {
    const handlerMap = {
        'netsplit': BatchHandlers.handleNetsplitBatch,
        'netjoin': BatchHandlers.handleNetjoinBatch,
        'draft/multiline': BatchHandlers.handleMultilineBatch,
        'chathistory': BatchHandlers.handleChathistoryBatch,
        'search': BatchHandlers.handleSearchBatch,
        'soju.im/search': BatchHandlers.handleSearchBatch,
    };
    const handler = handlerMap[batch.type] || BatchHandlers.handleDefaultBatch;

    // Resolve the batch into one or more synthetic events
    const results = handler(network, client, batch);

    // Chathistory is commonly nested inside a labeled-response batch on
    // bouncers. Preserve the chathistory type and target so the parent batch
    // does not re-dispatch replayed messages as live traffic.
    if (batch.type === 'chathistory') {
        results.forEach((event) => {
            event.historyBatch = {
                type: batch.type,
                id: batch.id,
                params: batch.params,
            };
            const tags = {
                ...(event.tags || {}),
                'kiwi-history': true,
            };
            if (batch.params && batch.params[0]) {
                tags['kiwi-history-target'] = batch.params[0];
            }
            event.tags = tags;
        });
    }

    // Chathistory is commonly nested inside labeled-response on bouncers.
    // Its promise resolves when the inner batch closes, but the parent batch
    // closes on a later line. Dispatch history immediately so callers see the
    // messages when getBufferHistory() resolves, and make sure the parent
    // does not re-dispatch the same commands when it eventually closes.
    if (batch.type === 'chathistory') {
        batch.parent_ids.forEach((pId) => {
            const parent = client.active_batches.get(pId);
            if (parent) {
                parent.commands = parent.commands.filter((cmd) => {
                    const cmdBatchTag = cmd.tags.batch || '';
                    const cmdBatchIds = cmdBatchTag.split(',');
                    return !cmdBatchIds.includes(batch.id);
                });
            }
        });

        dispatchResults(network, client, batch, results);
        return;
    }

    // If this batch has parents, we inject the results into them instead of emitting
    if (batch.parent_ids.length > 0) {
        batch.parent_ids.forEach((pId) => {
            const parent = client.active_batches.get(pId);
            if (parent) {
                // Filtering out the messages that were part of the child batch
                parent.commands = parent.commands.filter((cmd) => {
                    const cmdBatchTag = cmd.tags.batch || '';
                    const cmdBatchIds = cmdBatchTag.split(',');
                    return !cmdBatchIds.includes(batch.id);
                });

                // Add the resolved synthetic events
                parent.commands.push(...results);
            }
        });
    } else {
        dispatchResults(network, client, batch, results);
    }
}

function dispatchResults(network, client, batch, results) {
    // Emit all resulting events directly to the command_handler
    results.forEach((event) => {
        // Mark as handled by our batch system to prevent recursion
        const reEvent = event;
        reEvent.is_batch_handled = true;

        // Only set the batch metadata if it's not a synthetic summary.
        // A nested chathistory batch keeps its own type and target so
        // history handlers can route it correctly.
        if (reEvent.historyBatch) {
            reEvent.batch = reEvent.historyBatch;
            delete reEvent.historyBatch;
        } else if (!reEvent.is_batch_summary) {
            reEvent.batch = {
                type: batch.type,
                id: batch.id,
                params: batch.params,
            };
        }

        // STRIP BATCH TAGS: Framework drops messages with batch tags it hasn't processed.
        // Since we swallowed BATCH commands, we must strip the tags entirely.
        const newTags = { ...reEvent.tags };
        delete newTags.batch;

        // Indelibly mark events replayed from chathistory so the rest of the application
        // can safely isolate them from the active session state.
        if (batch.type === 'chathistory' ||
            (reEvent.batch && reEvent.batch.type === 'chathistory')
        ) {
            newTags['kiwi-history'] = true;
        }

        reEvent.tags = newTags;

        const historyTarget = newTags['kiwi-history-target'];
        const historyBuffer = historyTarget &&
            typeof network.bufferByName === 'function' ?
            network.bufferByName(historyTarget) :
            null;
        if (historyBuffer) {
            historyBuffer.historyBatchActive = true;
        }

        // Re-dispatch to the command_handler to hit Kiwi's main loop
        try {
            client.command_handler.dispatch(reEvent);
        } finally {
            if (historyBuffer) {
                historyBuffer.historyBatchActive = false;
            }
        }
    });

    // IrcCommand keeps only a handful of fields, so a re-dispatched event
    // cannot carry the batch it came from. Announce the close of the batch
    // so handlers can flush whatever they accumulated from it.
    client.emit('kiwi.batch.end', {
        type: batch.type,
        id: batch.id,
        params: batch.params,
    });
}
