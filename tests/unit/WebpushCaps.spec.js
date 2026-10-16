import state from '@/libs/state';

function emitRawLs(client, params) {
    return new Promise((resolve, reject) => {
        client.raw_middleware.handle(['CAP', { command: 'CAP', params, tags: {} }, '', client], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function webpushReqs(rawSpy) {
    return rawSpy.mock.calls.filter((call) => (
        call[0] === 'CAP' && call[1] === 'REQ' && String(call[2]).includes('webpush')
    ));
}

describe('webpush capabilities', () => {
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

    it('prefers draft/webpush over soju.im/webpush', () => {
        expect(network.webpushCap()).toBe('');
        network.enabled_caps = ['soju.im/webpush'];
        expect(network.webpushCap()).toBe('soju.im/webpush');
        network.enabled_caps = ['soju.im/webpush', 'draft/webpush'];
        expect(network.webpushCap()).toBe('draft/webpush');
    });

    it('folds draft/webpush on the first ls line when both caps share it', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'soju.im/webpush draft/webpush sasl',
        ]);
        expect(network.ircClient.request_extra_caps).toContain('draft/webpush');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);

        await emitRawLs(network.ircClient, ['*', 'LS', 'sasl']);
        expect(network.ircClient.request_extra_caps).toContain('draft/webpush');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('upgrades soju.im/webpush to draft/webpush across split ls lines', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, ['*', 'LS', '*', 'soju.im/webpush']);
        expect(network.ircClient.request_extra_caps).toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);

        network.ircClient.network.cap.requested = ['soju.im/webpush', 'sasl'];
        await emitRawLs(network.ircClient, ['*', 'LS', 'draft/webpush']);
        expect(network.ircClient.request_extra_caps).toContain('draft/webpush');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/webpush');
        expect(network.ircClient.network.cap.requested).not.toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('keeps draft/webpush when it arrives before soju.im/webpush', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, ['*', 'LS', '*', 'draft/webpush']);
        expect(network.ircClient.request_extra_caps).toContain('draft/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);

        await emitRawLs(network.ircClient, ['*', 'LS', 'soju.im/webpush']);
        expect(network.ircClient.request_extra_caps).toContain('draft/webpush');
        expect(network.ircClient.request_extra_caps).not.toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('folds soju.im/webpush into the batched cap req when only it is advertised', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, ['*', 'LS', 'soju.im/webpush']);
        expect(network.ircClient.request_extra_caps).toContain('soju.im/webpush');
        expect(webpushReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('requests only draft/webpush on cap new when both are advertised', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/webpush': '',
                'soju.im/webpush': '',
            },
        });
        expect(requestSpy).toHaveBeenCalledWith('draft/webpush');
        expect(requestSpy).not.toHaveBeenCalledWith('soju.im/webpush');
        requestSpy.mockRestore();
    });

    it('requests soju.im/webpush on cap new when only it is advertised', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: { 'soju.im/webpush': '' },
        });
        expect(requestSpy).toHaveBeenCalledWith('soju.im/webpush');
        requestSpy.mockRestore();
    });

    it('requests no webpush cap on cap new when one is already enabled', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        network.enabled_caps = ['draft/webpush'];
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/webpush': '',
                'soju.im/webpush': '',
            },
        });
        expect(requestSpy).not.toHaveBeenCalledWith('draft/webpush');
        expect(requestSpy).not.toHaveBeenCalledWith('soju.im/webpush');
        requestSpy.mockRestore();
    });
});
