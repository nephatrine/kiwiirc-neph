jest.mock('@/libs/desktop/ChatLogs', () => ({
    isAvailable: jest.fn(() => true),
    onOpenSearch: jest.fn(() => () => {}),
    context: jest.fn(),
    search: jest.fn(),
}));

jest.mock('@/libs/MessageSearch', () => {
    const actual = jest.requireActual('@/libs/MessageSearch');
    return {
        ...actual,
        loadResultContext: jest.fn(),
        openLocalContext: jest.fn(),
    };
});

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import * as ChatLogContext from '@/libs/ChatLogContext';
import * as MessageSearch from '@/libs/MessageSearch';
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
        openLogResultIds: {},
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
        isResultUnloaded: ChatLogSearch.methods.isResultUnloaded,
        isResultOpenLog: ChatLogSearch.methods.isResultOpenLog,
        isResultLoading: ChatLogSearch.methods.isResultLoading,
        syncLoadedResults: jest.fn(),
        loadResultContext: jest.fn(),
        openLogResult: jest.fn(),
        defaultServerTarget: ChatLogSearch.methods.defaultServerTarget,
        search: jest.fn(),
        close: jest.fn(),
        parseSearchQuery: ChatLogSearch.methods.parseSearchQuery,
        $nextTick: (cb) => cb(),
        $refs: {},
        $set: (target, key, value) => {
            target[key] = value;
        },
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
            fromNick: '',
            limit: 50,
            offset: 0,
        });
    });

    test('parses channel and nick search filters', () => {
        const parse = ChatLogSearch.methods.parseSearchQuery;

        expect(parse('in:#alpine-linux fix', '#other')).toEqual({
            text: 'fix',
            bufferName: '#alpine-linux',
            fromNick: '',
        });
        expect(parse('from:Alice hello', '')).toEqual({
            text: 'hello',
            bufferName: '',
            fromNick: 'Alice',
        });
        expect(parse('#alpine-linux', '')).toEqual({
            text: '',
            bufferName: '#alpine-linux',
            fromNick: '',
        });
        expect(parse('@Alice', '#channel')).toEqual({
            text: '',
            bufferName: '#channel',
            fromNick: 'Alice',
        });
        expect(parse('hello #channel @Alice', '')).toEqual({
            text: 'hello #channel @Alice',
            bufferName: '',
            fromNick: '',
        });
    });

    test('passes explicit search filters to local logs', async() => {
        ChatLogs.search.mockResolvedValue({ rows: [], hasMore: false });
        const context = makeContext({
            query: 'in:#alpine-linux fix',
            networkId: 5,
            bufferName: '#other',
        });

        await ChatLogSearch.methods.search.call(context, true);

        expect(ChatLogs.search).toHaveBeenCalledWith({
            query: 'fix',
            networkId: 5,
            bufferName: '#alpine-linux',
            fromNick: '',
            limit: 50,
            offset: 0,
        });
    });

    test('passes explicit search filters to server search', async() => {
        const run = jest.fn().mockResolvedValue({ commands: [] });
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
            query: 'from:Alice in:#channel hello',
            bufferName: '#other',
            serverNetworks: [network],
            $state: {
                getNetwork: () => network,
                getActiveNetwork: () => network,
            },
        });

        await ChatLogSearch.methods.search.call(context, true);

        expect(run).toHaveBeenCalledWith({
            in: '#channel',
            from: 'Alice',
            after: undefined,
            before: 0,
            text: 'hello',
            limit: 50,
        });
    });

    test('requires a server search target', () => {
        const prompt = ChatLogSearch.computed.searchPrompt.call({
            source: 'server',
            networkId: 7,
            bufferName: '',
            query: 'hello',
            parseSearchQuery: ChatLogSearch.methods.parseSearchQuery,
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
            from: '',
            after: undefined,
            before: 0,
            text: 'hello',
            limit: 50,
        });
        expect(context.results).toHaveLength(1);
        expect(context.results[0].source).toBe('server');
        expect(context.serverBefore).toBe(Date.parse('2026-11-10T20:00:00.000Z'));
    });

    test('loads an unloaded result without closing the modal', () => {
        const context = makeContext({
            isResultUnloaded: () => true,
            loadResultContext: jest.fn(),
        });

        ChatLogSearch.methods.openResult.call(context, {
            id: 'unloaded-result',
            source: 'server',
        });

        expect(context.loadResultContext).toHaveBeenCalledWith({
            id: 'unloaded-result',
            source: 'server',
        });
    });

    test('opens the local log context from an Open Log result', () => {
        const context = makeContext({
            isResultUnloaded: () => false,
            isResultOpenLog: () => true,
            openLogResult: jest.fn(),
        });

        ChatLogSearch.methods.openResult.call(context, {
            id: 'local-result',
            source: 'local',
        });

        expect(context.openLogResult).toHaveBeenCalledWith({
            id: 'local-result',
            source: 'local',
        });
    });

    test('ignores clicks while a result is loading', () => {
        const context = makeContext({
            isResultLoading: () => true,
            loadResultContext: jest.fn(),
            openLogResult: jest.fn(),
        });

        ChatLogSearch.methods.openResult.call(context, {
            id: 'loading-result',
            source: 'local',
        });

        expect(context.loadResultContext).not.toHaveBeenCalled();
        expect(context.openLogResult).not.toHaveBeenCalled();
    });

    test('treats local results as unloaded until they are loaded or marked Open Log', () => {
        const context = makeContext();
        const result = {
            id: 'local-result',
            source: 'local',
        };

        expect(context.isResultUnloaded(result)).toBe(true);
        expect(context.isResultOpenLog(result)).toBe(false);

        context.openLogResultIds[result.id] = true;

        expect(context.isResultUnloaded(result)).toBe(false);
        expect(context.isResultOpenLog(result)).toBe(true);
    });

    test('marks local results already present in the buffer as loaded', () => {
        const result = {
            id: 'local-result',
            source: 'local',
            network_id: 5,
            buffer_name: '#channel',
        };
        const context = makeContext({
            results: [result],
            syncLoadedResults: ChatLogSearch.methods.syncLoadedResults,
            $state: {
                getActiveNetwork: () => null,
                getActiveBuffer: () => null,
                getBufferByName: () => ({
                    findLogResultMessage: () => ({ id: 'message' }),
                }),
            },
        });

        context.syncLoadedResults();

        expect(context.loadedResultIds[result.id]).toBe(true);
    });

    test('marks a failed local load as Open Log', async() => {
        MessageSearch.loadResultContext.mockResolvedValue('local');
        const context = makeContext({
            loadResultContext: ChatLogSearch.methods.loadResultContext,
            error: 'old error',
        });

        await context.loadResultContext({
            id: 'local-result',
            source: 'local',
        });

        expect(context.openLogResultIds['local-result']).toBe(true);
        expect(context.loadingResultIds['local-result']).toBe(false);
        expect(context.error).toBe('');
    });

    test('marks a successful context load as loaded', async() => {
        MessageSearch.loadResultContext.mockResolvedValue('loaded');
        const context = makeContext({
            loadResultContext: ChatLogSearch.methods.loadResultContext,
            syncLoadedResults: jest.fn(),
        });

        await context.loadResultContext({
            id: 'loaded-result',
            source: 'local',
        });

        expect(context.loadedResultIds['loaded-result']).toBe(true);
        expect(context.error).toBe('');
        expect(context.syncLoadedResults).toHaveBeenCalled();
    });

    test('keeps a failed server result unloaded with an error', async() => {
        MessageSearch.loadResultContext.mockResolvedValue('failed');
        const context = makeContext({
            loadResultContext: ChatLogSearch.methods.loadResultContext,
        });

        await context.loadResultContext({
            id: 'server-result',
            source: 'server',
        });

        expect(context.loadedResultIds['server-result']).toBeUndefined();
        expect(context.openLogResultIds['server-result']).toBeUndefined();
        expect(context.error).toBe('chatlogs_jump_failed');
    });

    test('opens a local log context from Open Log and closes the dialog', async() => {
        MessageSearch.openLocalContext.mockResolvedValue(true);
        const context = makeContext({
            openLogResult: ChatLogSearch.methods.openLogResult,
        });

        await context.openLogResult({
            id: 'local-result',
            source: 'local',
        });

        expect(MessageSearch.openLocalContext).toHaveBeenCalled();
        expect(context.close).toHaveBeenCalled();
    });

    test('applies a query supplied when opening the dialog', () => {
        const context = makeContext();

        ChatLogSearch.methods.open.call(context, {
            query: 'hello world',
            networkId: 5,
            bufferName: '#channel',
        });

        expect(context.query).toBe('hello world');
        expect(context.search).toHaveBeenCalledWith(true);
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

describe('ChatLogSearch source and network switching', () => {
    test('enables server history only for a supporting network', () => {
        const context = makeContext({
            serverNetworks: [{ id: 2 }, { id: 3 }],
            networkId: 2,
        });

        expect(ChatLogSearch.computed.canUseServerSearch.call(context)).toBe(true);

        context.networkId = 1;
        expect(ChatLogSearch.computed.canUseServerSearch.call(context)).toBe(false);

        context.networkId = 0;
        expect(ChatLogSearch.computed.canUseServerSearch.call(context)).toBe(false);
    });

    test('clears the target when the network changes', () => {
        const context = makeContext({
            source: 'server',
            networkId: 3,
            bufferName: '#old',
            serverNetworks: [{ id: 3 }, { id: 4 }],
            defaultServerTarget: jest.fn(() => '#active'),
        });

        ChatLogSearch.methods.onNetworkChange.call(context);

        expect(context.bufferName).toBe('');
        expect(context.defaultServerTarget).not.toHaveBeenCalled();
        expect(context.search).toHaveBeenCalledWith(true);
    });

    test('clears the target when switching source remaps the network', () => {
        const context = makeContext({
            source: 'server',
            networkId: 1,
            bufferName: '#old',
            serverNetworks: [{ id: 2 }],
            defaultServerTarget: jest.fn(() => '#active'),
            $state: {
                getActiveNetwork: () => null,
                getActiveBuffer: () => null,
            },
        });

        ChatLogSearch.methods.onSourceChange.call(context);

        expect(context.networkId).toBe(2);
        expect(context.bufferName).toBe('');
        expect(context.defaultServerTarget).not.toHaveBeenCalled();
        expect(context.search).toHaveBeenCalledWith(true);
    });

    test('keeps the target when switching source on the same network', () => {
        const context = makeContext({
            source: 'server',
            networkId: 2,
            bufferName: '#keep',
            serverNetworks: [{ id: 2 }],
            defaultServerTarget: jest.fn(() => '#active'),
        });

        ChatLogSearch.methods.onSourceChange.call(context);

        expect(context.networkId).toBe(2);
        expect(context.bufferName).toBe('#keep');
    });

    test('drops a prefilled target when opening on a remapped network', () => {
        const context = makeContext({
            availableSources: ['local', 'server'],
            source: 'local',
            serverNetworks: [{ id: 2 }],
            defaultServerTarget: jest.fn(() => ''),
            $state: {
                getActiveNetwork: () => ({ id: 1 }),
                getActiveBuffer: () => null,
            },
        });

        ChatLogSearch.methods.open.call(context, {
            source: 'server',
            networkId: 1,
            bufferName: '#old',
        });

        expect(context.networkId).toBe(2);
        expect(context.bufferName).toBe('');
    });

    test('keeps a prefilled target when opening on the same network', () => {
        const context = makeContext({
            availableSources: ['local', 'server'],
            source: 'local',
            serverNetworks: [{ id: 2 }],
            defaultServerTarget: jest.fn(() => ''),
            $state: {
                getActiveNetwork: () => ({ id: 2 }),
                getActiveBuffer: () => null,
            },
        });

        ChatLogSearch.methods.open.call(context, {
            source: 'server',
            networkId: 2,
            bufferName: '#keep',
        });

        expect(context.networkId).toBe(2);
        expect(context.bufferName).toBe('#keep');
    });
});

function makeChannelBuffer(messages = []) {
    return {
        networkid: 1,
        name: '#channel',
        contextOnly: false,
        contextTarget: '',
        flags: {},
        messages,
        isChannel: () => true,
        isQuery: () => false,
        getMessages: () => messages,
        flag(name, value) {
            this.flags[name] = value;
        },
    };
}

function makeContextBuffer() {
    return {
        name: '*context-1',
        contextOnly: true,
        contextSource: 'local',
        contextTarget: '',
        contextOlderRowId: 0,
        contextNewerRowId: 0,
        contextRowIds: {},
        flags: {},
        clearMessages: jest.fn(function clearMessages() {
            this.contextRowIds = {};
        }),
        flag(name, value) {
            this.flags[name] = value;
        },
        waitForTargetMessage: jest.fn(() => Promise.resolve(null)),
        scrollToMessage: jest.fn(),
    };
}

function makeContextState() {
    const contextBuffer = makeContextBuffer();
    const network = {
        id: 1,
        buffers: [],
    };
    const state = {
        network,
        contextBuffer,
        getNetwork: jest.fn(() => network),
        addContextBuffer: jest.fn(() => {
            network.buffers.push(contextBuffer);
            return contextBuffer;
        }),
        setActiveBuffer: jest.fn(),
        addMessage: jest.fn(),
    };
    return state;
}

describe('ChatLogContext channel continuation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ChatLogs.isAvailable.mockReturnValue(true);
    });

    test('anchors the context at the oldest loaded message', async() => {
        const state = makeContextState();
        const channel = makeChannelBuffer([
            { time: 3000, server_time: 4000 },
            { time: 1000, server_time: 2000 },
        ]);
        ChatLogs.context.mockResolvedValue({
            rows: [
                { id: 10, time: 900, server_time: 1800, nick: 'a', message: 'old' },
                { id: 11, time: 1000, server_time: 2000, nick: 'b', message: 'anchor' },
            ],
            hasOlder: true,
            hasNewer: true,
        });

        await expect(ChatLogContext.openChannelContext(state, channel))
            .resolves.toBe(true);

        expect(ChatLogs.context).toHaveBeenCalledWith({
            networkId: 1,
            bufferName: '#channel',
            serverTime: 2000,
            time: 2000,
            before: 25,
            after: 25,
        });
        expect(state.addContextBuffer).toHaveBeenCalledWith(1, '#channel');
        expect(state.setActiveBuffer).toHaveBeenCalledWith(1, state.contextBuffer.name);
        expect(state.addMessage).toHaveBeenCalledTimes(2);
        expect(state.contextBuffer.contextOlderRowId).toBe(10);
        expect(state.contextBuffer.contextNewerRowId).toBe(11);
        expect(state.contextBuffer.flags).toMatchObject({
            context_has_older: true,
            context_has_newer: true,
            context_loading: false,
        });
    });

    test('falls back to the newest local row when no messages are loaded', async() => {
        const state = makeContextState();
        const channel = makeChannelBuffer([]);
        ChatLogs.search.mockResolvedValue({ rows: [{ id: 9 }] });
        ChatLogs.context.mockResolvedValue({
            rows: [{ id: 9, time: 500, server_time: 500, nick: 'a', message: 'latest' }],
            hasOlder: true,
            hasNewer: false,
        });

        await expect(ChatLogContext.openChannelContext(state, channel))
            .resolves.toBe(true);

        expect(ChatLogs.search).toHaveBeenCalledWith({
            networkId: 1,
            bufferName: '#channel',
            query: '',
            limit: 1,
        });
        expect(ChatLogs.context).toHaveBeenCalledWith(
            expect.objectContaining({ rowId: 9 })
        );
        expect(ChatLogs.context.mock.calls[0][0]).not.toHaveProperty('serverTime');
    });

    test('returns false when no local rows are available', async() => {
        const state = makeContextState();
        const channel = makeChannelBuffer([]);
        ChatLogs.search.mockResolvedValue({ rows: [] });

        await expect(ChatLogContext.openChannelContext(state, channel))
            .resolves.toBe(false);

        expect(ChatLogs.context).not.toHaveBeenCalled();
        expect(state.setActiveBuffer).not.toHaveBeenCalled();
    });
});
