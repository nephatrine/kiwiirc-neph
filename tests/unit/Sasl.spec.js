import EventEmitter from 'eventemitter3';
import state from '@/libs/state';
import SaslScram from '@/libs/SaslScram';
import saslMiddleware from '@/libs/SaslMiddleware';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
        formatAndT: jest.fn(() => 'Login Failed'),
    };
});

// Mock Web Crypto API for Node environment.
// jsdom already defines a crypto object without the subtle API, so it has to
// be replaced with a property definition rather than assigned to.
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
});

window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

function emitRawLine(client, command, params) {
    return new Promise((resolve, reject) => {
        client.raw_middleware.handle(
            [command, { command, params, tags: {} }, '', client],
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

describe('SaslScram', () => {
    it('generates client-first and client-final messages', async() => {
        const scram = new SaslScram('user', 'password');
        const firstMsg = scram.getClientFirstMessage();
        expect(firstMsg).toMatch(/^n,,n=user,r=[a-zA-Z0-9+/=_-]+$/);

        const clientNonce = scram.nonce;
        const serverNonce = '3rfcNHYJY1ZVvWVs7j';
        const salt = 'QSXCR+Q6sek8bf92';
        const iterations = 4096;
        const serverFirst = `r=${clientNonce}${serverNonce},s=${salt},i=${iterations}`;

        const clientFinal = await scram.handleServerFirst(serverFirst);

        expect(clientFinal).toContain(`c=${btoa('n,,')}`);
        expect(clientFinal).toContain(`r=${clientNonce}${serverNonce}`);
        expect(clientFinal).toMatch(/,p=[a-zA-Z0-9+/=]+$/);
    });

    it('should verify server-final-message', async() => {
        const scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;

        const serverNonce = '3rfcNHYJY1ZVvWVs7j';
        const salt = 'QSXCR+Q6sek8bf92';
        const iterations = 4096;
        const serverFirst = `r=${clientNonce}${serverNonce},s=${salt},i=${iterations}`;

        await scram.handleServerFirst(serverFirst);

        // Compute expected server signature to mock it
        const authMessage = `${scram.clientFirstMessageBare},${scram.serverFirstMessage},` +
            `${scram.clientFinalMessageWithoutProof}`;
        const serverSignature = await scram.computeServerSignature(
            scram.saltedPassword,
            authMessage
        );

        const serverFinal = `v=${serverSignature}`;
        await expect(scram.handleServerFinal(serverFinal)).resolves.not.toThrow();
        expect(scram.state).toBe('COMPLETED');
    });

    it('rejects an invalid nonce or server signature', async() => {
        let scram = new SaslScram('user', 'password');
        await expect(scram.handleServerFirst(
            'r=invalid_nonce,s=QSXCR+Q6sek8bf92,i=4096'
        )).rejects.toThrow('Invalid server nonce');

        scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;
        await scram.handleServerFirst(
            `r=${clientNonce}nonce,s=QSXCR+Q6sek8bf92,i=4096`
        );

        await expect(scram.handleServerFinal('v=invalid_signature'))
            .rejects.toThrow('Invalid server signature');
    });
});

describe('SASL failure handling', () => {
    function makeContext(options = {}) {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the framework client and middleware
        expect(network.ircClient).toBeTruthy();
        network.state = options.state || 'connecting';
        network.ircClient.connection.options.sasl_disconnect_on_fail =
            options.disconnectOnFail !== false;
        return { s, network };
    }

    function emitSaslFailed(client, message) {
        // Same emission point irc-framework uses for a 904 numeric
        client.command_handler.emit('sasl failed', {
            reason: 'fail',
            message,
            nick: 'TestNick',
            time: Date.now(),
            tags: {},
        });
        return new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    it('resets only a connecting session that disconnects on failure', async() => {
        let { network } = makeContext();
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.sasl_account).toBe('');
        // The framework ends the connection, but its close arrives while
        // we still look connecting and is ignored as stale. Without this
        // reset the login form spins forever.
        expect(network.state).toBe('disconnected');

        ({ network } = makeContext({ disconnectOnFail: false }));
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.state).toBe('connecting');

        ({ network } = makeContext({ state: 'connected' }));
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.state).toBe('connected');
    });

    it('appends the title-cased 904 detail to the login error', async() => {
        let { network } = makeContext();
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.last_error).toBe('Login Failed (Challenge Proof Invalid)');

        ({ network } = makeContext());
        await emitSaslFailed(network.ircClient, undefined);
        expect(network.last_error).toBe('Login Failed');
    });
});

describe('sasl account across reconnects', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    function makeNetwork() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the client and its middleware
        expect(network.ircClient).toBeTruthy();
        jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        return { s, network };
    }

    async function loginAs(network, account) {
        const client = network.ircClient;
        client.emit('loggedin', { account });
        await emitRawLine(client, '903', [network.nick, account, 'SASL ok']);
    }

    it('sets sasl_account on 900 then 903, including after registration', async() => {
        let { network } = makeNetwork();
        await loginAs(network, 'ankle');
        expect(network.sasl_account).toBe('ankle');

        ({ network } = makeNetwork());
        const client = network.ircClient;
        await emitRawLine(client, '903', [network.nick, 'SASL ok']);
        expect(network.sasl_account).toBe('');

        client.emit('registered', { nick: 'TestNick' });
        client.emit('loggedin', { account: 'ankle' });

        expect(network.sasl_account).toBe('ankle');
    });

    it('restores sasl_account on the next connection after a reconnect', async() => {
        const { network } = makeNetwork();
        await loginAs(network, 'ankle');
        expect(network.sasl_account).toBe('ankle');

        // First registration completes
        network.ircClient.emit('registered', { nick: 'TestNick' });

        // Drop and reconnect: account state is cleared for the new attempt
        network.ircClient.emit('connecting');
        expect(network.sasl_account).toBe('');

        // The new connection re-authenticates with the same account
        await loginAs(network, 'ankle');
        expect(network.sasl_account).toBe('ankle');
    });
});

describe('SaslMiddleware reconnect safety', () => {
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
