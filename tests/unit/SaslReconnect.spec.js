import state from '@/libs/state';

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

describe('sasl account across reconnects', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the client and its middleware
        expect(network.ircClient).toBeTruthy();
        jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function loginAs(account) {
        const client = network.ircClient;
        client.emit('loggedin', { account });
        await emitRawLine(client, '903', [network.nick, account, 'SASL ok']);
    }

    it('sets sasl_account on 900 then 903', async() => {
        await loginAs('ankle');
        expect(network.sasl_account).toBe('ankle');
    });

    it('restores sasl_account on the next connection after a reconnect', async() => {
        await loginAs('ankle');
        expect(network.sasl_account).toBe('ankle');

        // First registration completes
        network.ircClient.emit('registered', { nick: 'TestNick' });

        // Drop and reconnect: account state is cleared for the new attempt
        network.ircClient.emit('connecting');
        expect(network.sasl_account).toBe('');

        // The new connection re-authenticates with the same account
        await loginAs('ankle');
        expect(network.sasl_account).toBe('ankle');
    });
});
