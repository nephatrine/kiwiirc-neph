import WsTransport from 'irc-framework/src/transports/websocket';
import state from '@/libs/state';
import { createProbeTransport } from '@/libs/ServerProbe';
import { IRC_WEBSOCKET_PROTOCOL } from '@/libs/WebSocketProtocol';

jest.mock('irc-framework/src/transports/websocket');

describe('IRCv3 WebSocket protocol', () => {
    beforeEach(() => {
        WsTransport.mockClear();
    });

    it('configures direct clients and probes with the text subprotocol', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
            port: 6697,
            tls: true,
            direct: true,
        });

        expect(network.ircClient.options.websocket_protocol)
            .toBe(IRC_WEBSOCKET_PROTOCOL);

        createProbeTransport({
            direct: true,
            host: 'irc.example.net',
            port: 6697,
            tls: true,
            path: '/webirc',
        });

        expect(WsTransport).toHaveBeenCalledWith({
            host: 'irc.example.net',
            port: 6697,
            tls: true,
            path: '/webirc',
            websocket_protocol: IRC_WEBSOCKET_PROTOCOL,
        });
    });
});
