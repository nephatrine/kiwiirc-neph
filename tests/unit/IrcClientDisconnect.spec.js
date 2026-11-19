import state from '@/libs/state';

function makeContext() {
    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {
        server: 'irc.example.com',
        port: 6697,
        tls: true,
    });
    network.state = 'connected';
    network.nick = 'TestNick';
    network.enabled_caps = [];
    const client = network.ircClient;
    const channel = s.addBuffer(network.id, '#test');
    channel.joined = true;
    channel.flags.reconnect_known = false;
    return {
        s, network, client, channel,
    };
}

describe('IrcClient socket close', () => {
    it('marks the network disconnected on close, quit, and direct sockets', () => {
        let { network, client, channel } = makeContext();
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);

        ({ network, client, channel } = makeContext());
        client.connection.requested_disconnect = true;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);

        ({ network, client, channel } = makeContext());
        network.connection.direct = true;
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);
    });

    it('ignores a replacement close while connecting unless the framework gives up', () => {
        let { network, client, channel } = makeContext();
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('connecting');
        expect(channel.joined).toBe(true);

        ({ network, client, channel } = makeContext());
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
    });

    it('cancels a direct websocket handshake', () => {
        const { network, client } = makeContext();
        network.connection.direct = true;
        network.state = 'connecting';
        client.connection.requested_disconnect = false;
        client.connection.transport = {
            close: jest.fn(),
            disposeSocket: jest.fn(),
            socket: {
                close: jest.fn(),
            },
        };

        client.cancelConnect();

        expect(client.connection.requested_disconnect).toBe(true);
        expect(client.connection.transport.socket.close).toHaveBeenCalled();
        expect(client.connection.transport.disposeSocket).toHaveBeenCalled();
        expect(network.state).toBe('disconnected');
    });
});
