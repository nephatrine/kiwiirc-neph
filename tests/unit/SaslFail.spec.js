import state from '@/libs/state';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
        formatAndT: jest.fn(() => 'Login Failed'),
    };
});

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

describe('SASL failure handling', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the framework client and middleware
        expect(network.ircClient).toBeTruthy();
        network.state = 'connecting';
        network.ircClient.connection.options.sasl_disconnect_on_fail = true;
    });

    it('resets a connecting session so the login form can retry', async() => {
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.sasl_account).toBe('');
        // The framework ends the connection, but its close arrives while
        // we still look connecting and is ignored as stale. Without this
        // reset the login form spins forever.
        expect(network.state).toBe('disconnected');
    });

    it('leaves the session alone when staying connected on failure', async() => {
        network.ircClient.connection.options.sasl_disconnect_on_fail = false;
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.state).toBe('connecting');
    });

    it('leaves connected sessions alone', async() => {
        network.state = 'connected';
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.state).toBe('connected');
    });

    it('appends the title-cased 904 detail to the login error', async() => {
        await emitSaslFailed(network.ircClient, 'challenge proof invalid');
        expect(network.last_error).toBe('Login Failed (Challenge Proof Invalid)');
    });

    it('omits the parenthetical when the server sends no detail', async() => {
        await emitSaslFailed(network.ircClient, undefined);
        expect(network.last_error).toBe('Login Failed');
    });
});
