'kiwi public';

import Irc from 'irc-framework';
import * as TextFormatting from '@/helpers/TextFormatting';

/**
 * Handlers for specialized IRCv3 BATCH types.
 * Each handler returns an array of synthetic IrcMessage-like objects.
 */

export function handleNetsplitBatch(network, client, batch) {
    return collapseTraffic(network, client, batch, 'netsplit_summary');
}

export function handleNetjoinBatch(network, client, batch) {
    return collapseTraffic(network, client, batch, 'netjoin_summary');
}

export function handleMultilineBatch(network, client, batch) {
    const messages = batch.commands.filter((c) => (
        c.command === 'PRIVMSG' || c.command === 'NOTICE'
    ));

    if (messages.length === 0) {
        return batch.commands;
    }

    let combinedText = '';
    messages.forEach((m, idx) => {
        const text = m.params[m.params.length - 1];
        const isConcat = 'draft/multiline-concat' in m.tags;

        if (isConcat) {
            // SPEC: When this tag is present, the parameter MUST be concatenated
            // to the previous command's parameter.
            combinedText += text;
        } else {
            // New logical line. Add newline if not the first message in the batch.
            if (idx > 0) {
                combinedText += '\n';
            }
            combinedText += text;
        }
    });

    const firstMsg = messages[0];
    const target = firstMsg.params[0];

    // Tags on the BATCH command apply to all messages in the batch.
    const tags = { ...firstMsg.tags, ...batch.tags };

    // Create a synthetic message event
    const syntheticEvent = new Irc.Message(firstMsg.command, target, combinedText);
    syntheticEvent.nick = firstMsg.nick || '';
    syntheticEvent.ident = firstMsg.ident || '';
    syntheticEvent.hostname = firstMsg.hostname || '';
    syntheticEvent.tags = tags;
    syntheticEvent.time = firstMsg.time;

    return [syntheticEvent];
}

export function handleChathistoryBatch(network, client, batch) {
    const target = batch.params[0];

    // Resolve the history promise in the framework
    if (client.chathistory && client.chathistory.batchCallbacks) {
        const event = {
            command: 'BATCH',
            params: [target],
            tags: batch.tags,
            commands: batch.commands,
            is_end: !!batch.tags['draft/chathistory-end'],
        };
        client.chathistory.batchCallbacks.resolve(target, event);
    }

    // Notify Kiwi to clear the message range for this history request
    client.emit('kiwi.chathistory.start', {
        target,
        commands: batch.commands,
    });

    return batch.commands;
}

/**
 * Default handler just returns the constituent commands unchanged.
 */
export function handleDefaultBatch(network, client, batch) {
    return batch.commands;
}

/**
 * Helper to collapse netsplit/netjoin traffic.
 */
function collapseTraffic(network, client, batch, translationKey) {
    const remoteServer = batch.params[0] || 'unknown';
    const localServer = batch.params[1] || network.name;
    const nicks = batch.commands.map((c) => c.nick).filter((n) => !!n);

    if (nicks.length === 0) {
        return batch.commands;
    }

    const messageBody = TextFormatting.t(translationKey, {
        remote: remoteServer,
        local: localServer,
        count: nicks.length,
    });

    // Find all channels involved in this batch to display the summary there too
    const channels = new Set();
    batch.commands.forEach((c) => {
        if (c.params && c.params[0] && network.isChannelName(c.params[0])) {
            channels.add(c.params[0]);
        }
    });

    const results = [];

    // Create summaries
    const summary = new Irc.Message('PRIVMSG', '*', messageBody);
    summary.nick = '';
    summary.type = 'traffic';
    summary.tags = { ...batch.tags };
    summary.is_batch_summary = true;
    results.push(summary);

    channels.forEach((chanName) => {
        const chanSummary = new Irc.Message('PRIVMSG', chanName, messageBody);
        chanSummary.nick = '';
        chanSummary.type = 'traffic';
        chanSummary.tags = { ...batch.tags };
        chanSummary.is_batch_summary = true;
        results.push(chanSummary);
    });

    // Include original commands so they can be processed by user list logic
    return [...results, ...batch.commands];
}

/**
 * Outgoing multiline sender.
 */
export function sendMultiline(network, state, commandName, target, message, tags) {
    const capValue = network.capValue('draft/multiline');
    const capParams = {};
    capValue.split(',').forEach((p) => {
        const [k, v] = p.split('=');
        if (k && v) {
            capParams[k.toLowerCase()] = parseInt(v, 10);
        }
    });

    const maxBytes = capParams['max-bytes'] || 0;
    const maxLines = capParams['max-lines'] || 0;

    const encoder = new TextEncoder();
    const totalBytes = encoder.encode(message).length;

    const logicalLines = message.split(/\r\n|\n|\r/);
    let estimatedLines = 0;
    logicalLines.forEach((line) => {
        // Use a safe limit for individual IRC commands (e.g., 350 bytes)
        estimatedLines += Math.max(1, Math.ceil(encoder.encode(line).length / 350));
    });

    if ((maxBytes > 0 && totalBytes > maxBytes) || (maxLines > 0 && estimatedLines > maxLines)) {
        const buffer = network.bufferByName(target) || network.serverBuffer();
        const errorMsg = TextFormatting.t('multiline_too_large', {
            totalBytes,
            maxBytes,
            estimatedLines,
            maxLines,
        });

        state.addMessage(buffer, {
            time: Date.now(),
            nick: '*',
            message: errorMsg,
            type: 'error',
        });
        return;
    }

    const batchId = Math.random().toString(36).substr(2, 8);
    const client = network.ircClient;

    // Metadata tags like +reply or msgid go on the BATCH command itself
    const batchStart = new client.Message('BATCH', '+' + batchId, 'draft/multiline', target);
    if (tags && Object.keys(tags).length) {
        batchStart.tags = tags;
    }
    client.raw(batchStart);

    logicalLines.forEach((line) => {
        const lineBytes = encoder.encode(line);
        if (lineBytes.length <= 350) {
            // Single chunk line
            const lineTags = { batch: batchId };
            const msg = new client.Message(commandName, target, line);
            msg.tags = lineTags;
            client.raw(msg);
        } else {
            // Chunked line
            let offset = 0;
            let chunkIdx = 0;
            while (offset < line.length) {
                const chunkTags = { batch: batchId };
                if (chunkIdx > 0) {
                    // Subsequent chunks MUST have the tag (look-back)
                    chunkTags['draft/multiline-concat'] = true;
                }

                let chunk = '';
                let chunkBytes = 0;
                while (offset < line.length) {
                    const char = line[offset];
                    const charBytes = encoder.encode(char).length;
                    if (chunkBytes + charBytes > 300) {
                        break;
                    }
                    chunk += char;
                    chunkBytes += charBytes;
                    offset++;
                }

                const msg = new client.Message(commandName, target, chunk);
                msg.tags = chunkTags;
                client.raw(msg);
                chunkIdx++;
            }
        }
    });

    client.raw(`BATCH -${batchId}`);
}
