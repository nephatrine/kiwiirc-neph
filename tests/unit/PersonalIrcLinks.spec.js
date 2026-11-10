jest.mock('@/libs/BouncerProvider', () => jest.fn());

import Personal from '@/components/startups/Personal';

function makeContext(state, t = (key, opts) => `${key}:${JSON.stringify(opts)}`) {
    return Object.assign({
        $state: state,
        $t: t,
        $emit: jest.fn(),
    }, Personal.methods);
}

describe('Personal IRC link handling', () => {
    afterEach(() => {
        window.location.hash = '';
        jest.restoreAllMocks();
    });

    test('parses encoded ircs links and sanitizes them', () => {
        window.location.hash =
            '#ircs%3A%2F%2Firc.example.com%3A%2B6697%2F%23channel%2Cother%3Fnick%3Dbob';

        const connection = Personal.methods.parseFragment.call({});

        expect(connection).toMatchObject({
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            nick: 'bob',
            channels: ['#channel', '#other'],
        });
    });

    test('rejects non-IRC schemes and invalid ports', () => {
        window.location.hash = '#https://example.com';
        expect(Personal.methods.parseFragment.call({})).toBeNull();

        window.location.hash = '#irc://example.com:99999';
        expect(Personal.methods.parseFragment.call({})).toBeNull();
    });

    test('creates a disconnected network with prefilled settings', () => {
        const network = {
            connection: {},
            showServerBuffer: jest.fn(),
        };
        const state = {
            getNetworkFromAddress: jest.fn(() => null),
            addNetwork: jest.fn(() => network),
        };
        const context = makeContext(state);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            encoding: 'utf8',
            nick: 'tester',
            channels: ['#one', '#two'],
        });

        expect(state.addNetwork).toHaveBeenCalledWith('irc.example.com', 'tester', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            encoding: 'utf8',
            channels: '#one,#two',
        });
        expect(network.connection).toMatchObject({
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            channels: '#one,#two',
        });
        expect(network.showServerBuffer).toHaveBeenCalledWith('settings');
    });

    test('focuses an existing network and joins missing channels', () => {
        const network = {
            id: 1,
            name: 'Existing',
            state: 'connected',
            connection: { server: 'irc.example.com', channels: '' },
            bufferByName: jest.fn(() => null),
            serverBuffer: () => ({ name: '*' }),
            ircClient: { join: jest.fn() },
        };
        const state = {
            getNetworkFromAddress: jest.fn(() => network),
            $emit: jest.fn(),
            setActiveBuffer: jest.fn(),
            addBuffer: jest.fn((id, name) => ({
                name,
                joined: false,
                enabled: false,
                key: '',
            })),
        };
        const context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => true);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(state.setActiveBuffer).toHaveBeenCalledWith(1, '*');
        expect(window.confirm).toHaveBeenCalledWith('join prompt');
        expect(state.addBuffer).toHaveBeenCalledWith(1, '#new');
        expect(network.ircClient.join).toHaveBeenCalledWith('#new', '');
    });

    test('only focuses an existing network when joining is declined', () => {
        const network = {
            id: 1,
            name: 'Existing',
            state: 'connected',
            connection: { server: 'irc.example.com', channels: '' },
            bufferByName: jest.fn(() => null),
            serverBuffer: () => ({ name: '*' }),
            ircClient: { join: jest.fn() },
        };
        const state = {
            getNetworkFromAddress: jest.fn(() => network),
            $emit: jest.fn(),
            setActiveBuffer: jest.fn(),
            addBuffer: jest.fn(),
        };
        const context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => false);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(state.setActiveBuffer).toHaveBeenCalledWith(1, '*');
        expect(state.addBuffer).not.toHaveBeenCalled();
        expect(network.ircClient.join).not.toHaveBeenCalled();
    });

    test('does not prompt for channels that are already joined', () => {
        const network = {
            id: 1,
            name: 'Existing',
            state: 'connected',
            connection: { server: 'irc.example.com', channels: '' },
            bufferByName: jest.fn(() => ({ joined: true })),
            serverBuffer: () => ({ name: '*' }),
            ircClient: { join: jest.fn() },
        };
        const state = {
            getNetworkFromAddress: jest.fn(() => network),
            $emit: jest.fn(),
            setActiveBuffer: jest.fn(),
            addBuffer: jest.fn(),
        };
        const context = makeContext(state);
        window.confirm = jest.fn();

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#joined'],
        });

        expect(window.confirm).not.toHaveBeenCalled();
        expect(state.addBuffer).not.toHaveBeenCalled();
    });

    test('stores missing channels on a disconnected network', () => {
        const network = {
            id: 1,
            name: 'Existing',
            state: 'disconnected',
            connection: { server: 'irc.example.com', channels: '#old key' },
            bufferByName: jest.fn(() => null),
            serverBuffer: () => ({ name: '*' }),
        };
        const state = {
            getNetworkFromAddress: jest.fn(() => network),
            $emit: jest.fn(),
            setActiveBuffer: jest.fn(),
        };
        const context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => true);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(network.connection.channels).toBe('#old,#new key');
    });
});
