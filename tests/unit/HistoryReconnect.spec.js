import state from '@/libs/state';

describe('buffer history reconnect state', () => {
    it('clears stale history flags when the network starts connecting', () => {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'disconnected';

        const buffer = appState.addBuffer(network.id, '#test');
        buffer.flags.is_requesting_chathistory = true;
        buffer.flags.chathistory_available = false;
        buffer.chathistory_request_count = 3;

        appState.$emit('network.connecting', { network });

        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.chathistory_request_count).toBe(0);
    });

    it('resets history state on an irc-framework auto-reconnect', () => {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'disconnected';

        const buffer = appState.addBuffer(network.id, '#test');
        buffer.flags.is_requesting_chathistory = true;
        buffer.flags.chathistory_available = false;
        buffer.flags.names_received = true;
        buffer.chathistory_request_count = 3;

        network.ircClient.emit('connecting');

        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.flags.names_received).toBe(false);
        expect(buffer.chathistory_request_count).toBe(0);
    });
});
