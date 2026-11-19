import state from '@/libs/state';
import bouncerMiddleware from '@/libs/BouncerMiddleware';
import metadataMiddleware from '@/libs/MetadataMiddleware';

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

    it('prefers the notify cap matching the base family', () => {
        network.enabled_caps = [
            'draft/bouncer-networks',
            'draft/bouncer-networks-notify',
        ];
        expect(network.bouncerNotifyCap()).toBe('draft/bouncer-networks-notify');

        network.enabled_caps = [
            'soju.im/bouncer-networks',
            'soju.im/bouncer-networks-notify',
        ];
        expect(network.bouncerNotifyCap()).toBe('soju.im/bouncer-networks-notify');
    });

    it('requests the matching draft base and notify caps together', async() => {
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'draft/bouncer-networks draft/bouncer-networks-notify ' +
                'soju.im/bouncer-networks soju.im/bouncer-networks-notify',
        ]);
        expect(client.request_extra_caps).toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).toContain('draft/bouncer-networks-notify');
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks-notify');
    });

    it('requests the matching soju base and notify caps together', async() => {
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'soju.im/bouncer-networks soju.im/bouncer-networks-notify',
        ]);
        expect(client.request_extra_caps).toContain('soju.im/bouncer-networks');
        expect(client.request_extra_caps).toContain('soju.im/bouncer-networks-notify');
        expect(client.request_extra_caps).not.toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('draft/bouncer-networks-notify');
    });

    it('does not request notify on a bound connection', async() => {
        network.connection.bncnetid = '1';
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'draft/bouncer-networks draft/bouncer-networks-notify',
        ]);
        expect(client.request_extra_caps).toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('draft/bouncer-networks-notify');
    });

    it('does not mix draft and soju notify families', async() => {
        const client = attachBouncer();
        await emitRawLs(client, [
            '*', 'LS', '*',
            'draft/bouncer-networks soju.im/bouncer-networks-notify',
        ]);
        expect(client.request_extra_caps).toContain('draft/bouncer-networks');
        expect(client.request_extra_caps).not.toContain('soju.im/bouncer-networks-notify');
        expect(client.request_extra_caps).not.toContain('draft/bouncer-networks-notify');
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
            'draft/account-registration draft/metadata-3 draft/webpush ' +
            'soju.im/webpush',
        ]);
        expect(client.request_extra_caps).toContain('echo-message');
        expect(client.request_extra_caps).toContain('batch');
        expect(client.request_extra_caps).toContain('draft/persistence');
        expect(client.request_extra_caps).toContain('draft/account-registration');
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

describe('bouncer control connection metadata', () => {
    let s;
    let controller;
    let normal;

    function metadataCommands(client) {
        return client.raw.mock.calls.map((call) => call[0]).filter((msg) => (
            msg && msg.command === 'METADATA'
        ));
    }

    function metadataCapReqs(client) {
        return client.raw.mock.calls.filter((call) => (
            call[0] === 'CAP' && call[1] === 'REQ' && String(call[2]).includes('metadata')
        ));
    }

    function makeClient() {
        let handlers = {};
        let parsed = null;
        let client = {
            user: { nick: 'TestNick' },
            raw: jest.fn(),
            on: jest.fn((event, fn) => {
                handlers[event] = handlers[event] || [];
                handlers[event].push(fn);
            }),
            emit(event, data) {
                (handlers[event] || []).forEach((fn) => fn(data));
            },
        };
        let rawEvents = { use: jest.fn() };
        let parsedEvents = {
            use: jest.fn((fn) => {
                parsed = fn;
            }),
        };
        return { client, rawEvents, parsedEvents, getParsed: () => parsed };
    }

    function emitRawLs(clientImpl, params) {
        return new Promise((resolve, reject) => {
            clientImpl.raw_middleware.handle(
                ['CAP', { command: 'CAP', params, tags: {} }, '', clientImpl],
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

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();

        controller = s.addNetwork('BNC', 'TestNick', {});
        controller.is_bnc = true;
        controller.connection.bncnetid = '';
        // Advertised but not enabled: exactly what the connected fallback
        // and the CAP LS preference both key off.
        controller.cap_values = { 'draft/metadata-3': '' };

        normal = s.addNetwork('Normal', 'TestNick', {});
        normal.cap_values = { 'draft/metadata-3': '' };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('identifies the control connection and skips metadata on connect', () => {
        expect(controller.isBouncerController()).toBe(true);
        expect(normal.isBouncerController()).toBe(false);

        const bound = s.addNetwork('Bound', 'TestNick', {});
        bound.is_bnc = true;
        bound.connection.bncnetid = '5';
        expect(bound.isBouncerController()).toBe(false);

        let { client, rawEvents, parsedEvents } = makeClient();
        metadataMiddleware(controller)(client, rawEvents, parsedEvents);

        client.emit('connected');

        expect(metadataCommands(client)).toHaveLength(0);
        expect(metadataCapReqs(client)).toHaveLength(0);

        ({ client, rawEvents, parsedEvents } = makeClient());
        metadataMiddleware(normal)(client, rawEvents, parsedEvents);

        client.emit('connected');

        expect(metadataCapReqs(client)).toHaveLength(1);
        expect(metadataCapReqs(client)[0][2]).toBe('draft/metadata-3');
    });

    it('requests a metadata cap on cap new only for a normal network', () => {
        let requestSpy = jest.spyOn(controller.ircClient, 'requestCap').mockImplementation(() => {});
        controller.ircClient.emit('cap new', {
            capabilities: { 'draft/metadata-3': '', 'draft/metadata-2': '' },
        });
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-3');
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-2');
        requestSpy.mockRestore();

        requestSpy = jest.spyOn(normal.ircClient, 'requestCap').mockImplementation(() => {});
        normal.ircClient.emit('cap new', {
            capabilities: { 'draft/metadata-3': '', 'draft/metadata-2': '' },
        });
        expect(requestSpy).toHaveBeenCalledWith('draft/metadata-3');
        requestSpy.mockRestore();
    });

    it('folds a metadata cap on CAP LS only for a normal network', async() => {
        let rawSpy = jest.spyOn(controller.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(controller.ircClient, [
            '*',
            'LS',
            '*',
            'draft/metadata-2 draft/metadata-3 sasl',
        ]);
        expect(controller.ircClient.request_extra_caps).not.toContain('draft/metadata-3');
        expect(controller.ircClient.request_extra_caps).not.toContain('draft/metadata-2');
        rawSpy.mockRestore();

        rawSpy = jest.spyOn(normal.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(normal.ircClient, [
            '*',
            'LS',
            '*',
            'draft/metadata-2 draft/metadata-3 sasl',
        ]);
        expect(normal.ircClient.request_extra_caps).toContain('draft/metadata-3');
        rawSpy.mockRestore();
    });
});
