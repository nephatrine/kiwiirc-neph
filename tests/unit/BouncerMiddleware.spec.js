import bouncerMiddleware from '@/libs/BouncerMiddleware';

// Minimal client/network doubles. The middleware only needs an event emitter,
// a raw() sink, the SASL credential fields and a network whose ISUPPORT and
// negotiated cap can be inspected.
function makeHarness(options = {}) {
    const listeners = {};
    const client = {
        options: {
            account: options.account || {},
        },
        raw: jest.fn(),
    };

    client.on = jest.fn((event, fn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
    });
    client.once = jest.fn((event, fn) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
    });
    client.emit = (event, payload) => {
        (listeners[event] || []).forEach((fn) => fn(payload));
    };
    client.command_handler = {
        emit: jest.fn((event, payload) => {
            client.emit(event, payload);
        }),
    };

    const network = {
        connection: { bncnetid: options.bncnetid || '' },
        bouncerCap: jest.fn(() => (
            typeof options.cap === 'undefined' ? 'draft/bouncer-networks' : options.cap
        )),
        supports: jest.fn(() => options.netid),
    };

    const rawEvents = { use: jest.fn() };
    const parsedEvents = { use: jest.fn() };

    bouncerMiddleware(network)(client, rawEvents, parsedEvents);

    return {
        client,
        network,
        raw: rawEvents.use.mock.calls[0][0],
        parsed: parsedEvents.use.mock.calls[0][0],
    };
}

function bouncerLine(command, ...params) {
    return ['unknown command', { command, params }];
}

function failLine(...params) {
    return bouncerLine('FAIL', ...params);
}

describe('BouncerMiddleware wire format', () => {
    test('flushes accumulated networks when the listnetworks batch closes', () => {
        const h = makeHarness();
        const next = jest.fn();

        h.parsed(...bouncerLine(
            'BOUNCER',
            'NETWORK',
            '5',
            'name=soju;host=irc.example;port=6697;tls=1;state=connected;' +
                'nickname=me;username=user;realname=Real;error=broken'
        ), h.client, next);

        // Nothing is emitted until the batch closes.
        expect(h.client.command_handler.emit)
            .not.toHaveBeenCalledWith('bouncer networks', expect.anything());

        h.client.emit('kiwi.batch.end', { type: 'soju.im/bouncer-networks', id: 'b1' });

        expect(h.client.command_handler.emit).toHaveBeenCalledWith('bouncer networks', [
            {
                netid: '5',
                name: 'soju',
                state: 'connected',
                host: 'irc.example',
                port: 6697,
                tls: true,
                nickname: 'me',
                username: 'user',
                realname: 'Real',
                pass: '',
                error: 'broken',
            },
        ]);
        expect(next).toHaveBeenCalled();
    });

    test('defaults a TLS network without a port to 6697', () => {
        const h = makeHarness();

        h.parsed(...bouncerLine(
            'BOUNCER',
            'NETWORK',
            '5',
            'name=soju;host=irc.example;tls=1'
        ), h.client, jest.fn());
        h.client.emit('kiwi.batch.end', { type: 'soju.im/bouncer-networks', id: 'b1' });

        expect(h.client.command_handler.emit).toHaveBeenCalledWith(
            'bouncer networks',
            [expect.objectContaining({ port: 6697, tls: true })]
        );
    });

    test('defaults a plain network without a port to 6667', () => {
        const h = makeHarness();

        h.parsed(...bouncerLine(
            'BOUNCER',
            'NETWORK',
            '5',
            'name=soju;host=irc.example;tls=0'
        ), h.client, jest.fn());
        h.client.emit('kiwi.batch.end', { type: 'soju.im/bouncer-networks', id: 'b1' });

        expect(h.client.command_handler.emit).toHaveBeenCalledWith(
            'bouncer networks',
            [expect.objectContaining({ port: 6667, tls: false })]
        );
    });

    test('keeps an explicit port when one is present', () => {
        const h = makeHarness();

        h.parsed(...bouncerLine(
            'BOUNCER',
            'NETWORK',
            '5',
            'name=soju;host=irc.example;port=7000;tls=1'
        ), h.client, jest.fn());
        h.client.emit('kiwi.batch.end', { type: 'soju.im/bouncer-networks', id: 'b1' });

        expect(h.client.command_handler.emit).toHaveBeenCalledWith(
            'bouncer networks',
            [expect.objectContaining({ port: 7000, tls: true })]
        );
    });

    test('clears the accumulation after each batch', () => {
        const h = makeHarness();

        h.parsed(...bouncerLine('BOUNCER', 'NETWORK', '1', 'name=one'), h.client, jest.fn());
        h.client.emit('kiwi.batch.end', { type: 'draft/bouncer-networks', id: 'b1' });
        h.client.emit('kiwi.batch.end', { type: 'draft/bouncer-networks', id: 'b2' });

        expect(h.client.command_handler.emit).toHaveBeenLastCalledWith('bouncer networks', []);
    });

    test('ignores batches that are not bouncer-networks', () => {
        const h = makeHarness();

        h.parsed(...bouncerLine('BOUNCER', 'NETWORK', '1', 'name=one'), h.client, jest.fn());
        h.client.emit('kiwi.batch.end', { type: 'chathistory', id: 'b1' });

        expect(h.client.command_handler.emit)
            .not.toHaveBeenCalledWith('bouncer networks', expect.anything());
    });

    test('resolves addnetwork with the netid the server generated', async() => {
        const h = makeHarness();

        const promise = h.client.bnc.addNetwork({ name: 'soju', host: 'irc.example', nickname: 'me' });
        expect(h.client.raw).toHaveBeenCalledWith(
            'BOUNCER ADDNETWORK name=soju;host=irc.example;nickname=me'
        );

        h.parsed(...bouncerLine('BOUNCER', 'ADDNETWORK', '7'), h.client, jest.fn());

        await expect(promise).resolves.toEqual({ netid: '7' });
    });

    test('rejects a pending request on FAIL BOUNCER and reports the error', async() => {
        const h = makeHarness();

        const promise = h.client.bnc.addNetwork({ host: '', nickname: 'me' });
        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER ADDNETWORK nickname=me');

        h.parsed(...failLine(
            'BOUNCER',
            'NEED_ATTRIBUTE',
            'ADDNETWORK',
            'host',
            'Missing required host attribute'
        ), h.client, jest.fn());

        await expect(promise).rejects.toEqual({
            error: 'NEED_ATTRIBUTE',
            reason: 'Missing required host attribute',
        });
        expect(h.client.command_handler.emit).toHaveBeenCalledWith('bouncer error', expect.objectContaining({
            code: 'NEED_ATTRIBUTE',
            subcommand: 'addnetwork',
            reason: 'Missing required host attribute',
            network: h.network,
        }));
    });

    test('matches subcommands case insensitively', async() => {
        const h = makeHarness();

        const promise = h.client.bnc.saveNetwork('3', { nickname: 'new' });
        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER CHANGENETWORK 3 nickname=new');

        h.parsed(...bouncerLine('BOUNCER', 'changenetwork', '3'), h.client, jest.fn());

        await expect(promise).resolves.toEqual({ netid: '3' });
    });

    test('delnetwork resolves and an empty change sends nothing', async() => {
        const h = makeHarness();

        await expect(h.client.bnc.saveNetwork('3', {})).resolves.toBeUndefined();
        expect(h.client.raw).not.toHaveBeenCalled();

        const promise = h.client.bnc.removeNetwork('3');
        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER DELNETWORK 3');
        h.parsed(...bouncerLine('BOUNCER', 'DELNETWORK', '3'), h.client, jest.fn());

        await expect(promise).resolves.toEqual({ netid: '3' });
    });

    test('getNetworks resolves from the emitted list', async() => {
        const h = makeHarness();

        const promise = h.client.bnc.getNetworks();
        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER LISTNETWORKS');

        h.client.command_handler.emit('bouncer networks', [{ netid: '1' }]);

        await expect(promise).resolves.toEqual([{ netid: '1' }]);
    });

    test('reads the bound netid from the BOUNCER_NETID isupport token', () => {
        const bound = makeHarness({ netid: '5' });
        expect(bound.client.bnc.netId()).toBe('5');
        expect(bound.client.bnc.hasNetwork()).toBe(true);

        const unbound = makeHarness({ netid: true });
        expect(unbound.client.bnc.netId()).toBe('');
        expect(unbound.client.bnc.hasNetwork()).toBe(false);
    });
});

describe('BouncerMiddleware BIND timing', () => {
    test('binds after SASL succeeds when credentials are configured', () => {
        const h = makeHarness({
            account: { account: 'sojuuser', password: 'sojupass' },
            bncnetid: '5',
        });
        const next = jest.fn();

        h.raw('CAP', { params: ['*', 'LS', 'soju.im/bouncer-networks sasl'] }, '', h.client, next);
        expect(h.client.raw).not.toHaveBeenCalledWith(
            expect.stringContaining('BOUNCER BIND')
        );

        h.raw('903', { params: ['', 'SASL authentication successful'] }, '', h.client, next);
        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER BIND 5');
        expect(h.client.raw).toHaveBeenCalledTimes(1);

        // 900 follows 903 for a logged in account and must not bind twice.
        h.raw('900', { params: ['me!u@h', 'me', 'u', 'h', 'account'] }, '', h.client, next);
        expect(h.client.raw).toHaveBeenCalledTimes(1);
    });

    test('binds on the CAP ACK line when SASL is not configured', () => {
        const h = makeHarness({ bncnetid: '9' });

        h.raw('CAP', { params: ['*', 'ACK', 'soju.im/bouncer-networks'] }, '', h.client, jest.fn());

        expect(h.client.raw).toHaveBeenCalledWith('BOUNCER BIND 9');
    });

    test('allows a fresh bind on a new registration', () => {
        const h = makeHarness({
            account: { account: 'sojuuser', password: 'sojupass' },
            bncnetid: '5',
        });

        h.raw('CAP', { params: ['*', 'LS', 'soju.im/bouncer-networks'] }, '', h.client, jest.fn());
        h.raw('903', { params: [] }, '', h.client, jest.fn());
        expect(h.client.raw).toHaveBeenCalledTimes(1);

        // Reconnect: a new CAP LS resets the guard.
        h.raw('CAP', { params: ['*', 'LS', 'soju.im/bouncer-networks'] }, '', h.client, jest.fn());
        h.raw('903', { params: [] }, '', h.client, jest.fn());
        expect(h.client.raw).toHaveBeenCalledTimes(2);
    });

    test('does not bind without a netid or without the cap', () => {
        const noNetid = makeHarness({
            account: { account: 'sojuuser', password: 'sojupass' },
        });
        noNetid.raw('903', { params: [] }, '', noNetid.client, jest.fn());
        expect(noNetid.client.raw).not.toHaveBeenCalled();

        const noCap = makeHarness({
            account: { account: 'sojuuser', password: 'sojupass' },
            bncnetid: '5',
            cap: '',
        });
        noCap.raw('903', { params: [] }, '', noCap.client, jest.fn());
        expect(noCap.client.raw).not.toHaveBeenCalled();
    });
});

describe('BouncerMiddleware pass through', () => {
    test('hands unrelated lines on untouched', () => {
        const h = makeHarness();
        const next = jest.fn();

        h.raw('PRIVMSG', { params: ['#chan', 'hi'] }, '', h.client, next);
        h.parsed('PRIVMSG', { params: ['#chan', 'hi'] }, h.client, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(h.client.raw).not.toHaveBeenCalled();
        expect(h.client.command_handler.emit).not.toHaveBeenCalled();
    });

    test('tolerates a middleware built without a network', () => {
        const client = {
            options: {},
            raw: jest.fn(),
            on: jest.fn(),
        };
        const rawEvents = { use: jest.fn() };
        const parsedEvents = { use: jest.fn() };
        bouncerMiddleware()(client, rawEvents, parsedEvents);

        const raw = rawEvents.use.mock.calls[0][0];
        const next = jest.fn();

        expect(() => {
            raw('CAP', { params: ['*', 'LS', 'draft/bouncer-networks'] }, '', client, next);
            raw('903', { params: [] }, '', client, next);
        }).not.toThrow();
        expect(client.raw).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(2);
        expect(client.bnc.hasNetwork()).toBe(false);
    });
});
