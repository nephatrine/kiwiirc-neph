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
