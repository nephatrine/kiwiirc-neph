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
    };
    const handler = handlerMap[batch.type] || BatchHandlers.handleDefaultBatch;

    // Resolve the batch into one or more synthetic events
    const results = handler(network, client, batch);

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
        // Top-level batch: Emit all resulting events directly to the command_handler
        results.forEach((event) => {
            // Mark as handled by our batch system to prevent recursion
            const reEvent = event;
            reEvent.is_batch_handled = true;

            // Only set the batch metadata if it's not a synthetic summary
            if (!reEvent.is_batch_summary) {
                reEvent.batch = {
                    type: batch.type,
                    id: batch.id,
                };
            }

            // STRIP BATCH TAGS: Framework drops messages with batch tags it hasn't processed.
            // Since we swallowed BATCH commands, we must strip the tags entirely.
            const newTags = { ...reEvent.tags };
            delete newTags.batch;

            // Indelibly mark events replayed from chathistory so the rest of the application
            // can safely isolate them from the active session state.
            if (batch.type === 'chathistory') {
                newTags['kiwi-history'] = true;
            }

            reEvent.tags = newTags;

            // Re-dispatch to the command_handler to hit Kiwi's main loop
            client.command_handler.dispatch(reEvent);
        });
    }
}
