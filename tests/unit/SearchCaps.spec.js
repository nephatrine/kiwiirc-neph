import state from '@/libs/state';

function emitRawLs(client, params) {
    return new Promise((resolve, reject) => {
        client.raw_middleware.handle(
            ['CAP', { command: 'CAP', params, tags: {} }, '', client],
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

describe('search capabilities', () => {
    let s;
    let network;

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('prefers draft/search over soju.im/search', () => {
        expect(network.searchCap()).toBe('');
        network.enabled_caps = ['soju.im/search'];
        expect(network.searchCap()).toBe('soju.im/search');
        network.enabled_caps = ['soju.im/search', 'draft/search'];
        expect(network.searchCap()).toBe('draft/search');
    });

    test('folds one preferred search cap during CAP LS', async() => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'soju.im/search draft/search batch',
        ]);

        expect(network.ircClient.request_extra_caps).toContain('draft/search');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/search');
        expect(network.ircClient.request_extra_caps).toContain('batch');
        rawSpy.mockRestore();
    });

    test('does not request search on a bouncer control connection', async() => {
        network.is_bnc = true;
        network.connection.bncnetid = '';
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'draft/search soju.im/search',
        ]);

        expect(network.ircClient.request_extra_caps).not.toContain('draft/search');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/search');
        rawSpy.mockRestore();
    });

    test('requests only draft/search on cap new when both are advertised', () => {
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});

        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/search': '',
                'soju.im/search': '',
            },
        });

        expect(requestSpy).toHaveBeenCalledWith('draft/search');
        expect(requestSpy).not.toHaveBeenCalledWith('soju.im/search');
        requestSpy.mockRestore();
    });
});
