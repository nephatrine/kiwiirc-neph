import EventEmitter from 'eventemitter3';
import saslMiddleware from '@/libs/SaslMiddleware';

function createClient() {
    const client = new EventEmitter();
    client.options = {
        sasl_mechanism: 'SCRAM-SHA-256',
        account: { account: 'user', password: 'pass' },
    };
    client.raw = jest.fn();
    client.quit = jest.fn();
    client.sasl_scram = null;
    client.sasl_buffer = '';
    return client;
}

function install(client) {
    let rawHandler = null;
    saslMiddleware({})(client, {
        use: (handler) => {
            rawHandler = handler;
        },
    }, { use: jest.fn() });
    return rawHandler;
}

describe('SaslMiddleware reconnect safety', () => {
    test('ignores a stale SCRAM result after the attempt is reset', async() => {
        let client = createClient();
        let resolveFirst;
        let scram = {
            state: 'FIRST_SENT',
            handleServerFirst: jest.fn(() => new Promise((resolve) => {
                resolveFirst = resolve;
            })),
        };
        client.sasl_scram = scram;

        let rawHandler = install(client);
        rawHandler('AUTHENTICATE', {
            params: [btoa('server-first')],
        }, '', client, jest.fn());

        client.sasl_scram = null;
        resolveFirst('client-first-response');
        await Promise.resolve();
        await Promise.resolve();

        expect(client.raw).not.toHaveBeenCalled();
        expect(client.quit).not.toHaveBeenCalled();

        client = createClient();
        let rejectFirst;
        scram = {
            state: 'FIRST_SENT',
            handleServerFirst: jest.fn(() => new Promise((resolve, reject) => {
                rejectFirst = reject;
            })),
        };
        client.sasl_scram = scram;

        rawHandler = install(client);
        rawHandler('AUTHENTICATE', {
            params: [btoa('server-first')],
        }, '', client, jest.fn());

        client.sasl_scram = null;
        rejectFirst(new Error('stale'));
        await Promise.resolve();
        await Promise.resolve();

        expect(client.quit).not.toHaveBeenCalled();
        expect(client.raw).not.toHaveBeenCalled();
    });
});
