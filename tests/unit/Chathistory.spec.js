import EventEmitter from 'eventemitter3';
import state from '@/libs/state';
import chathistoryMiddleware, { HISTORY_REQUEST_TIMEOUT_MS } from '@/libs/ChathistoryMiddleware';

describe('chathistory cursor timestamps', () => {
    let s;
    let network;
    let buffer;

    function flushPromises() {
        return new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    async function flushMicrotasks() {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    }

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.enabled_caps = ['draft/chathistory'];
        buffer = s.addBuffer(network.id, '#channel');
        buffer.isMessageTrimming = false;
    });

    afterEach(() => {
        jest.useRealTimers();
        s.$destroy();
    });

    function installHistory(overrides = {}) {
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => Promise.resolve({ commands: [] })),
            before: jest.fn(() => Promise.resolve({ commands: [] })),
            ...overrides,
        };
    }

    test('uses the oldest tagged event time for the cursor and manual loading', async() => {
        const latest = jest.fn(() => {
            s.addMessage(buffer, {
                time: Date.parse('2026-11-10T21:35:24.550Z'),
                server_time: Date.parse('2026-11-10T21:35:24.550Z'),
                nick: 'alice',
                message: 'chat',
                type: 'privmsg',
                tags: {
                    'kiwi-history': true,
                    'msgid': 'chat-id',
                },
            });
            return Promise.resolve({
                commands: [
                    { tags: { time: '2026-11-10T20:06:05.166Z' } },
                    {
                        tags: {
                            time: '2026-11-10T21:35:24.550Z',
                            msgid: 'chat-id',
                        },
                    },
                ],
            });
        });
        const before = jest.fn(() => Promise.resolve({ commands: [] }));
        installHistory({ latest, before });

        buffer.requestLatestScrollback();
        await flushPromises();

        expect(buffer.chathistory_cursor).toMatchObject({
            irc_id: '',
            server_time: Date.parse('2026-11-10T20:06:05.166Z'),
        });

        buffer.requestScrollback();

        expect(before).toHaveBeenCalledTimes(1);
        expect(before.mock.calls[0][1]).toBeInstanceOf(Date);
        expect(before.mock.calls[0][1].toISOString())
            .toBe('2026-11-10T20:06:05.166Z');

        await flushPromises();
    });

    test('advances through presence-only batches using tagged times', async() => {
        jest.useFakeTimers();

        buffer.setting('show_joinparts', false);
        buffer.chathistory_cursor = {
            server_time: Date.parse('2026-11-10T21:00:00.000Z'),
        };

        let resolveSecond;
        const secondCall = new Promise((resolve) => {
            resolveSecond = resolve;
        });

        const before = jest.fn(() => {
            if (before.mock.calls.length === 1) {
                for (let i = 0; i < 5; i += 1) {
                    const time = Date.parse('2026-11-10T20:00:00.000Z') + i;
                    s.addMessage(buffer, {
                        time,
                        server_time: time,
                        nick: 'user',
                        message: 'joined',
                        type: 'traffic',
                        tags: {},
                    });
                }

                return Promise.resolve({
                    commands: [{ tags: { time: '2026-11-10T20:00:00.000Z' } }],
                });
            }

            const time = Date.parse('2026-11-10T19:00:00.000Z');
            s.addMessage(buffer, {
                time,
                server_time: time,
                nick: 'user',
                message: 'older message',
                irc_id: 'older',
                tags: { msgid: 'older', time: '2026-11-10T19:00:00.000Z' },
                type: 'privmsg',
            });
            resolveSecond();

            return Promise.resolve({
                commands: [{
                    tags: {
                        time: '2026-11-10T19:00:00.000Z',
                        msgid: 'older',
                    },
                }],
            });
        });

        installHistory({ before });

        buffer.requestScrollback();
        await secondCall;
        await flushMicrotasks();

        expect(before).toHaveBeenCalledTimes(2);
        expect(before.mock.calls[0][1].toISOString())
            .toBe('2026-11-10T21:00:00.000Z');
        expect(before.mock.calls[1][1].toISOString())
            .toBe('2026-11-10T20:00:00.000Z');
        expect(buffer.flags.chathistory_available).toBe(true);
    });
});

describe('history context gaps', () => {
    function addChatMessage(s, buffer, overrides = {}) {
        return s.addMessage(buffer, {
            type: 'privmsg',
            nick: 'Alice',
            message: 'history message',
            raw_text: 'history message',
            ...overrides,
        });
    }

    function makeBuffer() {
        const s = state.create();
        const network = s.addNetwork('TestNet', 'TestNick', {
            server: 'irc.example.com',
        });
        const buffer = s.addBuffer(network.id, '#test');
        return { s, network, buffer };
    }

    it('tracks history batches, disjoint windows, and overlapping windows', () => {
        let { s, buffer } = makeBuffer();
        buffer.historyBatchActive = true;

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            type: 'traffic',
            message: 'historical join',
        });

        expect(buffer.getMessages()[0].is_history).toBe(true);
        expect(buffer.historySegments).toHaveLength(0);

        ({ s, buffer } = makeBuffer());

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(3000, 4000);

        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(3000);

        ({ s, buffer } = makeBuffer());

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(2000, 3000);

        expect(buffer.historySegments).toHaveLength(1);
        expect(buffer.historyGaps).toHaveLength(0);
    });

    it('requests the correct reference for each gap direction', async() => {
        const { s, network, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            irc_id: 'live-1',
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            irc_id: 'live-2',
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            irc_id: 'history-1',
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            irc_id: 'history-2',
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(3000, 4000);

        const before = jest.fn().mockResolvedValue({
            commands: [],
            is_end: true,
        });
        const after = jest.fn().mockResolvedValue({
            commands: [],
            is_end: true,
        });
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before,
            after,
        };

        const gap = buffer.historyGaps[0];
        await buffer.requestHistoryGap(gap, 'older');
        expect(after).toHaveBeenCalledWith('#test', 'live-2');

        await buffer.requestHistoryGap(gap, 'newer');
        expect(before).toHaveBeenCalledWith('#test', 'history-1');
    });

    it('loads a disjoint context window and exposes the resulting gap', async() => {
        const { s, network, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });

        const around = jest.fn(async() => {
            addChatMessage(s, buffer, {
                time: 3000,
                server_time: 3000,
                tags: { 'msgid': 'context-1', 'kiwi-history': true },
            });
            addChatMessage(s, buffer, {
                time: 4000,
                server_time: 4000,
                tags: { 'msgid': 'context-2', 'kiwi-history': true },
            });
            return {
                commands: [
                    { time: 3000, tags: { msgid: 'context-1' } },
                    { time: 4000, tags: { msgid: 'context-2' } },
                ],
                is_end: false,
            };
        });
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            around,
        };
        buffer.scrollToMessage = jest.fn(() => Promise.resolve(true));

        const loaded = await buffer.jumpToMessage({
            irc_id: 'context-1',
            server_time: 3000,
        });

        expect(loaded).toBe(true);
        expect(around).toHaveBeenCalledWith('#test', 'context-1');
        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(3000);
    });

    it('connects a BEFORE window to the newer segment despite time gaps', () => {
        const { s, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'context-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            tags: { 'msgid': 'context-2', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 2500,
            server_time: 2500,
            tags: { 'msgid': 'context-0', 'kiwi-history': true },
        });

        buffer.noteHistoryWindow(3000, 4000, 'around');
        buffer.noteHistoryWindow(2500, 2500, 'before');

        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(2500);
    });
});

describe('hidden-only chathistory batches', () => {
    let s;
    let network;
    let buffer;
    let newestTime;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.enabled_caps = ['draft/chathistory'];
        buffer = s.addBuffer(network.id, '#channel');
        buffer.isMessageTrimming = false;
        buffer.setting('show_joinparts', false);
        newestTime = Date.now();
        s.addMessage(buffer, {
            time: newestTime,
            server_time: newestTime,
            nick: 'user',
            message: 'newest',
            irc_id: 'newest',
            tags: {},
            type: 'privmsg',
        });
        buffer.last_read = newestTime + 1000;
    });

    afterEach(() => {
        s.$destroy();
    });

    test('advances through hidden batches and finds older displayable messages', async() => {
        const calls = [];
        let resolveSecond;
        const secondCall = new Promise((resolve) => {
            resolveSecond = resolve;
        });

        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before: jest.fn((target, ref) => {
                calls.push(ref);
                if (calls.length === 1) {
                    const time = newestTime - 1000;
                    s.addMessage(buffer, {
                        time,
                        server_time: time,
                        nick: 'user',
                        message: 'joined',
                        irc_id: 'hidden1',
                        tags: { msgid: 'hidden1' },
                        type: 'traffic',
                    });
                    return Promise.resolve({
                        commands: [{ time, tags: { msgid: 'hidden1' } }],
                    });
                }

                const time = newestTime - 2000;
                s.addMessage(buffer, {
                    time,
                    server_time: time,
                    nick: 'user',
                    message: 'older message',
                    irc_id: 'older1',
                    tags: { msgid: 'older1' },
                    type: 'privmsg',
                });
                resolveSecond();
                return Promise.resolve({
                    commands: [{ time, tags: { msgid: 'older1' } }],
                });
            }),
        };

        buffer.requestScrollback();
        await secondCall;
        await Promise.resolve();

        expect(calls).toEqual(['newest', 'hidden1']);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.chathistory_cursor).toMatchObject({
            irc_id: 'older1',
        });
    });

    test('uses the chathistory cursor for the next manual request', async() => {
        buffer.chathistory_cursor = {
            irc_id: 'hidden1',
            server_time: newestTime - 1000,
        };
        const before = jest.fn(() => Promise.resolve({ commands: [] }));
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before,
        };

        buffer.requestScrollback();

        expect(before).toHaveBeenCalledWith('#channel', 'hidden1');
    });
});

describe('latest chathistory boundaries', () => {
    function flush() {
        return new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    function makeHistoryBuffer() {
        const s = state.create();
        const network = s.addNetwork('TestNet', 'TestNick', {
            server: 'irc.example.com',
        });
        network.state = 'connected';
        const buffer = s.addBuffer(network.id, '#channel');
        buffer.isMessageTrimming = false;
        buffer.flags.names_received = true;
        buffer.setting('auto_request_history', 'channels');
        return { s, network, buffer };
    }

    test('closes the latest gap using displayable messages only', async() => {
        let { s, network, buffer } = makeHistoryBuffer();
        let now = Date.now();
        let earlier = now - 60000;

        s.addMessage(buffer, {
            time: now,
            server_time: now,
            nick: 'TestNick',
            message: 'joined',
            type: 'traffic',
            tags: {},
        });

        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => {
                s.addMessage(buffer, {
                    time: earlier,
                    server_time: earlier,
                    nick: 'alice',
                    message: 'older message',
                    irc_id: 'older',
                    type: 'privmsg',
                    tags: { 'kiwi-history': true, 'msgid': 'older' },
                });
                return Promise.resolve({
                    commands: [{
                        time: earlier,
                        tags: { 'kiwi-history': true, 'msgid': 'older' },
                    }],
                    is_end: true,
                });
            }),
        };

        buffer.requestLatestScrollback();
        await flush();

        expect(buffer.history_latest_loaded).toBe(true);
        expect(buffer.history_latest_end).toBe(earlier);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.historyGaps).toHaveLength(0);
        expect(buffer.getMessages().some((message) => message.irc_id === 'older'))
            .toBe(true);

        // Reaction TAGMSGs are consumed before they reach the buffer, but
        // still appear in chathistory and must not move the boundary.
        ({ s, network, buffer } = makeHistoryBuffer());
        now = Date.now();
        earlier = now - 60000;
        const reactionTime = now - 30000;

        s.addMessage(buffer, {
            time: now,
            server_time: now,
            nick: 'TestNick',
            message: 'live message',
            type: 'privmsg',
            tags: {},
        });

        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => {
                s.addMessage(buffer, {
                    time: earlier,
                    server_time: earlier,
                    nick: 'alice',
                    message: 'older message',
                    irc_id: 'older',
                    type: 'privmsg',
                    tags: { 'kiwi-history': true, 'msgid': 'older' },
                });
                return Promise.resolve({
                    commands: [
                        {
                            time: earlier,
                            tags: { 'kiwi-history': true, 'msgid': 'older' },
                        },
                        {
                            time: reactionTime,
                            tags: {
                                'kiwi-history': true,
                                'msgid': 'reaction',
                                '+draft/react': '👍',
                            },
                        },
                    ],
                    is_end: true,
                });
            }),
        };

        buffer.requestLatestScrollback();
        await flush();

        expect(buffer.history_latest_end).toBe(earlier);
        expect(buffer.historyGaps).toHaveLength(0);
    });

    test('keeps an older gap when the latest window has no segment', () => {
        const { s, buffer } = makeHistoryBuffer();
        const now = Date.now();
        const old = now - 120000;

        s.addMessage(buffer, {
            time: now,
            server_time: now,
            nick: 'TestNick',
            message: 'joined',
            type: 'traffic',
            tags: {},
        });
        s.addMessage(buffer, {
            time: old,
            server_time: old,
            nick: 'alice',
            message: 'old history',
            type: 'privmsg',
            tags: { 'kiwi-history': true, 'msgid': 'old' },
        });
        buffer.noteHistoryWindow(old, old, 'around');
        buffer.history_latest_loaded = true;
        buffer.history_latest_end = now;
        buffer.refreshHistoryGaps();

        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].to).toBe(now);
    });

    test('handles empty latest and exhausted BEFORE responses', async() => {
        let { network, buffer } = makeHistoryBuffer();
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => Promise.resolve({
                commands: [],
                is_end: true,
            })),
        };

        buffer.requestLatestScrollback();
        await flush();

        expect(buffer.history_latest_loaded).toBe(true);
        expect(buffer.flags.chathistory_available).toBe(true);

        ({ network, buffer } = makeHistoryBuffer());
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            before: jest.fn(() => Promise.resolve({
                commands: [],
                is_end: true,
            })),
        };

        buffer.requestScrollback();
        await flush();

        expect(buffer.flags.chathistory_available).toBe(false);
    });

    test('requests latest history once per connection', async() => {
        const { network, buffer } = makeHistoryBuffer();
        const latest = jest.fn(() => Promise.resolve({
            commands: [],
            is_end: false,
        }));
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest,
        };

        buffer.maybeRequestHistory();
        await flush();
        buffer.maybeRequestHistory();
        await flush();

        expect(latest).toHaveBeenCalledTimes(1);
        expect(buffer.auto_history_requested).toBe(true);
    });

    test('fetches older batches when LATEST has no displayable messages', async() => {
        const { s, network, buffer } = makeHistoryBuffer();
        const now = Date.now();
        const hiddenTime = now - 60000;
        const visibleTime = now - 120000;
        buffer.setting('show_joinparts', false);

        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => {
                s.addMessage(buffer, {
                    time: hiddenTime,
                    server_time: hiddenTime,
                    nick: 'bob',
                    message: 'joined',
                    type: 'traffic',
                    tags: { 'kiwi-history': true, 'msgid': 'hidden' },
                });
                return Promise.resolve({
                    commands: [{
                        time: hiddenTime,
                        tags: { 'kiwi-history': true, 'msgid': 'hidden' },
                    }],
                    is_end: true,
                });
            }),
            before: jest.fn(() => {
                s.addMessage(buffer, {
                    time: visibleTime,
                    server_time: visibleTime,
                    nick: 'alice',
                    message: 'older displayable message',
                    type: 'privmsg',
                    tags: { 'kiwi-history': true, 'msgid': 'visible' },
                });
                return Promise.resolve({
                    commands: [{
                        time: visibleTime,
                        tags: { 'kiwi-history': true, 'msgid': 'visible' },
                    }],
                    is_end: false,
                });
            }),
        };

        buffer.requestLatestScrollback();
        await flush();
        await flush();

        expect(network.ircClient.chathistory.latest).toHaveBeenCalledTimes(1);
        expect(network.ircClient.chathistory.before).toHaveBeenCalledTimes(1);
        expect(buffer.getMessages().some((message) => message.irc_id === 'visible'))
            .toBe(true);
    });
});

describe('chathistory reconnect cleanup', () => {
    let client;

    function createClient() {
        const nextClient = new EventEmitter();
        nextClient.raw = jest.fn();
        nextClient.Message = class Message {
            constructor(command, ...params) {
                this.command = command;
                this.params = params;
                this.tags = {};
            }
        };
        return nextClient;
    }

    function createNetwork() {
        return {
            caseUpper(value) {
                return String(value).toUpperCase();
            },
            caseLower(value) {
                return String(value).toLowerCase();
            },
            hasCap(cap) {
                return cap === 'draft/chathistory';
            },
            supports(key) {
                if (key === 'CHATHISTORY') {
                    return '50';
                }
                if (key === 'MSGREFTYPES') {
                    return 'msgid,timestamp';
                }
                return '';
            },
        };
    }

    function installOn(target) {
        chathistoryMiddleware(createNetwork())(target, {}, { use: jest.fn() });
        return target;
    }

    beforeEach(() => {
        client = installOn(createClient());
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves pending requests on socket close and on reconnect', async() => {
        const first = client.chathistory.latest('#test', '*');
        const second = client.chathistory.latest('#test', '*');

        expect(client.raw).toHaveBeenCalledTimes(1);

        client.emit('socket close');

        await expect(first).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });
        await expect(second).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });

        client.chathistory.latest('#test', '*');

        expect(client.raw).toHaveBeenCalledTimes(2);

        const reconnectClient = installOn(createClient());
        const request = reconnectClient.chathistory.latest('#test', '*');

        reconnectClient.emit('connecting');

        await expect(request).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });

        reconnectClient.chathistory.latest('#test', '*');

        expect(reconnectClient.raw).toHaveBeenCalledTimes(2);
    });

    it('does not time out requests while they wait in the queue', async() => {
        jest.useFakeTimers();
        const first = client.chathistory.latest('#one', '*');
        const second = client.chathistory.latest('#two', '*');

        expect(client.raw).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(HISTORY_REQUEST_TIMEOUT_MS - 1000);
        expect(client.raw).toHaveBeenCalledTimes(1);

        client.chathistory.batchCallbacks.resolve('#one', { commands: [] });
        await jest.advanceTimersByTimeAsync(0);
        expect(client.raw).toHaveBeenCalledTimes(2);

        let secondSettled = false;
        second.then(() => {
            secondSettled = true;
        });

        await jest.advanceTimersByTimeAsync(HISTORY_REQUEST_TIMEOUT_MS - 1000);
        await jest.advanceTimersByTimeAsync(0);
        expect(secondSettled).toBe(false);

        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(0);
        expect(secondSettled).toBe(true);
        await expect(first).resolves.toMatchObject({ commands: [] });
        await expect(second).resolves.toMatchObject({ error: 'timeout' });
    });

    it('times out a sent request, advances the queue, and ignores a late response', async() => {
        jest.useFakeTimers();
        const first = client.chathistory.latest('#one', '*');
        const second = client.chathistory.latest('#two', '*');
        const third = client.chathistory.latest('#three', '*');

        await jest.advanceTimersByTimeAsync(HISTORY_REQUEST_TIMEOUT_MS);
        await expect(first).resolves.toMatchObject({ error: 'timeout' });
        expect(client.raw).toHaveBeenCalledTimes(2);

        client.chathistory.batchCallbacks.resolve('#one', { commands: [] });
        expect(client.raw).toHaveBeenCalledTimes(2);

        client.chathistory.batchCallbacks.resolve('#two', { commands: [] });
        expect(client.raw).toHaveBeenCalledTimes(3);

        client.chathistory.batchCallbacks.resolve('#three', { commands: [] });
        await expect(second).resolves.toMatchObject({ commands: [] });
        await expect(third).resolves.toMatchObject({ commands: [] });
    });
});

describe('buffer history reconnect state', () => {
    function makeHistoryBuffer(latest) {
        jest.useFakeTimers();
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        const buffer = appState.addBuffer(network.id, '#test');
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest,
        };

        return { appState, network, buffer };
    }

    afterEach(() => {
        jest.useRealTimers();
    });

    it('clears stale history flags when the network reconnects', () => {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'disconnected';

        const buffer = appState.addBuffer(network.id, '#test');
        buffer.flags.is_requesting_chathistory = true;
        buffer.flags.chathistory_available = false;
        buffer.chathistory_request_count = 3;
        buffer.active_timeout = setTimeout(() => {}, 10000);

        appState.$emit('network.connecting', { network });

        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.chathistory_request_count).toBe(0);
        expect(buffer.active_timeout).toBeNull();

        const autoState = state.create();
        const autoNetwork = autoState.addNetwork('AutoNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        autoNetwork.state = 'disconnected';

        const autoBuffer = autoState.addBuffer(autoNetwork.id, '#test');
        autoBuffer.flags.is_requesting_chathistory = true;
        autoBuffer.flags.chathistory_available = false;
        autoBuffer.flags.names_received = true;
        autoBuffer.chathistory_request_count = 3;

        autoNetwork.ircClient.emit('connecting');

        expect(autoBuffer.flags.is_requesting_chathistory).toBe(false);
        expect(autoBuffer.flags.chathistory_available).toBe(true);
        expect(autoBuffer.flags.names_received).toBe(false);
        expect(autoBuffer.chathistory_request_count).toBe(0);
    });

    it('retries a timed-out request and keeps manual history after exhaustion', async() => {
        let attempts = 0;
        let latest = jest.fn(() => {
            attempts++;
            if (attempts === 1) {
                return Promise.resolve({
                    error: 'timeout',
                    reason: 'History request timed out',
                });
            }
            return Promise.resolve({
                commands: [{ tags: { msgid: 'new-message' } }],
            });
        });
        let { buffer } = makeHistoryBuffer(latest);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);

        expect(latest).toHaveBeenCalledTimes(1);
        expect(buffer.flags.is_requesting_chathistory).toBe(true);
        expect(buffer.flags.chathistory_available).toBe(true);

        await jest.advanceTimersByTimeAsync(3000);
        expect(latest).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(0);
        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);

        latest = jest.fn(() => Promise.resolve({
            error: 'timeout',
            reason: 'History request timed out',
        }));
        ({ buffer } = makeHistoryBuffer(latest));

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(3000);
        await jest.advanceTimersByTimeAsync(6000);
        await jest.advanceTimersByTimeAsync(12000);
        await jest.advanceTimersByTimeAsync(0);

        expect(latest).toHaveBeenCalledTimes(4);
        expect(buffer.flags.is_requesting_chathistory).toBe(false);
        expect(buffer.flags.chathistory_available).toBe(true);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        expect(latest).toHaveBeenCalledTimes(5);
    });

    it('cancels a pending history retry when the network reconnects', async() => {
        const latest = jest.fn(() => Promise.resolve({
            error: 'timeout',
            reason: 'History request timed out',
        }));
        const { appState, network, buffer } = makeHistoryBuffer(latest);

        buffer.requestLatestScrollback();
        await jest.advanceTimersByTimeAsync(0);
        expect(latest).toHaveBeenCalledTimes(1);
        expect(buffer.chathistory_retry_timeout).not.toBeNull();

        appState.$emit('network.connecting', { network });
        expect(buffer.chathistory_retry_timeout).toBeNull();

        await jest.advanceTimersByTimeAsync(3000);
        expect(latest).toHaveBeenCalledTimes(1);
    });
});
