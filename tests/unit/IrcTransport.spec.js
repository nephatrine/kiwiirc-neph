import WsTransport from 'irc-framework/src/transports/websocket';
import state from '@/libs/state';
import { createChannelConstructor } from '@/libs/ServerConnection';
import { IRC_WEBSOCKET_PROTOCOL } from '@/libs/WebSocketProtocol';

class FakeWebSocket {
    constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.sent = [];
        FakeWebSocket.instances.push(this);
    }

    send(data) {
        this.sent.push(data);
    }

    close() {
        this.closed = true;
    }
}

FakeWebSocket.instances = [];

describe('IRCv3 WebSocket transport', () => {
    let originalWebSocket;

    beforeEach(() => {
        originalWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket;
        FakeWebSocket.instances = [];
    });

    afterEach(() => {
        global.WebSocket = originalWebSocket;
    });

    function connect() {
        const transport = new WsTransport({
            host: 'irc.example.net',
            port: 6697,
            tls: true,
            websocket_protocol: IRC_WEBSOCKET_PROTOCOL,
        });
        transport.connect();
        return transport;
    }

    it('falls back to no subprotocol and writes one line per frame', () => {
        let transport = connect();

        expect(FakeWebSocket.instances[0].protocols)
            .toBe(IRC_WEBSOCKET_PROTOCOL);

        FakeWebSocket.instances[0].onclose({ code: 1006 });

        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(FakeWebSocket.instances[1].protocols).toBeUndefined();

        FakeWebSocket.instances[1].onopen();
        expect(transport.connected).toBe(true);

        FakeWebSocket.instances = [];
        transport = connect();
        FakeWebSocket.instances[0].onopen();
        transport.writeLine('NICK test');

        expect(FakeWebSocket.instances[0].sent).toEqual(['NICK test']);
    });
});

describe('SockJS event replacement', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('uses pagehide instead of the deprecated unload event', () => {
        const addEventListener = jest
            .spyOn(globalThis, 'addEventListener')
            .mockImplementation(() => {});
        let eventUtils;

        jest.isolateModules(() => {
            eventUtils = jest.requireActual('../../build/webpack/sockjs-event');
        });

        expect(addEventListener).toHaveBeenCalledWith(
            'pagehide',
            expect.any(Function),
            false
        );
        expect(addEventListener.mock.calls.some(([type]) => type === 'unload'))
            .toBe(false);

        const callback = jest.fn();
        eventUtils.unloadAdd(callback);

        const pagehideHandler = addEventListener.mock.calls.find(
            ([type]) => type === 'pagehide'
        )[1];
        pagehideHandler();

        expect(callback).toHaveBeenCalled();
    });
});

describe('ServerConnection channel scoping', () => {
    test('scopes channels by gateway address and network id', () => {
        const wrapperA = createChannelConstructor('http://gateway-a.test/', '', 1);
        const wrapperB = createChannelConstructor('http://gateway-b.test/', '', 1);

        const channelA = wrapperA({ host: 'irc.example.com', port: 6667 });
        const channelB = wrapperB({ host: 'irc.example.com', port: 6667 });

        expect(channelA).not.toBe(channelB);

        const addr = 'http://gateway-probe.test/';
        const probeWrapper = createChannelConstructor(addr, '', undefined);
        const networkWrapper = createChannelConstructor(addr, '', 1);

        const probeChannel = probeWrapper({ host: 'irc.example.com', port: 6667 });
        const networkChannel = networkWrapper({ host: 'irc.example.com', port: 6667 });

        expect(probeChannel).not.toBe(networkChannel);
    });

    test('disposing a channel lets a later wrapper create a fresh one', () => {
        const addr = 'http://gateway-dispose.test/';
        const wrapper = createChannelConstructor(addr, '', 1);
        const first = wrapper({ host: 'irc.example.com', port: 6667 });

        first.disposeSocket();
        const second = wrapper({ host: 'irc.example.com', port: 6667 });

        expect(second).not.toBe(first);
    });
});

describe('IrcClient connect guard', () => {
    function makeNetwork() {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        const client = network.ircClient;
        const connect = jest.fn();
        client.connection.connect = connect;
        return {
            appState, network, client, connect,
        };
    }

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

describe('IrcClient socket close', () => {
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
