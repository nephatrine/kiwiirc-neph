'kiwi public';

import * as TextFormatting from '@/helpers/TextFormatting';

/**
 * Handlers for specialized IRCv3 BATCH types.
 */

export function handleNetsplit(network, state, event) {
    const isNetsplit = event.type.toLowerCase().indexOf('netsplit') > -1;
    const remoteServer = event.params[0] || 'unknown';
    const localServer = event.params[1] || network.name;
    const nicks = event.commands.map((c) => c.nick).filter((n) => !!n);

    if (nicks.length === 0) {
        return;
    }

    const translationKey = isNetsplit ? 'netsplit_summary' : 'netjoin_summary';
    const messageBody = TextFormatting.t(translationKey, {
        remote: remoteServer,
        local: localServer,
        count: nicks.length,
    });

    // Add message to server buffer
    state.addMessage(network.serverBuffer(), {
        time: Date.now(),
        nick: '',
        message: messageBody,
        type: 'traffic',
    });

    // Also add to any channel buffers where these nicks might be
    const channels = new Set();
    event.commands.forEach((c) => {
        if (c.params && c.params[0] && network.isChannelName(c.params[0])) {
            channels.add(c.params[0]);
        }
    });

    channels.forEach((chanName) => {
        const buffer = network.bufferByName(chanName);
        if (buffer) {
            state.addMessage(buffer, {
                time: Date.now(),
                nick: '',
                message: messageBody,
                type: 'traffic',
            });
        }
    });
}

export function handleMultiline(network, state, event, parsedEventsHandler, client) {
    const messages = event.commands.filter((c) => (
        c.command === 'PRIVMSG' || c.command === 'NOTICE'
    ));
    if (messages.length === 0) {
        return;
    }

    let combinedText = '';
    messages.forEach((m, idx) => {
        const text = m.params[m.params.length - 1];
        const concat = m.tags.hasOwnProperty('draft/multiline-concat');
        combinedText += text;
        // If concat tag exists, it means the line continues in the next message.
        // If it doesn't exist, we add a newline unless it's the last message.
        if (!concat && idx < messages.length - 1) {
            combinedText += '\n';
        }
    });

    const firstMsg = messages[0];
    const target = firstMsg.params[0];

    // Tags on the BATCH command apply to all messages in the batch.
    // Some clients may still put them on the first message, so we merge them.
    const tags = { ...firstMsg.tags, ...event.tags };

    // Create a synthetic message event that matches what irc-framework emits
    const syntheticEvent = {
        from_server: !firstMsg.nick,
        nick: firstMsg.nick || '',
        ident: firstMsg.ident || '',
        hostname: firstMsg.hostname || '',
        target: target,
        group: network.extractTargetGroup(target)?.target_group,
        message: combinedText,
        tags: tags,
        time: tags.time || firstMsg.time || Date.now(),
        account: tags.account || firstMsg.tags?.account || '',
        type: firstMsg.command.toLowerCase(),
        batch: null, // Don't let it be seen as part of a batch again
    };

    // Pass it to our own handler. We use 'message' as the command name
    // to match what Kiwi's main handler expects for cohesive messages.
    parsedEventsHandler('message', syntheticEvent, client, () => {});
}

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
        estimatedLines += Math.max(1, Math.ceil(encoder.encode(line).length / 350));
    });

    const isOverBytes = maxBytes > 0 && totalBytes > maxBytes;
    const isOverLines = maxLines > 0 && estimatedLines > maxLines;

    if (isOverBytes || isOverLines) {
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

    logicalLines.forEach((line, lineIdx) => {
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
            while (offset < line.length) {
                const chunkTags = { batch: batchId };

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

                if (offset < line.length) {
                    // More chunks for this logical line, signal concatenation
                    chunkTags['draft/multiline-concat'] = true;
                }

                const msg = new client.Message(commandName, target, chunk);
                msg.tags = chunkTags;
                client.raw(msg);
            }
        }
    });

    client.raw(`BATCH -${batchId}`);
}
