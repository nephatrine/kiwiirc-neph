'kiwi public';

/** @module */

/**
 * Adds the +typing IRCv3 spec to irc-framework
 */
export default function typingMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
        rawEvents.use(theMiddleware);
    };

    function theMiddleware(command, message, rawLine, client, next) {
        if (
            !(command === 'TAGMSG' && message.tags['+typing']) &&
            !(command === 'PRIVMSG' && message.nick)
        ) {
            next();
            return;
        }

        // If this message is from chathistory playback, ignore it
        if (message.tags.batch) {
            const batchId = message.tags.batch;
            const batch = client.active_batches && client.active_batches.get(batchId);
            if (batch && batch.type === 'chathistory') {
                next();
                return;
            }
        }

        // If echo-message is enabled, ignore echoes of our own typing status
        if (
            network.hasCap('echo-message') &&
            message.nick &&
            client.caseCompare(message.nick, client.user.nick)
        ) {
            next();
            return;
        }

        // if we are params[0] then the target is the sender (direct message)
        let target = client.caseCompare(message.params[0], client.user.nick) ?
            message.nick :
            message.params[0];

        // if its a privmsg without typing tag emit done
        let status = message.tags['+typing'] || 'done';

        client.emit('typing', {
            target: target,
            nick: message.nick,
            ident: message.ident,
            hostname: message.hostname,
            status: status,
        });

        next();
    }
}

function addFunctionsToClient(client, network) {
    let typing = client.typing = {};
    let activeTyping = Object.create(null);

    function typingKey(target) {
        return typeof client.caseLower === 'function' ?
            client.caseLower(target) :
            String(target).toLowerCase();
    }

    function isEnabled() {
        return network.supportsTag('+typing');
    }

    typing.start = function start(target) {
        if (!isEnabled()) {
            return;
        }

        const key = typingKey(target);
        let lastSentStatus = activeTyping[key];
        if (lastSentStatus && lastSentStatus > Date.now() - 3000) {
            return;
        }

        activeTyping[key] = Date.now();

        let message = new client.Message('TAGMSG', target);
        message.tags['+typing'] = 'active';
        client.raw(message);
    };

    typing.pause = function pause(target) {
        if (!isEnabled()) {
            return;
        }

        if (!activeTyping[typingKey(target)]) {
            // Did not start typing so cannot pause
            return;
        }

        let message = new client.Message('TAGMSG', target);
        message.tags['+typing'] = 'paused';
        client.raw(message);
    };

    typing.stop = function stop(target, sendStop) {
        if (!isEnabled()) {
            return;
        }

        if (!activeTyping[typingKey(target)]) {
            // Did not start typing so cannot stop
            return;
        }

        delete activeTyping[typingKey(target)];

        if (!sendStop) {
            // Stop was called after a message was sent,
            // only a cleanup of activeTyping is needed
            return;
        }

        let message = new client.Message('TAGMSG', target);
        message.tags['+typing'] = 'done';
        client.raw(message);
    };
}
