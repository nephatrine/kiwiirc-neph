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

        // This is sent as 'unknown command', its been structured this way so hopefully it
        // will still work if a fail handler is ever created in irc-fw
        if (event?.command?.toLowerCase() === 'fail' && event.params[0].toLowerCase() === 'chathistory') {
            client.chathistory.batchCallbacks.resolve(event.params[3]);

            if (event.params[1].toLowerCase() === 'invalid_target') {
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
            this.queue.push({
                target,
                type,
                args,
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

            client.raw('CHATHISTORY', nextRequest.type, nextRequest.target, ...nextRequest.args);
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
