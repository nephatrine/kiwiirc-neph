jest.mock('@/libs/desktop/ChatLogs', () => ({
    isAvailable: jest.fn(() => false),
    search: jest.fn(),
}));

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import * as MessageSearch from '@/libs/MessageSearch';

function createNetwork() {
    return {
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
                run: jest.fn(),
            },
            chathistory: {
                isSupported: () => true,
            },
        },
    };
}

describe('MessageSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ChatLogs.isAvailable.mockReturnValue(false);
    });

    test('normalizes channel, private-message, notice, and action results', () => {
        const network = createNetwork();
        const commands = [
            {
                command: 'PRIVMSG',
                nick: 'bob',
                params: ['#channel', 'hello'],
                tags: {
                    account: 'bob',
                    msgid: 'one',
                    time: '2026-11-10T20:00:00.000Z',
                },
            },
            {
                command: 'PRIVMSG',
                nick: 'alice',
                params: ['Me', 'private'],
                tags: {
                    msgid: 'two',
                    time: '2026-11-10T20:01:00.000Z',
                },
            },
            {
                command: 'NOTICE',
                nick: 'server',
                params: ['#channel', 'notice'],
                tags: {
                    msgid: 'three',
                    time: '2026-11-10T20:02:00.000Z',
                },
            },
            {
                command: 'PRIVMSG',
                nick: 'bob',
                params: ['#channel', '\x01ACTION waves\x01'],
                tags: {
                    msgid: 'four',
                    time: '2026-11-10T20:03:00.000Z',
                },
            },
        ];

        const rows = MessageSearch.normalizeServerCommands(network, commands);

        expect(rows.map((row) => row.buffer_name))
            .toEqual(['#channel', 'alice', '#channel', '#channel']);
        expect(rows.map((row) => row.type))
            .toEqual(['privmsg', 'privmsg', 'notice', 'action']);
        expect(rows[0]).toMatchObject({
            source: 'server',
            network_id: 7,
            irc_id: 'one',
            message: 'hello',
            account: 'bob',
        });
        expect(rows[3].message).toBe('waves');
    });

    test('sends server search options and sorts results newest first', async() => {
        const network = createNetwork();
        network.ircClient.search.run.mockResolvedValue({
            commands: [
                {
                    command: 'PRIVMSG',
                    nick: 'bob',
                    params: ['#channel', 'older'],
                    tags: {
                        msgid: 'older',
                        time: '2026-11-10T19:00:00.000Z',
                    },
                },
                {
                    command: 'PRIVMSG',
                    nick: 'bob',
                    params: ['#channel', 'newer'],
                    tags: {
                        msgid: 'newer',
                        time: '2026-11-10T20:00:00.000Z',
                    },
                },
            ],
        });
        const state = {
            getNetwork: () => network,
        };

        const result = await MessageSearch.searchServer({
            state,
            networkId: 7,
            bufferName: '#channel',
            query: 'hello',
            limit: 50,
            before: 1234,
        });

        expect(network.ircClient.search.run).toHaveBeenCalledWith({
            in: '#channel',
            from: undefined,
            after: undefined,
            before: 1234,
            text: 'hello',
            limit: 50,
        });
        expect(result.rows.map((row) => row.message))
            .toEqual(['newer', 'older']);
        expect(result.hasMore).toBe(false);
    });

    test('defaults to local logs when they are available', () => {
        ChatLogs.isAvailable.mockReturnValue(true);
        const state = { networks: [] };

        expect(MessageSearch.defaultSource(state)).toBe('local');
    });

    test('defaults to server history when local logs are unavailable', () => {
        const network = createNetwork();
        const state = { networks: [network] };

        expect(MessageSearch.defaultSource(state)).toBe('server');
    });

    test('creates a server context buffer for an unopened result', async() => {
        const network = createNetwork();
        const buffer = {
            name: '#channel',
            findLogResultMessage: () => null,
            jumpToMessage: jest.fn(() => Promise.resolve(true)),
            scrollToMessage: jest.fn(),
        };
        const state = {
            getNetwork: () => network,
            getBufferByName: () => null,
            addServerContextBuffer: jest.fn(() => buffer),
            setActiveBuffer: jest.fn(),
            removeBuffer: jest.fn(),
            $nextTick: (cb) => cb(),
        };

        const opened = await MessageSearch.openServerResult(state, {
            source: 'server',
            network_id: 7,
            buffer_name: '#channel',
        });

        expect(opened).toBe(true);
        expect(state.addServerContextBuffer).toHaveBeenCalledWith(7, '#channel');
        expect(state.setActiveBuffer).toHaveBeenCalledWith(7, '#channel');
        expect(buffer.jumpToMessage).toHaveBeenCalled();
    });
});
