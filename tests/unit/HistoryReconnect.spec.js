import state from '@/libs/state';

describe('buffer history reconnect state', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    function makeHistoryBuffer(latest) {
        jest.useFakeTimers();
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        const buffer = appState.addBuffer(network.id, '#test');
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest,
        };

        return { appState, network, buffer };
    }

    it('clears stale history flags when the network reconnects', () => {
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
        buffer.active_timeout = setTimeout(() => {}, 10000);

        appState.$emit('network.connecting', { network });

        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.chathistory_request_count).toBe(0);
        expect(buffer.active_timeout).toBeNull();

        const autoState = state.create();
        const autoNetwork = autoState.addNetwork('AutoNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        autoNetwork.state = 'disconnected';

        const autoBuffer = autoState.addBuffer(autoNetwork.id, '#test');
        autoBuffer.flags.is_requesting_chathistory = true;
        autoBuffer.flags.chathistory_available = false;
        autoBuffer.flags.names_received = true;
        autoBuffer.chathistory_request_count = 3;

        autoNetwork.ircClient.emit('connecting');

        expect(autoBuffer.flags.is_requesting_chathistory).toBe(false);
        expect(autoBuffer.flags.chathistory_available).toBe(true);
        expect(autoBuffer.flags.names_received).toBe(false);
        expect(autoBuffer.chathistory_request_count).toBe(0);
    });

    it('retries a timed-out request and keeps manual history after exhaustion', async() => {
        let attempts = 0;
        let latest = jest.fn(() => {
            attempts++;
            if (attempts === 1) {
                return Promise.resolve({
                    error: 'timeout',
                    reason: 'History request timed out',
                });
            }
            return Promise.resolve({
                commands: [{ tags: { msgid: 'new-message' } }],
            });
        });
        let { buffer } = makeHistoryBuffer(latest);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);

        expect(latest).toHaveBeenCalledTimes(1);
        expect(buffer.flags.is_requesting_chathistory).toBe(true);
        expect(buffer.flags.chathistory_available).toBe(true);

        await jest.advanceTimersByTimeAsync(3000);
        expect(latest).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(0);
        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);

        latest = jest.fn(() => Promise.resolve({
            error: 'timeout',
            reason: 'History request timed out',
        }));
        ({ buffer } = makeHistoryBuffer(latest));

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(3000);
        await jest.advanceTimersByTimeAsync(6000);
        await jest.advanceTimersByTimeAsync(12000);
        await jest.advanceTimersByTimeAsync(0);

        expect(latest).toHaveBeenCalledTimes(4);
        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        expect(latest).toHaveBeenCalledTimes(5);
    });

    it('cancels a pending history retry when the network reconnects', async() => {
        const latest = jest.fn(() => Promise.resolve({
            error: 'timeout',
            reason: 'History request timed out',
        }));
        const { appState, network, buffer } = makeHistoryBuffer(latest);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        expect(latest).toHaveBeenCalledTimes(1);
        expect(buffer.chathistory_retry_timeout).not.toBeNull();

        appState.$emit('network.connecting', { network });
        expect(buffer.chathistory_retry_timeout).toBeNull();

        await jest.advanceTimersByTimeAsync(3000);
        expect(latest).toHaveBeenCalledTimes(1);
    });
});
