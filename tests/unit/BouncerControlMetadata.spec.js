import state from '@/libs/state';
import metadataMiddleware from '@/libs/MetadataMiddleware';

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

function emitRawLs(clientImpl, params) {
    return new Promise((resolve, reject) => {
        clientImpl.raw_middleware.handle(['CAP', { command: 'CAP', params, tags: {} }, '', clientImpl], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

describe('bouncer control connection metadata', () => {
    let s;
    let controller;
    let normal;

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

    it('identifies the unbound control connection', () => {
        expect(controller.isBouncerController()).toBe(true);
        expect(normal.isBouncerController()).toBe(false);

        let bound = s.addNetwork('Bound', 'TestNick', {});
        bound.is_bnc = true;
        bound.connection.bncnetid = '5';
        expect(bound.isBouncerController()).toBe(false);
    });

    it('sends no metadata when the control connection reports connected', () => {
        let { client, rawEvents, parsedEvents } = makeClient();
        metadataMiddleware(controller)(client, rawEvents, parsedEvents);

        client.emit('connected');

        expect(metadataCommands(client)).toHaveLength(0);
        expect(metadataCapReqs(client)).toHaveLength(0);
    });

    it('still requests metadata when a normal network reports connected', () => {
        let { client, rawEvents, parsedEvents } = makeClient();
        metadataMiddleware(normal)(client, rawEvents, parsedEvents);

        client.emit('connected');

        expect(metadataCapReqs(client)).toHaveLength(1);
        expect(metadataCapReqs(client)[0][2]).toBe('draft/metadata-3');
    });

    it('requests no metadata cap on cap new for the control connection', () => {
        let requestSpy = jest.spyOn(controller.ircClient, 'requestCap').mockImplementation(() => {});
        controller.ircClient.emit('cap new', {
            capabilities: { 'draft/metadata-3': '', 'draft/metadata-2': '' },
        });
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-3');
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-2');
        requestSpy.mockRestore();
    });

    it('still requests a metadata cap on cap new for a normal network', () => {
        let requestSpy = jest.spyOn(normal.ircClient, 'requestCap').mockImplementation(() => {});
        normal.ircClient.emit('cap new', {
            capabilities: { 'draft/metadata-3': '', 'draft/metadata-2': '' },
        });
        expect(requestSpy).toHaveBeenCalledWith('draft/metadata-3');
        requestSpy.mockRestore();
    });

    it('does not fold a metadata cap for the control connection', async() => {
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
    });

    it('still folds a metadata cap for a normal network', async() => {
        let rawSpy = jest.spyOn(normal.ircClient, 'raw').mockImplementation(() => {});
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
