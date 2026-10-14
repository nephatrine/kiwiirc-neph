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
    return client.raw.mock.calls.map((call) => {
        let msg = call[0];
        return {
            command: msg.command,
            params: msg.params,
        };
    }).filter((cmd) => cmd.command === 'METADATA');
}

describe('metadata capabilities', () => {
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

    it('prefers draft/metadata-3 over draft/metadata-2', () => {
        expect(network.metadataCap()).toBe('');
        network.enabled_caps = ['draft/metadata-2'];
        expect(network.metadataCap()).toBe('draft/metadata-2');
        network.enabled_caps = ['draft/metadata-2', 'draft/metadata-3'];
        expect(network.metadataCap()).toBe('draft/metadata-3');
    });

    it('defaults maxKeyBytes to 64', () => {
        expect(network.metadata_limits.maxKeyBytes).toBe(64);
    });

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

    function metadataReqs(rawSpy) {
        return rawSpy.mock.calls.filter((call) => (
            call[0] === 'CAP' && call[1] === 'REQ' && String(call[2]).includes('metadata')
        ));
    }

    it('folds metadata-3 on the first ls line when both caps share it', async() => {
        // Real-server layout: both metadata caps arrive on the `LS *` line,
        // the final line carries neither. The fold must happen on line one,
        // since irc-framework accumulates its REQ per line.
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, [
            '*',
            'LS',
            '*',
            'draft/metadata-2=before-connect draft/metadata-3=before-connect sasl',
        ]);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-3');
        expect(network.ircClient.request_extra_caps).not.toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);

        await emitRawLs(network.ircClient, ['*', 'LS', 'draft/persistence sasl']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-3');
        expect(network.ircClient.request_extra_caps).not.toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('upgrades metadata-2 to metadata-3 across split ls lines', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, ['*', 'LS', '*', 'draft/metadata-2']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);

        network.ircClient.network.cap.requested = ['draft/metadata-2', 'sasl'];
        await emitRawLs(network.ircClient, ['*', 'LS', 'draft/metadata-3']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-3');
        expect(network.ircClient.request_extra_caps).not.toContain('draft/metadata-2');
        expect(network.ircClient.network.cap.requested).not.toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('keeps metadata-3 when it arrives before metadata-2', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        await emitRawLs(network.ircClient, ['*', 'LS', '*', 'draft/metadata-3']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-3');
        expect(metadataReqs(rawSpy)).toHaveLength(0);

        await emitRawLs(network.ircClient, ['*', 'LS', 'draft/metadata-2']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-3');
        expect(network.ircClient.request_extra_caps).not.toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('folds draft/metadata-2 into the batched cap req when only it is advertised', async() => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.ircClient.emit('cap ls', {
            capabilities: { 'draft/metadata-2': '' },
        });
        await emitRawLs(network.ircClient, ['*', 'LS', 'draft/metadata-2']);
        expect(network.ircClient.request_extra_caps).toContain('draft/metadata-2');
        expect(metadataReqs(rawSpy)).toHaveLength(0);
        rawSpy.mockRestore();
    });

    it('clears enabled caps when reconnecting', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        network.enabled_caps = ['draft/metadata-3', 'server-time'];
        network.ircClient.emit('connecting');
        expect(network.enabled_caps).toEqual([]);
    });

    it('requests only draft/metadata-3 on cap new when both are advertised', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/metadata-3': '',
                'draft/metadata-2': '',
            },
        });
        expect(requestSpy).toHaveBeenCalledWith('draft/metadata-3');
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-2');
        requestSpy.mockRestore();
    });

    it('requests draft/metadata-2 on cap new when only it is advertised', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: { 'draft/metadata-2': '' },
        });
        expect(requestSpy).toHaveBeenCalledWith('draft/metadata-2');
        requestSpy.mockRestore();
    });

    it('requests no metadata cap on cap new when one is already enabled', () => {
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
        network.enabled_caps = ['draft/metadata-3'];
        const requestSpy = jest.spyOn(network.ircClient, 'requestCap').mockImplementation(() => {});
        network.ircClient.emit('cap new', {
            capabilities: {
                'draft/metadata-3': '',
                'draft/metadata-2': '',
            },
        });
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-3');
        expect(requestSpy).not.toHaveBeenCalledWith('draft/metadata-2');
        requestSpy.mockRestore();
    });

    it('subscribes but does not GET on join with draft/metadata-3', () => {
        let { client, rawEvents, parsedEvents } = makeClient();
        network.enabled_caps = ['draft/metadata-3'];
        metadataMiddleware(network)(client, rawEvents, parsedEvents);
        client.emit('join', { nick: 'TestNick', channel: '#chan' });

        let commands = metadataCommands(client);
        let subcommands = commands.map((cmd) => cmd.params[1]);
        expect(subcommands).toContain('SUB');
        expect(subcommands).not.toContain('GET');
    });

    it('subscribes and GETs on join with draft/metadata-2', () => {
        let { client, rawEvents, parsedEvents } = makeClient();
        network.enabled_caps = ['draft/metadata-2'];
        metadataMiddleware(network)(client, rawEvents, parsedEvents);
        client.emit('join', { nick: 'TestNick', channel: '#chan' });

        let commands = metadataCommands(client);
        let subcommands = commands.map((cmd) => cmd.params[1]);
        expect(subcommands).toContain('SUB');
        expect(subcommands).toContain('GET');
    });

    it('sends no metadata before registration completes', () => {
        let { client, rawEvents, parsedEvents } = makeClient();
        network.enabled_caps = ['draft/metadata-3'];
        metadataMiddleware(network)(client, rawEvents, parsedEvents);

        client.emit('cap ack');
        expect(metadataCommands(client)).toHaveLength(0);

        client.emit('connected');
        let subcommands = metadataCommands(client).map((cmd) => cmd.params[1]);
        expect(subcommands).toContain('SUB');
        expect(subcommands).toContain('GET');
    });

    it('retries with SYNC after a 775 rate limit delay', () => {
        let { client, rawEvents, parsedEvents, getParsed } = makeClient();
        network.enabled_caps = ['draft/metadata-3'];
        metadataMiddleware(network)(client, rawEvents, parsedEvents);

        getParsed()('775', { command: '775', params: ['TestNick', '30', '#chan', 'SUB'] }, client, () => {});
        expect(metadataCommands(client)).toHaveLength(0);

        jest.advanceTimersByTime(30000);
        let commands = metadataCommands(client);
        expect(commands).toHaveLength(1);
        expect(commands[0].params[1]).toBe('SYNC');
    });
});
