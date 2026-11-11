'kiwi public';

import * as Misc from '@/helpers/Misc';

export const SEARCH_REQUEST_TIMEOUT_MS = 30000;

/**
 * Adds the draft/search and soju.im/search capabilities to irc-framework.
 */
export default function searchMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
        parsedEvents.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        const effectiveCommand = (command === 'unknown command' && event.command) ?
            event.command.toUpperCase() :
            command.toUpperCase();
        const params = (event && event.params) || [];

        if (effectiveCommand === 'FAIL' &&
            String(params[0] || '').toUpperCase() === 'SEARCH'
        ) {
            client.search.batchCallbacks.resolve({
                error: params[1] || 'UNKNOWN_ERROR',
                reason: params[params.length - 1] || '',
            }, event && event.tags && event.tags.label);
            return;
        }

        next();
    }
}

function escapeTagValue(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\:')
        .replace(/ /g, '\\s')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function attributeTime(value) {
    if (value instanceof Date) {
        return Misc.dateIso(value);
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Misc.dateIso(new Date(value));
    }
    return value;
}

function buildAttributes(options = {}) {
    const attributes = [];
    const add = (key, value) => {
        if (typeof value === 'undefined' || value === null || value === '' ||
            (typeof value === 'number' && value <= 0)
        ) {
            return;
        }
        attributes.push(`${key}=${escapeTagValue(value)}`);
    };

    add('in', options.in);
    add('from', options.from);
    add('after', attributeTime(options.after));
    add('before', attributeTime(options.before));
    add('text', options.text);

    const limit = parseInt(options.limit, 10);
    if (Number.isFinite(limit) && limit > 0) {
        add('limit', Math.min(limit, 100));
    }

    return attributes.join(';');
}

function addFunctionsToClient(client, network) {
    const search = client.search = {};

    search.batchCallbacks = {
        queue: [],
        current: null,
        queueActive: false,
        add(attributes, resolve) {
            const tags = {};
            if (network.hasCap('labeled-response')) {
                tags.label = Misc.generateLabel();
            }

            this.queue.push({
                attributes,
                resolve,
                tags,
                label: tags.label || '',
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

            current.resolve(value);
            this.queueNext();
        },
        resolve(value, label) {
            if (!this.current) {
                return;
            }

            if (label && this.current.label && label !== this.current.label) {
                return;
            }

            this.finishCurrent(value);
        },
        reset(value) {
            const current = this.current;
            if (current && current.timeoutId) {
                clearTimeout(current.timeoutId);
            }
            this.current = null;

            const pending = this.queue;
            this.queue = [];
            this.queueActive = false;
            if (current) {
                current.resolve(value);
            }
            pending.forEach((request) => {
                if (request.timeoutId) {
                    clearTimeout(request.timeoutId);
                }
                request.resolve(value);
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
                    reason: 'Search request timed out',
                });
            }, SEARCH_REQUEST_TIMEOUT_MS);

            const ircMessage = new client.Message('SEARCH', nextRequest.attributes);
            if (Object.keys(nextRequest.tags).length > 0) {
                ircMessage.tags = nextRequest.tags;
            }
            client.raw(ircMessage);
        },
    };

    const resetPendingSearch = () => {
        search.batchCallbacks.reset({
            error: 'disconnected',
            reason: 'Disconnected',
            silent: true,
        });
    };

    client.on('connecting', resetPendingSearch);
    client.on('socket close', resetPendingSearch);
    client.on('close', resetPendingSearch);

    search.isSupported = () => (
        (typeof network.isBouncerController !== 'function' ||
            !network.isBouncerController()) &&
        !!network.searchCap() &&
        network.hasCap('batch') &&
        network.hasCap('message-tags') &&
        network.hasCap('server-time')
    );

    search.run = (options = {}) => new Promise((resolve) => {
        if (!search.isSupported()) {
            resolve({
                error: 'unsupported',
                reason: 'Server history search is unavailable',
            });
            return;
        }

        const attributes = buildAttributes(options);
        if (!attributes) {
            resolve({
                error: 'invalid',
                reason: 'No search parameters were provided',
            });
            return;
        }

        search.batchCallbacks.add(attributes, resolve);
    });
}
