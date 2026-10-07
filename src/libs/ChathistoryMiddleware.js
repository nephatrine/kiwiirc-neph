'kiwi public';

/** @module */

import * as Misc from '@/helpers/Misc';

/**
 * Adds the CHATHISTORY IRCv3 spec to irc-framework
 */
export default function chathistoryMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
        parsedEvents.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        if (command.toLowerCase() === 'batch end chathistory' && client.chathistory) {
            let target = event.params[0];
            client.chathistory.batchCallbacks.resolve(target, event);
        }

        // Standard Replies spec: FAIL CHATHISTORY <error> <target> ... :<description>
        if (event?.command?.toLowerCase() === 'fail' && event.params[0].toLowerCase() === 'chathistory') {
            const error = event.params[1];
            const target = event.params[2];
            const reason = event.params[event.params.length - 1];

            // Resolve the callback with an error object
            client.chathistory.batchCallbacks.resolve(target, { error, reason });

            if (error.toLowerCase() === 'invalid_target') {
                // suppress invalid target errors
                next();
                return;
            }
        }

        next();
    }
}

function addFunctionsToClient(client, network) {
    const history = client.chathistory = {};

    history.batchCallbacks = {
        callbacks: Object.create(null),
        queue: [],
        queueActive: false,
        add(cb, target, type, ...args) {
            this.callbacks[target.toUpperCase()] = this.callbacks[target.toUpperCase()] || [];
            this.callbacks[target.toUpperCase()].push(cb);

            let tags = {};
            if (network.hasCap('labeled-response')) {
                tags.label = Misc.generateLabel();
            }

            this.queue.push({
                target,
                type,
                args,
                tags,
            });
            if (!this.queueActive) {
                this.queueNext();
            }
        },
        resolve(target, value) {
            const targetCallbacks = this.callbacks[target.toUpperCase()] || [];
            const cb = targetCallbacks.shift();

            if (!targetCallbacks.length) {
                // last callback, cleanup callbacks
                delete this.callbacks[target.toUpperCase()];
            }

            if (cb) {
                cb(value);
            }

            this.queueNext();
        },
        queueNext() {
            this.queueActive = true;

            const nextRequest = this.queue.shift();
            if (!nextRequest) {
                this.queueActive = false;
                return;
            }

            const ircMessage = new client.Message('CHATHISTORY', nextRequest.type, nextRequest.target, ...nextRequest.args);
            if (nextRequest.tags && Object.keys(nextRequest.tags).length > 0) {
                ircMessage.tags = nextRequest.tags;
            }

            client.raw(ircMessage);
        },
    };

    // history.isSupported gates the use of the CHATHISTORY command.
    // Spec requires draft/chathistory capability to be negotiated.
    history.isSupported = () => network.hasCap('draft/chathistory');

    history.maxLimit = () => {
        let limit = parseInt(network.supports('CHATHISTORY'), 10);
        return (Number.isNaN(limit) || limit <= 0) ? 50 : limit;
    };

    history.supportedRefTypes = () => {
        let val = network.supports('MSGREFTYPES');
        return val ? val.split(',') : ['msgid', 'timestamp'];
    };

    history.before = (target, dateOrTime) => new Promise((resolve) => {
        if (!history.isSupported()) {
            resolve();
            return;
        }

        let ref = messageReference(dateOrTime);
        if (!ref) {
            resolve();
            return;
        }

        history.batchCallbacks.add(resolve, target, 'BEFORE', ref, history.maxLimit().toString());
    });

    history.after = (target, dateOrTime) => new Promise((resolve) => {
        if (!history.isSupported()) {
            resolve();
            return;
        }

        let ref = messageReference(dateOrTime);
        if (!ref) {
            resolve();
            return;
        }

        history.batchCallbacks.add(resolve, target, 'AFTER', ref, history.maxLimit().toString());
    });

    history.latest = (target, dateOrTime) => new Promise((resolve) => {
        if (!history.isSupported()) {
            resolve();
            return;
        }

        let ref = messageReference(dateOrTime);
        if (!ref) {
            resolve();
            return;
        }

        history.batchCallbacks.add(resolve, target, 'LATEST', ref, history.maxLimit().toString());
    });

    history.around = (target, dateOrTime) => new Promise((resolve) => {
        if (!history.isSupported()) {
            resolve();
            return;
        }

        let ref = messageReference(dateOrTime);
        if (!ref) {
            resolve();
            return;
        }

        history.batchCallbacks.add(resolve, target, 'AROUND', ref, history.maxLimit().toString());
    });

    history.between = (target, fromDateOrTime, toDateOrTime) => new Promise((resolve) => {
        if (!history.isSupported()) {
            resolve();
            return;
        }

        const fromRef = messageReference(fromDateOrTime);
        const toRef = messageReference(toDateOrTime);
        if (!fromRef || !toRef) {
            resolve();
            return;
        }

        history.batchCallbacks.add(resolve, target, 'BETWEEN', fromRef, toRef, history.maxLimit().toString());
    });

    function messageReference(inp) {
        if (inp === '*') {
            return '*';
        }

        let supportedTypes = history.supportedRefTypes();

        if (typeof inp === 'object' && inp instanceof Date) {
            if (!supportedTypes.includes('timestamp')) {
                return null;
            }
            return 'timestamp=' + Misc.dateIso(inp);
        }

        if (typeof inp === 'string' && inp) {
            if (!supportedTypes.includes('msgid')) {
                return null;
            }
            return 'msgid=' + inp;
        }

        return null;
    }
}
