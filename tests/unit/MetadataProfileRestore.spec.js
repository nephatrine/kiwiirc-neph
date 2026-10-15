import { TextEncoder } from 'util';
import state from '@/libs/state';
import metadataMiddleware from '@/libs/MetadataMiddleware';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
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

function rawCommands(client, subcommand) {
    return client.raw.mock.calls
        .map((call) => call[0])
        .filter((msg) => msg && msg.command === 'METADATA' && msg.params[1] === subcommand)
        .map((msg) => msg.params.slice(2));
}

function attach(network) {
    let { client, rawEvents, parsedEvents, getParsed } = makeClient();
    network.nick = 'TestNick';
    network.enabled_caps = ['draft/metadata-3', 'labeled-response'];
    metadataMiddleware(network)(client, rawEvents, parsedEvents);
    return { client, getParsed };
}

describe('saved profile metadata', () => {
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

    it('records self SETs and ignores channel SETs', () => {
        let { client } = attach(network);
        network.setMetadata('avatar', 'http://example.com/a.png');
        network.setMetadata('TestNick', 'pronouns', 'they/them');
        network.setMetadata('#chan', 'description', 'nope');
        expect(network.saved_profile_metadata.avatar).toBe('http://example.com/a.png');
        expect(network.saved_profile_metadata.pronouns).toBe('they/them');
        expect(network.saved_profile_metadata.description).toBe(undefined);
        // Sanity: the SETs themselves still went out
        expect(rawCommands(client, 'SET')).toHaveLength(3);
    });

    it('remembers a cleared field as blank so it stays cleared', () => {
        attach(network);
        network.setMetadata('status', 'busy');
        network.setMetadata('status', '');
        expect(network.saved_profile_metadata.status).toBe('');
    });

    it('restores only blank keys once the initial GET is ACKed', () => {
        let { client, getParsed } = attach(network);
        network.setMetadata('avatar', 'http://example.com/a.png');
        network.setMetadata('pronouns', 'they/them');
        client.raw.mockClear();

        client.emit('connected');
        let getCall = client.raw.mock.calls
            .map((call) => call[0])
            .find((msg) => msg && msg.command === 'METADATA' && msg.params[1] === 'GET');
        expect(getCall.tags && getCall.tags.label).toBeTruthy();
        let label = getCall.tags.label;

        // Server has pronouns (different value: another client set it) but
        // no avatar for us.
        getParsed()('761', {
            command: '761',
            params: ['TestNick', 'TestNick', 'pronouns', '*', 'she/her'],
            tags: {},
        }, client, () => {});
        getParsed()('766', {
            command: '766',
            params: ['TestNick', 'TestNick', 'avatar'],
            tags: {},
        }, client, () => {});

        // The server value wins over our remembered one.
        expect(network.saved_profile_metadata.pronouns).toBe('she/her');

        getParsed()('ACK', { command: 'ACK', params: [], tags: { label } }, client, () => {});

        let sets = rawCommands(client, 'SET');
        expect(sets).toEqual([['avatar', 'http://example.com/a.png']]);
    });

    it('does not restore twice and cancels the fallback timer', () => {
        let { client, getParsed } = attach(network);
        network.setMetadata('avatar', 'http://example.com/a.png');
        client.raw.mockClear();
        client.emit('connected');

        let getCall = client.raw.mock.calls
            .map((call) => call[0])
            .find((msg) => msg && msg.command === 'METADATA' && msg.params[1] === 'GET');
        getParsed()('ACK', {
            command: 'ACK',
            params: [],
            tags: { label: getCall.tags.label },
        }, client, () => {});
        expect(rawCommands(client, 'SET')).toHaveLength(1);

        // Unknown labels and the fallback timer must not re-run the pass.
        getParsed()('ACK', {
            command: 'ACK',
            params: [],
            tags: { label: 'nope' },
        }, client, () => {});
        jest.advanceTimersByTime(10000);
        expect(rawCommands(client, 'SET')).toHaveLength(1);
    });

    it('falls back to a timer without labeled-response', () => {
        let { client } = attach(network);
        network.enabled_caps = ['draft/metadata-3'];
        network.setMetadata('avatar', 'http://example.com/a.png');
        client.raw.mockClear();

        client.emit('connected');
        expect(rawCommands(client, 'SET')).toHaveLength(0);
        jest.advanceTimersByTime(3000);
        expect(rawCommands(client, 'SET')).toEqual([['avatar', 'http://example.com/a.png']]);
    });

    it('wipes the saved profile when the identity changes', () => {
        let { client } = attach(network);
        network.saved_profile_metadata = { avatar: 'http://example.com/a.png' };
        network.saved_profile_owner = '';

        network.connection.account = '';
        client.emit('connecting');
        expect(network.saved_profile_metadata).toEqual({ avatar: 'http://example.com/a.png' });

        network.connection.account = 'somebody';
        client.emit('connecting');
        expect(network.saved_profile_metadata).toEqual({});
        expect(network.saved_profile_owner).toBe('somebody');
    });

    it('persists the saved profile through exportState', () => {
        attach(network);
        network.setMetadata('avatar', 'http://example.com/a.png');
        network.saved_profile_owner = 'somebody';
        let exported = JSON.parse(s.exportState(true));
        expect(exported.networks[0].saved_profile_metadata).toEqual({
            avatar: 'http://example.com/a.png',
        });
        expect(exported.networks[0].saved_profile_owner).toBe('somebody');
    });
});
