import EventEmitter from 'eventemitter3';
import searchMiddleware, { SEARCH_REQUEST_TIMEOUT_MS } from '@/libs/SearchMiddleware';
import { handleSearchBatch } from '@/libs/BatchHandlers';

function createClient() {
    const client = new EventEmitter();
    client.raw = jest.fn();
    client.Message = class Message {
        constructor(command, ...params) {
            this.command = command;
            this.params = params;
            this.tags = {};
        }
    };
    return client;
}

function createNetwork(caps) {
    return {
        hasCap(cap) {
            return caps.includes(cap);
        },
        searchCap() {
            if (caps.includes('draft/search')) {
                return 'draft/search';
            }
            if (caps.includes('soju.im/search')) {
                return 'soju.im/search';
            }
            return '';
        },
    };
}

function install(caps) {
    const client = createClient();
    const network = createNetwork(caps);
    let parsedHandler = null;
    const parsedEvents = {
        use(handler) {
            parsedHandler = handler;
        },
    };
    searchMiddleware(network)(client, { use: jest.fn() }, parsedEvents);
    return { client, network, parsedHandler };
}

const SEARCH_CAPS = [
    'soju.im/search',
    'batch',
    'message-tags',
    'server-time',
];

describe('SearchMiddleware', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('is unavailable without the required capabilities', () => {
        const { client } = install(['soju.im/search', 'batch']);

        expect(client.search.isSupported()).toBe(false);
    });

    test('sends one escaped SEARCH command and resolves its result', async() => {
        const { client } = install(SEARCH_CAPS);

        const result = client.search.run({
            in: '#channel',
            text: 'hello world; x',
            limit: 50,
            before: 0,
        });

        expect(client.raw).toHaveBeenCalledTimes(1);
        const message = client.raw.mock.calls[0][0];
        expect(message.command).toBe('SEARCH');
        expect(message.params[0]).toBe(
            'in=#channel;text=hello\\sworld\\:\\sx;limit=50'
        );

        client.search.batchCallbacks.resolve({
            commands: [{ params: ['#channel', 'hello'] }],
        });

        await expect(result).resolves.toMatchObject({
            commands: [{ params: ['#channel', 'hello'] }],
        });
    });

    test('serializes searches and advances after each batch', async() => {
        const { client } = install(SEARCH_CAPS);

        const first = client.search.run({ text: 'first' });
        const second = client.search.run({ text: 'second' });

        expect(client.raw).toHaveBeenCalledTimes(1);
        expect(client.raw.mock.calls[0][0].params[0]).toBe('text=first');

        client.search.batchCallbacks.resolve({ commands: [] });
        await expect(first).resolves.toMatchObject({ commands: [] });

        expect(client.raw).toHaveBeenCalledTimes(2);
        expect(client.raw.mock.calls[1][0].params[0]).toBe('text=second');

        client.search.batchCallbacks.resolve({ commands: [] });
        await expect(second).resolves.toMatchObject({ commands: [] });
    });

    test('resolves a FAIL SEARCH response for the pending search', async() => {
        const { client, parsedHandler } = install(SEARCH_CAPS);

        const result = client.search.run({ text: 'bad' });
        parsedHandler('FAIL', {
            params: ['SEARCH', 'INVALID_PARAMS', 'context', 'Invalid parameters'],
        }, client, jest.fn());

        await expect(result).resolves.toMatchObject({
            error: 'INVALID_PARAMS',
            reason: 'Invalid parameters',
        });
    });

    test('times out a search and leaves the queue usable', async() => {
        jest.useFakeTimers();
        const { client } = install(SEARCH_CAPS);

        const result = client.search.run({ text: 'slow' });
        await jest.advanceTimersByTimeAsync(SEARCH_REQUEST_TIMEOUT_MS);

        await expect(result).resolves.toMatchObject({
            error: 'timeout',
        });
    });

    test('resets pending searches when the socket closes', async() => {
        const { client } = install(SEARCH_CAPS);

        const result = client.search.run({ text: 'pending' });
        client.emit('socket close');

        await expect(result).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });
    });

    test('resolves a search batch without dispatching its messages', async() => {
        const { client } = install(SEARCH_CAPS);
        const result = client.search.run({ text: 'result' });

        const dispatched = handleSearchBatch({}, client, {
            tags: {},
            commands: [{ params: ['#channel', 'hello'] }],
        });

        expect(dispatched).toEqual([]);
        await expect(result).resolves.toMatchObject({
            commands: [{ params: ['#channel', 'hello'] }],
        });
    });
});
