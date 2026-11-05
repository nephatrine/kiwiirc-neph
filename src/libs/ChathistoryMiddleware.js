'kiwi public';

/** @module */

import * as Misc from '@/helpers/Misc';

export const HISTORY_REQUEST_TIMEOUT_MS = 15000;

/**
 * Adds the CHATHISTORY IRCv3 spec to irc-framework
 */
export default function chathistoryMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
        parsedEvents.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        const effectiveCommand = (command === 'unknown command' && event.command)
            ? event.command.toUpperCase()
            : command.toUpperCase();

        // Standard Replies spec: FAIL CHATHISTORY <error> <target> ... :<description>
        if (effectiveCommand === 'FAIL' && event.params[0].toUpperCase() === 'CHATHISTORY') {
            const error = event.params[1];
            const target = event.params[2];
            const reason = event.params[event.params.length - 1];

            // Resolve the callback with an error object
            client.chathistory.batchCallbacks.resolve(
                target,
                { error, reason },
                event.tags && event.tags.label
            );

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
        current: null,
        add(cb, target, type, ...args) {
            const targetKey = network.caseUpper(target);
            this.callbacks[targetKey] = this.callbacks[targetKey] || [];
            this.callbacks[targetKey].push(cb);

            let tags = {};
            if (network.hasCap('labeled-response')) {
                tags.label = Misc.generateLabel();
            }

            this.queue.push({
                target,
                targetKey,
                type,
                args,
                tags,
                timeoutId: null,
            });
            if (!this.queueActive) {
                this.queueNext();
            }
        },
        finishCurrent(value) {
            const current = this.current;
            if (!current) {
                return;
            }

            this.current = null;
            if (current.timeoutId) {
                clearTimeout(current.timeoutId);
                current.timeoutId = null;
            }

            const targetCallbacks = this.callbacks[current.targetKey] || [];
            const cb = targetCallbacks.shift();

            if (!targetCallbacks.length) {
                // last callback, cleanup callbacks
                delete this.callbacks[current.targetKey];
            }

            if (cb) {
                cb(value);
            }

            this.queueNext();
        },
        resolve(target, value, label) {
            if (!this.current) {
                return;
            }

            const targetKey = network.caseUpper(target);
            if (this.current.targetKey !== targetKey) {
                // A late response for a request that already timed out must not
                // advance the queue past the request that is in flight now.
                return;
            }

            const currentLabel = this.current.tags && this.current.tags.label;
            if (label && currentLabel && label !== currentLabel) {
                return;
            }

            this.finishCurrent(value);
        },
        reset(value) {
            if (this.current && this.current.timeoutId) {
                clearTimeout(this.current.timeoutId);
            }
            this.current = null;

            const pending = this.callbacks;
            this.callbacks = Object.create(null);
            this.queue = [];
            this.queueActive = false;

            Object.keys(pending).forEach((target) => {
                pending[target].forEach((cb) => cb(value));
            });
        },
        queueNext() {
            this.queueActive = true;

            const nextRequest = this.queue.shift();
            if (!nextRequest) {
                this.queueActive = false;
                return;
            }

            this.current = nextRequest;
            nextRequest.timeoutId = setTimeout(() => {
                if (this.current !== nextRequest) {
                    return;
                }

                this.finishCurrent({
                    error: 'timeout',
                    reason: 'History request timed out',
                });
            }, HISTORY_REQUEST_TIMEOUT_MS);

            const ircMessage = new client.Message('CHATHISTORY', nextRequest.type, nextRequest.target, ...nextRequest.args);
            if (nextRequest.tags && Object.keys(nextRequest.tags).length > 0) {
                ircMessage.tags = nextRequest.tags;
            }

            client.raw(ircMessage);
        },
    };

    const resetPendingHistory = () => {
        history.batchCallbacks.reset({
            error: 'disconnected',
            reason: 'Disconnected',
            silent: true,
        });
    };

    // A socket close abandons any CHATHISTORY batch that was in flight. Resolve
    // those promises and clear the queue so a reconnect starts with a clean
    // request pipeline.
    client.on('connecting', resetPendingHistory);
    client.on('socket close', resetPendingHistory);
    client.on('close', resetPendingHistory);

    // history.isSupported gates the use of the CHATHISTORY command.
    // Spec requires draft/chathistory capability to be negotiated.
    history.isSupported = () => network.hasCap('draft/chathistory');

    history.maxLimit = () => {
        let limit = parseInt(network.supports('CHATHISTORY'), 10);
        let max = (Number.isNaN(limit) || limit <= 0) ? 50 : limit;
        return Math.min(max, 250);
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
