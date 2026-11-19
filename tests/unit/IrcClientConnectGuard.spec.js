import state from '@/libs/state';

function makeNetwork() {
    const appState = state.create();
    const network = appState.addNetwork('TestNetwork', 'TestNick', {
        server: 'irc.example.com',
    });
    const client = network.ircClient;
    const connect = jest.fn();
    client.connection.connect = connect;
    return { appState, network, client, connect };
}

describe('IrcClient connect guard', () => {
    test('guards an in-flight connection and marks state before emitting', () => {
        let { network, client, connect } = makeNetwork();
        network.state = 'connecting';

        client.connect();

        expect(connect).not.toHaveBeenCalled();

        ({ network, client, connect } = makeNetwork());
        network.state = 'disconnected';

        client.connect();

        expect(connect).toHaveBeenCalledTimes(1);

        const context = makeNetwork();
        let seenState = null;
        context.appState.$on('network.connecting', () => {
            seenState = context.network.state;
        });
        context.network.state = 'disconnected';

        context.client.connect();

        expect(seenState).toBe('connecting');
    });

    test('returns to disconnected if the connect call throws', () => {
        const { network, client } = makeNetwork();
        network.state = 'disconnected';
        client.connection.connect.mockImplementation(() => {
            throw new Error('connect failed');
        });

        expect(() => client.connect()).toThrow('connect failed');
        expect(network.state).toBe('disconnected');
    });

    test('aborts a connection attempt that never completes', () => {
        jest.useFakeTimers();
        try {
            const { network, client } = makeNetwork();
            client.emit('connecting');

            expect(network.state).toBe('connecting');
            expect(network.connect_timeout_timer).toBeTruthy();

            jest.advanceTimersByTime(90000);

            expect(network.state).toBe('disconnected');
            expect(network.state_error).toBe('err_timeout');
            expect(network.connect_timeout_timer).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});
