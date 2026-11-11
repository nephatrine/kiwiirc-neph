import state from '@/libs/state';

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

describe('latest chathistory boundaries', () => {
    test('keeps older history available and hides the latest-to-live gap', async() => {
        const { s, network, buffer } = makeHistoryBuffer();
        const now = Date.now();
        const earlier = now - 60000;

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

    test('does not disable older history after an empty latest response', async() => {
        const { network, buffer } = makeHistoryBuffer();
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
    });

    test('hides older history when BEFORE reaches the end', async() => {
        const { network, buffer } = makeHistoryBuffer();
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
});

describe('automatic history requests', () => {
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
});

describe('hidden-only latest continuation', () => {
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
