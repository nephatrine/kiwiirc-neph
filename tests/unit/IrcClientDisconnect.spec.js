import state from '@/libs/state';

describe('IrcClient socket close', () => {
    let s;
    let network;
    let client;
    let channel;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        network.enabled_caps = [];
        client = network.ircClient;
        channel = s.addBuffer(network.id, '#test');
        channel.joined = true;
        channel.flags.reconnect_known = false;
    });

    it('marks the network disconnected when the live socket closes', () => {
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);
    });

    it('runs the same cleanup after a manual quit', () => {
        client.connection.requested_disconnect = true;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);
    });

    it('ignores a replacement close while still connecting', () => {
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('connecting');
        expect(channel.joined).toBe(true);
    });

    it('marks a direct websocket disconnected when a connecting attempt closes', () => {
        network.connection.direct = true;
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('socket close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
        expect(channel.flags.reconnect_known).toBe(true);
    });

    it('marks the network disconnected when the framework gives up while connecting', () => {
        network.state = 'connecting';
        client.connection.requested_disconnect = false;

        client.emit('close');

        expect(network.state).toBe('disconnected');
        expect(channel.joined).toBe(false);
    });

    it('cancels a direct websocket handshake', () => {
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
