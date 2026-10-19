import state from '@/libs/state';
import bouncerMiddleware from '@/libs/BouncerMiddleware';

describe('bouncer-networks capabilities', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
    });

    function emitRawLs(client, params) {
        return new Promise((resolve, reject) => {
            client.raw_middleware.handle(
                ['CAP', { command: 'CAP', params, tags: {} }, '', client],
                // The middleware chain passes the command name as the first
                // callback argument, so only a real Error is a failure.
                (err) => {
                    if (err instanceof Error) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // BouncerProvider attaches the middleware before connecting, so the raw
    // CAP LS lines pass through it during negotiation.
    function attachBouncer() {
        const client = network.ircClient;
        bouncerMiddleware(network)(client, client.raw_middleware, client.parsed_middleware);
        return client;
    }

    it('prefers draft/bouncer-networks over the soju name', () => {
        expect(network.bouncerCap()).toBe('');
        network.enabled_caps = ['soju.im/bouncer-networks'];
        expect(network.bouncerCap()).toBe('soju.im/bouncer-networks');
        network.enabled_caps = ['soju.im/bouncer-networks', 'draft/bouncer-networks'];
        expect(network.bouncerCap()).toBe('draft/bouncer-networks');
    });

    it('folds the draft cap and never the soju name when both are advertised', async() => {
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'draft/bouncer-networks soju.im/bouncer-networks sasl',
        ]);
        expect(client.request_extra_caps).toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks');
    });

    it('folds the soju name when only it is advertised', async() => {
        const client = attachBouncer();
        await emitRawLs(client, ['*', 'LS', 'sasl soju.im/bouncer-networks']);
        expect(client.request_extra_caps).toContain('soju.im/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('draft/bouncer-networks');
    });

    it('upgrades to the draft cap across split ls lines', async() => {
        const client = attachBouncer();
        await emitRawLs(client, ['*', 'LS', '*', 'soju.im/bouncer-networks']);
        expect(client.request_extra_caps).toContain('soju.im/bouncer-networks');

        client.network.cap.requested = ['soju.im/bouncer-networks', 'sasl'];
        await emitRawLs(client, ['*', 'LS', 'draft/bouncer-networks']);
        expect(client.request_extra_caps).toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks');
        expect(client.network.cap.requested).not.toContain('soju.im/bouncer-networks');
    });

    it('leaves the negotiation alone once the cap is enabled', async() => {
        network.enabled_caps = ['draft/bouncer-networks'];
        const client = attachBouncer();
        const before = [...client.request_extra_caps];
        await emitRawLs(client, ['*', 'LS', 'soju.im/bouncer-networks']);
        expect(client.request_extra_caps).toEqual(before);
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks');
    });

    it('only requests the caps a control connection needs', async() => {
        network.is_bnc = true;
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'labeled-response draft/chathistory away-notify draft/persistence ' +
            'draft/metadata-3 draft/webpush soju.im/webpush',
        ]);
        expect(client.request_extra_caps).toContain('echo-message');
        expect(client.request_extra_caps).toContain('batch');
        expect(client.request_extra_caps).toContain('draft/persistence');
        expect(client.request_extra_caps).toContain('draft/webpush');
        expect(client.request_extra_caps).not.toContain('soju.im/webpush');
        expect(client.request_extra_caps).not.toContain('labeled-response');
        expect(client.request_extra_caps).not.toContain('draft/chathistory');
        expect(client.request_extra_caps).not.toContain('away-notify');
        expect(client.request_extra_caps).not.toContain('draft/metadata-3');
    });

    it('keeps labeled-response on a connection bound to a network', async() => {
        network.is_bnc = true;
        network.connection.bncnetid = '1';
        const client = attachBouncer();
        await emitRawLs(client, ['*', 'LS', '*', 'labeled-response soju.im/webpush']);
        expect(client.request_extra_caps).toContain('labeled-response');
        expect(client.request_extra_caps).toContain('soju.im/webpush');
    });
});
