jest.mock('@/libs/BouncerProvider', () => jest.fn(() => ({
    enable: jest.fn(),
})));

import BouncerProvider from '@/libs/BouncerProvider';
import Personal from '@/components/startups/Personal';

function makeContext(state, t = (key, opts) => `${key}:${JSON.stringify(opts)}`) {
    return Object.assign({
        $state: state,
        $t: t,
        $emit: jest.fn(),
    }, Personal.methods);
}

function makeExistingNetwork(overrides = {}) {
    return Object.assign({
        id: 1,
        name: 'Existing',
        state: 'connected',
        connection: { server: 'irc.example.com', channels: '' },
        bufferByName: jest.fn(() => null),
        serverBuffer: () => ({ name: '*' }),
        ircClient: { join: jest.fn() },
    }, overrides);
}

function makeExistingState(network, overrides = {}) {
    return Object.assign({
        getNetworkFromAddress: jest.fn(() => network),
        $emit: jest.fn(),
        setActiveBuffer: jest.fn(),
        addBuffer: jest.fn(),
    }, overrides);
}

describe('Personal IRC link handling', () => {
    afterEach(() => {
        window.location.hash = '';
        jest.restoreAllMocks();
    });

    test('parses encoded ircs links and rejects invalid ones', () => {
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

    test('focuses an existing network and handles its channels', () => {
        let network = makeExistingNetwork();
        let state = makeExistingState(network, {
            addBuffer: jest.fn((id, name) => ({
                name,
                joined: false,
                enabled: false,
                key: '',
            })),
        });
        let context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => true);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(state.setActiveBuffer).toHaveBeenCalledWith(1, '*');
        expect(window.confirm).toHaveBeenCalledWith('join prompt');
        expect(state.addBuffer).toHaveBeenCalledWith(1, '#new');
        expect(network.ircClient.join).toHaveBeenCalledWith('#new', '');

        network = makeExistingNetwork();
        state = makeExistingState(network);
        context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => false);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(state.setActiveBuffer).toHaveBeenCalledWith(1, '*');
        expect(state.addBuffer).not.toHaveBeenCalled();
        expect(network.ircClient.join).not.toHaveBeenCalled();

        network = makeExistingNetwork({
            bufferByName: jest.fn(() => ({ joined: true })),
        });
        state = makeExistingState(network);
        context = makeContext(state);
        window.confirm = jest.fn();

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#joined'],
        });

        expect(window.confirm).not.toHaveBeenCalled();
        expect(state.addBuffer).not.toHaveBeenCalled();

        network = makeExistingNetwork({
            state: 'disconnected',
            connection: { server: 'irc.example.com', channels: '#old key' },
        });
        state = makeExistingState(network);
        context = makeContext(state, () => 'join prompt');
        window.confirm = jest.fn(() => true);

        Personal.methods.applyIrcLink.call(context, {
            server: 'irc.example.com',
            channels: ['#new'],
        });

        expect(network.connection.channels).toBe('#old,#new key');
    });
});

describe('Personal bouncer restoration', () => {
    test('enables the bouncer provider from a saved control connection', async() => {
        const controller = {
            id: 1,
            is_bnc: true,
            connection: {
                server: 'bnc.example.com',
                port: 6697,
                tls: true,
                direct: false,
                path: '',
            },
        };
        const state = {
            settings: {
                startupOptions: {},
            },
            persistence: {
                includeBuffers: false,
                watchStateForChanges: jest.fn(),
            },
            networks: [controller],
            setSetting: jest.fn(),
            setActiveBuffer: jest.fn(),
        };
        const context = {
            $state: state,
            $emit: jest.fn(),
        };

        await Personal.methods.init.call(context);

        expect(BouncerProvider).toHaveBeenCalledWith(state);
        const provider = BouncerProvider.mock.results[0].value;
        expect(provider.enable).toHaveBeenCalledWith(
            'bnc.example.com',
            6697,
            true,
            false,
            ''
        );
        expect(state.setSetting).toHaveBeenCalledWith('settings.restricted', false);
    });
});
