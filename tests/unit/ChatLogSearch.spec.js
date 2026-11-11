jest.mock('@/libs/desktop/ChatLogs', () => ({
    search: jest.fn(),
    isAvailable: jest.fn(() => true),
    onOpenSearch: jest.fn(() => () => {}),
}));

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import ChatLogSearch from '@/components/ChatLogSearch';

function makeContext(overrides = {}) {
    return {
        visible: false,
        error: '',
        query: '',
        source: 'local',
        networkId: 0,
        bufferName: '',
        results: [],
        loadedResultIds: {},
        loadingResultIds: {},
        loading: false,
        hasMore: false,
        offset: 0,
        serverBefore: 0,
        lastSource: '',
        searchGeneration: 0,
        availableSources: ['local'],
        serverNetworks: [],
        serverTargets: [],
        localAvailable: true,
        searchPrompt: '',
        $state: {
            getActiveNetwork: () => null,
            getActiveBuffer: () => null,
        },
        resetSearch: jest.fn(),
        resultKey: ChatLogSearch.methods.resultKey,
        isServerResultUnloaded: ChatLogSearch.methods.isServerResultUnloaded,
        isResultLoading: ChatLogSearch.methods.isResultLoading,
        syncLoadedResults: jest.fn(),
        loadResultContext: jest.fn(),
        defaultServerTarget: ChatLogSearch.methods.defaultServerTarget,
        search: jest.fn(),
        $nextTick: (cb) => cb(),
        $refs: {},
        $t: (key) => key,
        ...overrides,
    };
}

describe('ChatLogSearch buffer filters', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ChatLogs.isAvailable.mockReturnValue(true);
    });

    test('opens with a preselected network and buffer', () => {
        const context = makeContext();
        context.bufferName = '';

        ChatLogSearch.methods.open.call(context, {
            networkId: 5,
            bufferName: '#channel',
        });

        expect(context.visible).toBe(true);
        expect(context.error).toBe('');
        expect(context.source).toBe('local');
        expect(context.networkId).toBe(5);
        expect(context.bufferName).toBe('#channel');
        expect(context.resetSearch).toHaveBeenCalled();
        expect(context.search).toHaveBeenCalledWith(true);
    });

    test('clears a previous buffer filter when opened without one', () => {
        const context = makeContext({
            networkId: 5,
            bufferName: '#old',
        });

        ChatLogSearch.methods.open.call(context);

        expect(context.networkId).toBe(0);
        expect(context.bufferName).toBe('');
    });

    test('selects the active searchable network for server search', () => {
        const context = makeContext({
            availableSources: ['server'],
            localAvailable: false,
            serverNetworks: [{ id: 4 }, { id: 9 }],
            $state: {
                getActiveNetwork: () => ({ id: 9 }),
            },
        });

        ChatLogSearch.methods.open.call(context);

        expect(context.source).toBe('server');
        expect(context.networkId).toBe(9);
    });

    test('passes the buffer filter to local log search', async() => {
        ChatLogs.search.mockResolvedValue({ rows: [], hasMore: false });
        const context = makeContext({
            query: 'hello',
            networkId: 5,
            bufferName: '#channel',
        });

        await ChatLogSearch.methods.search.call(context, true);

        expect(ChatLogs.search).toHaveBeenCalledWith({
            query: 'hello',
            networkId: 5,
            bufferName: '#channel',
            limit: 50,
            offset: 0,
        });
    });

    test('requires a server search target', () => {
        const prompt = ChatLogSearch.computed.searchPrompt.call({
            source: 'server',
            networkId: 7,
            bufferName: '',
            query: 'hello',
            $t: (key) => key,
        });

        expect(prompt).toBe('chatlogs_server_target_required');
    });

    test('prefills the active channel for server search', () => {
        const network = { id: 9 };
        const activeBuffer = {
            networkid: 9,
            name: '#channel',
            isChannel: () => true,
            isQuery: () => false,
        };
        const context = makeContext({
            availableSources: ['server'],
            localAvailable: false,
            serverNetworks: [network],
            $state: {
                getActiveNetwork: () => network,
                getActiveBuffer: () => activeBuffer,
            },
        });

        ChatLogSearch.methods.open.call(context);

        expect(context.source).toBe('server');
        expect(context.networkId).toBe(9);
        expect(context.bufferName).toBe('#channel');
    });

    test('does not run a server search without a network', () => {
        const context = makeContext({
            source: 'server',
            networkId: 0,
            searchPrompt: 'chatlogs_server_network_required',
        });

        ChatLogSearch.methods.search.call(context, true);

        expect(context.loading).toBe(false);
    });

    test('does not run a server search without a target', () => {
        const run = jest.fn();
        const network = {
            id: 7,
            state: 'connected',
            ircClient: {
                search: {
                    isSupported: () => true,
                    run,
                },
            },
        };
        const context = makeContext({
            source: 'server',
            localAvailable: false,
            availableSources: ['server'],
            networkId: 7,
            query: 'hello',
            bufferName: '',
            searchPrompt: 'chatlogs_server_target_required',
            serverNetworks: [network],
            $state: {
                getNetwork: () => network,
                getActiveNetwork: () => network,
            },
        });

        ChatLogSearch.methods.search.call(context, true);

        expect(context.loading).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    test('runs a server search with the selected network', async() => {
        const run = jest.fn().mockResolvedValue({
            commands: [{
                command: 'PRIVMSG',
                nick: 'bob',
                params: ['#channel', 'hello'],
                tags: {
                    msgid: 'abc',
                    time: '2026-11-10T20:00:00.000Z',
                },
            }],
        });
        const network = {
            id: 7,
            name: 'TestNetwork',
            nick: 'Me',
            state: 'connected',
            isChannelName: (name) => name.startsWith('#'),
            caseCompare: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
            timeToLocal: (time) => time,
            ircClient: {
                search: {
                    isSupported: () => true,
                    run,
                },
            },
        };
        const context = makeContext({
            source: 'server',
            localAvailable: false,
            availableSources: ['server'],
            networkId: 7,
            query: 'hello',
            bufferName: '#channel',
            serverNetworks: [network],
            $state: {
                getNetwork: () => network,
                getActiveNetwork: () => network,
            },
        });

        await ChatLogSearch.methods.search.call(context, true);

        expect(context.error).toBe('');
        expect(run).toHaveBeenCalledWith({
            in: '#channel',
            from: undefined,
            after: undefined,
            before: 0,
            text: 'hello',
            limit: 50,
        });
        expect(context.results).toHaveLength(1);
        expect(context.results[0].source).toBe('server');
        expect(context.serverBefore).toBe(Date.parse('2026-11-10T20:00:00.000Z'));
    });

    test('loads an unloaded server result without closing the modal', () => {
        const context = makeContext({
            isServerResultUnloaded: () => true,
            loadResultContext: jest.fn(),
        });

        ChatLogSearch.methods.openResult.call(context, {
            id: 'server-result',
            source: 'server',
        });

        expect(context.loadResultContext).toHaveBeenCalledWith({
            id: 'server-result',
            source: 'server',
        });
    });

    test('clears the buffer filter and searches again', () => {
        const context = makeContext({
            bufferName: '#channel',
        });

        ChatLogSearch.methods.clearBufferFilter.call(context);

        expect(context.bufferName).toBe('');
        expect(context.search).toHaveBeenCalledWith(true);
    });
});
