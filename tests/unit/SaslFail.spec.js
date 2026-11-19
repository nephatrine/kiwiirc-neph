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
