import state from '@/libs/state';

describe('buffer history reconnect state', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('clears stale history flags when the network starts connecting', () => {
        jest.useFakeTimers();
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

    it('retries a timed-out history request and keeps loading until it succeeds', async() => {
        let attempts = 0;
        const latest = jest.fn(() => {
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
        const { buffer } = makeHistoryBuffer(latest);

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
    });

    it('keeps manual history available after retries are exhausted', async() => {
        const latest = jest.fn(() => Promise.resolve({
            error: 'timeout',
            reason: 'History request timed out',
        }));
        const { buffer } = makeHistoryBuffer(latest);

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
