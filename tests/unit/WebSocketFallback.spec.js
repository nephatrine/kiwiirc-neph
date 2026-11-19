import WsTransport from 'irc-framework/src/transports/websocket';
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
        let transport = new WsTransport({
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
