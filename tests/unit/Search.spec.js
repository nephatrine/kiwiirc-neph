import EventEmitter from 'eventemitter3';
import state from '@/libs/state';
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

function emitRawLs(client, params) {
    return new Promise((resolve, reject) => {
        client.raw_middleware.handle(
            ['CAP', { command: 'CAP', params, tags: {} }, '', client],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
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

    test('sends one escaped SEARCH, then serializes the queue', async() => {
        const unsupported = install(['soju.im/search', 'batch']);
        expect(unsupported.client.search.isSupported()).toBe(false);

        const { client } = install(SEARCH_CAPS);

        const first = client.search.run({
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

        const second = client.search.run({ text: 'second' });
        expect(client.raw).toHaveBeenCalledTimes(1);

        client.search.batchCallbacks.resolve({
            commands: [{ params: ['#channel', 'hello'] }],
        });
        await expect(first).resolves.toMatchObject({
            commands: [{ params: ['#channel', 'hello'] }],
        });

        expect(client.raw).toHaveBeenCalledTimes(2);
        expect(client.raw.mock.calls[1][0].params[0]).toBe('text=second');

        client.search.batchCallbacks.resolve({ commands: [] });
        await expect(second).resolves.toMatchObject({ commands: [] });
    });

    test('resolves FAIL and socket-close responses for pending searches', async() => {
        let { client, parsedHandler } = install(SEARCH_CAPS);
        let result = client.search.run({ text: 'bad' });
        parsedHandler('FAIL', {
            params: ['SEARCH', 'INVALID_PARAMS', 'context', 'Invalid parameters'],
        }, client, jest.fn());
        await expect(result).resolves.toMatchObject({
            error: 'INVALID_PARAMS',
            reason: 'Invalid parameters',
        });

        ({ client } = install(SEARCH_CAPS));
        result = client.search.run({ text: 'pending' });
        client.emit('socket close');
        await expect(result).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
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

describe('search capabilities', () => {
    let s;
    let network;

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('prefers draft/search for searchCap and cap new', () => {
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});

        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/search': '',
                'soju.im/search': '',
            },
        });

        expect(requestSpy).toHaveBeenCalledWith('draft/search');
        expect(requestSpy).not.toHaveBeenCalledWith('soju.im/search');
        requestSpy.mockRestore();

        expect(network.searchCap()).toBe('');
        network.enabled_caps = ['soju.im/search'];
        expect(network.searchCap()).toBe('soju.im/search');
        network.enabled_caps = ['soju.im/search', 'draft/search'];
        expect(network.searchCap()).toBe('draft/search');
    });

    test('folds one preferred search cap during CAP LS', async() => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'soju.im/search draft/search batch',
        ]);

        expect(network.ircClient.request_extra_caps).toContain('draft/search');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/search');
        expect(network.ircClient.request_extra_caps).toContain('batch');
        rawSpy.mockRestore();
    });

    test('does not request search on a bouncer control connection', async() => {
        network.is_bnc = true;
        network.connection.bncnetid = '';
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'draft/search soju.im/search',
        ]);

        expect(network.ircClient.request_extra_caps).not.toContain('draft/search');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/search');
        rawSpy.mockRestore();
    });
});
