import Vue from 'vue';
import { TextEncoder, TextDecoder } from 'util';
import state from '@/libs/state';

if (!global.TextEncoder) {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}
import metadataMiddleware from '@/libs/MetadataMiddleware';

function makeClient() {
    let handlers = {};
    let parsed = null;
    let client = {
        user: { nick: 'TestNick' },
        raw: jest.fn(),
        // Buffer creation asks whether history can be requested.
        chathistory: { isSupported: () => false },
        who: jest.fn(),
        on: jest.fn((event, fn) => {
            handlers[event] = handlers[event] || [];
            handlers[event].push(fn);
        }),
        emit(event, data) {
            (handlers[event] || []).forEach((fn) => fn(data));
        },
    };
    let rawEvents = { use: jest.fn() };
    let parsedEvents = { use: jest.fn((fn) => { parsed = fn; }) };
    return { client, rawEvents, parsedEvents, getParsed: () => parsed };
}

function metadataCommands(client) {
    return client.raw.mock.calls.map((call) => {
        let msg = call[0];
        return { command: msg.command, params: msg.params };
    }).filter((cmd) => cmd.command === 'METADATA');
}

function setup(options = {}) {
    const ircd = options.ircd || 'soju';
    const maxKeys = options.maxKeys || '32';

    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {});
    network.state = 'connected';
    network.enabled_caps = ['draft/metadata-3'];
    network.cap_values = {
        'draft/metadata-3': 'max-subs=10,max-keys=' + maxKeys + ',max-key-bytes=64,max-value-bytes=4096',
    };
    network.ircd = ircd;

    const { client, rawEvents, parsedEvents, getParsed } = makeClient();
    network.frameworkClient = client;
    metadataMiddleware(network)(client, rawEvents, parsedEvents);
    client.emit('connected', {});

    return { s, network, client, getParsed };
}

function applyMetadata(getParsed, client, target, key, value) {
    getParsed()('METADATA', {
        command: 'METADATA',
        params: [target, key, '*', value],
        tags: {},
    }, client, () => {});
}

describe('Soju metadata', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('max-keys=0 suppresses our own metadata but allows Soju keys', () => {
        const { network, client } = setup({ maxKeys: '0' });

        // Only Soju's own keys survive the max-keys=0 filter, and they are
        // subscribed with the wildcard target at connect.
        expect(metadataCommands(client)).toEqual([
            {
                command: 'METADATA',
                params: ['*', 'SUB', 'soju.im/pinned', 'soju.im/muted', 'soju.im/blocked'],
            },
        ]);
        client.raw.mockClear();

        network.setMetadata('*', 'status', 'hello');
        expect(metadataCommands(client)).toHaveLength(0);

        network.getMetadata('*', ['status', 'avatar']);
        expect(metadataCommands(client)).toHaveLength(0);

        network.setMetadata('#chan', 'soju.im/pinned', '1');
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['#chan', 'SET', 'soju.im/pinned', '1'] },
        ]);
    });

    test('subscribes to the Soju keys once at connect and sends nothing on join', () => {
        const { client } = setup({ maxKeys: '0' });

        const sub = metadataCommands(client).find((cmd) => cmd.params[1] === 'SUB');
        expect(sub).toBeTruthy();
        expect(sub.params[0]).toBe('*');
        expect(sub.params).toContain('soju.im/pinned');
        expect(sub.params).toContain('soju.im/muted');
        expect(sub.params).toContain('soju.im/blocked');

        // Joins and userlists add nothing: the key list already covers them.
        client.raw.mockClear();
        client.emit('join', { nick: 'TestNick', channel: '#chan' });
        expect(metadataCommands(client)).toHaveLength(0);

        client.emit('userlist', {
            channel: '#chan',
            users: [{ nick: 'Alice' }, { nick: 'TestNick' }],
        });
        expect(metadataCommands(client)).toHaveLength(0);
    });

    test('opening a stale channel sends nothing but a stale query is fetched', () => {
        const { s, network, client } = setup({ maxKeys: '32' });

        const channel = s.addBuffer(network.id, '#chan');
        channel.joined = true;
        channel.lastMetadataFetch = 0;
        const query = s.addBuffer(network.id, 'Alice');
        query.lastMetadataFetch = 0;

        client.raw.mockClear();
        s.setActiveBuffer(network.id, '#chan');
        expect(metadataCommands(client)).toHaveLength(0);

        s.setActiveBuffer(network.id, 'Alice');
        expect(metadataCommands(client)).toEqual([
            {
                command: 'METADATA',
                params: ['Alice', 'GET', 'avatar', 'pronouns', 'display-name', 'description'],
            },
        ]);
    });

    test('incoming pinned and muted metadata updates the buffer settings', async() => {
        const { s, network, client, getParsed } = setup({ maxKeys: '0' });
        s.addBuffer(network.id, '#chan');
        client.emit('join', { nick: 'TestNick', channel: '#chan' });
        const buffer = network.bufferByName('#chan');
        client.raw.mockClear();

        applyMetadata(getParsed, client, '#chan', 'soju.im/pinned', '1');
        expect(buffer.setting('favorite')).toBe(true);
        applyMetadata(getParsed, client, '#chan', 'soju.im/pinned', '0');
        expect(buffer.setting('favorite')).toBe(false);

        applyMetadata(getParsed, client, '#chan', 'soju.im/muted', '1');
        expect(buffer.setting('alert_on')).toBe('never');
        expect(buffer.setting('mute_sound')).toBe(true);

        applyMetadata(getParsed, client, '#chan', 'soju.im/muted', '0');
        expect(buffer.setting('alert_on')).toBe('highlight');
        expect(buffer.setting('mute_sound')).toBe(false);

        await Vue.nextTick();
        await Vue.nextTick();
        expect(metadataCommands(client).filter((cmd) => cmd.params[1] === 'SET')).toHaveLength(0);
    });

    test('outgoing buffer settings send Soju metadata once', async() => {
        const { s, network, client } = setup({ maxKeys: '0' });
        s.addBuffer(network.id, '#chan');
        client.emit('join', { nick: 'TestNick', channel: '#chan' });
        const buffer = network.bufferByName('#chan');
        client.raw.mockClear();

        buffer.setting('favorite', true);
        await Vue.nextTick();
        await Vue.nextTick();
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['#chan', 'SET', 'soju.im/pinned', '1'] },
        ]);

        client.raw.mockClear();
        buffer.setting('alert_on', 'never');
        buffer.setting('mute_sound', true);
        await Vue.nextTick();
        await Vue.nextTick();
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['#chan', 'SET', 'soju.im/muted', '1'] },
        ]);

        client.raw.mockClear();
        buffer.setting('mute_sound', false);
        await Vue.nextTick();
        await Vue.nextTick();
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['#chan', 'SET', 'soju.im/muted', '0'] },
        ]);
    });

    test('blocked metadata and manual ignores stay in sync', () => {
        const { s, network, client, getParsed } = setup({ maxKeys: '0' });
        s.addUser(network.id, { nick: 'Alice' });
        s.addUser(network.id, { nick: 'Bob' });
        const alice = network.userByName('Alice');
        const bob = network.userByName('Bob');

        applyMetadata(getParsed, client, 'Alice', 'soju.im/blocked', '1');
        expect(alice.ignore).toBe(true);
        applyMetadata(getParsed, client, 'Alice', 'soju.im/blocked', '0');
        expect(alice.ignore).toBe(false);

        client.raw.mockClear();
        network.setUserIgnored(bob, true);
        expect(bob.ignore).toBe(true);
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['Bob', 'SET', 'soju.im/blocked', '1'] },
        ]);

        client.raw.mockClear();
        network.setUserIgnored(bob, false);
        expect(metadataCommands(client)).toEqual([
            { command: 'METADATA', params: ['Bob', 'SET', 'soju.im/blocked', '0'] },
        ]);
    });

    test('non-Soju servers keep the old metadata behaviour', () => {
        const { s, network, client } = setup({ ircd: 'Ergo-2.14.0', maxKeys: '0' });
        s.addUser(network.id, { nick: 'Alice' });
        const alice = network.userByName('Alice');
        client.raw.mockClear();

        network.setUserIgnored(alice, true);
        expect(alice.ignore).toBe(true);
        expect(metadataCommands(client)).toHaveLength(0);

        client.emit('userlist', { channel: '#chan', users: [{ nick: 'Alice' }] });
        expect(metadataCommands(client)).toHaveLength(0);
    });
});
