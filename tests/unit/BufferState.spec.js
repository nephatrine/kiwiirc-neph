import state from '@/libs/state';

describe('raw buffer scrollback', () => {
    let s;
    let network;
    let raw;
    let channel;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        raw = s.addBuffer(network.id, '*raw');
        channel = s.addBuffer(network.id, '#chan');
    });

    it('resolves raw scrollback from defaults, network, and buffer overrides', () => {
        expect(raw.setting('scrollback_size')).toBe(500);

        network.setting('raw_scrollback_size', 5000);
        expect(raw.setting('scrollback_size')).toBe(5000);

        raw.setting('scrollback_size', 100);
        expect(raw.setting('scrollback_size')).toBe(100);

        expect(channel.setting('scrollback_size'))
            .toBe(s.setting('buffers.scrollback_size'));
    });
});

describe('message scroll targets', () => {
    it('keeps a pending scroll target on the buffer', async() => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const channel = s.addBuffer(network.id, '#chan');
        const emit = jest.spyOn(s, '$emit');

        const scrolled = channel.scrollToMessage(42);

        expect(channel.pending_scroll_id).toBe(42);
        expect(emit).toHaveBeenCalledWith('messagelist.scrollto', { id: 42 });

        s.$emit('messagelist.scrolledto', { id: 42, buffer: channel });
        await expect(scrolled).resolves.toBe(true);
        expect(channel.pending_scroll_id).toBeNull();
    });
});

describe('channel defaults', () => {
    it('uses the global show_joinparts default and a per-buffer override', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const channel = s.addBuffer(network.id, '#chan');

        expect(channel.setting('show_joinparts')).toBe(false);

        s.setting('buffers.show_joinparts', true);
        expect(channel.setting('show_joinparts')).toBe(true);

        channel.setting('show_joinparts', false);
        expect(channel.setting('show_joinparts')).toBe(false);
        expect(s.setting('buffers.show_joinparts')).toBe(true);
    });
});

describe('user prefixes', () => {
    it('shows fixed Twitch prefixes without marking the user as an op', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        network.isupport.PREFIX = [
            { symbol: '@', mode: 'o' },
            { symbol: '+', mode: 'v' },
        ];
        let buffer = s.addBuffer(network.id, '#alice');
        let user = network.ensureTwitchUser('alice', 'alice', 'alice.tmi.twitch.tv', {});

        network.applyTwitchUserModes(buffer, user, { vip: '1' });

        expect(buffer.userPrefixes()).toEqual([
            { symbol: '~', mode: 'q' },
            { symbol: '@', mode: 'o' },
            { symbol: '%', mode: 'h' },
            { symbol: '+', mode: 'v' },
        ]);
        expect(buffer.userModePrefix(user)).toBe('~%');
        expect(buffer.userMode(user)).toBe('q');
        expect(buffer.isUserAnOp('alice')).toBe(false);
        expect(buffer.users[user.nick]).toBeUndefined();
    });

    it('hides all user prefixes when showPrefix is disabled', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        network.isupport.PREFIX = [
            { symbol: '@', mode: 'o' },
            { symbol: '+', mode: 'v' },
        ];
        let buffer = s.addBuffer(network.id, '#alice');
        let user = network.ensureTwitchUser('alice', 'alice', 'alice.tmi.twitch.tv', {});

        network.applyTwitchUserModes(buffer, user, { vip: '1' });
        expect(buffer.userModePrefix(user)).toBe('~%');

        s.setting('showPrefix', false);
        expect(buffer.userModePrefix(user)).toBe('');
    });

    it('marks a Twitch channel owner as founder when they join without NAMES', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'alice',
            username: 'alice',
            host: 'alice.tmi.twitch.tv',
        });

        let user = s.getUser(network.id, 'alice');
        expect(buffer.userModes(user)).toEqual(['q']);
        expect(buffer.userModePrefix(user)).toBe('~');
        expect(buffer.userMode(user)).toBe('q');
        expect(buffer.isUserAnOp('alice')).toBe(false);
        expect(buffer.users.ALICE).toBe(user);
    });

    it('does not mark regular Twitch chatters as founders', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'bob',
            username: 'bob',
            host: 'bob.tmi.twitch.tv',
        });

        let user = s.getUser(network.id, 'bob');
        expect(buffer.userModes(user)).toEqual([]);
        expect(buffer.userModePrefix(user)).toBe('');
    });

    it('does not apply the Twitch founder prefix on other networks', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'alice',
            username: 'alice',
            host: 'example.com',
        });

        let user = s.getUser(network.id, 'alice');
        expect(buffer.userModes(user)).toEqual([]);
        expect(buffer.userModePrefix(user)).toBe('');
    });

    it('keeps normal network prefixes unchanged', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        network.isupport.PREFIX = [{ symbol: '@', mode: 'o' }];
        let buffer = s.addBuffer(network.id, '#chan');
        s.addUser(network.id, { nick: 'bob' });
        let user = s.getUser(network.id, 'bob');
        user.buffers[buffer.id] = {
            modes: ['o'],
            buffer,
        };

        expect(buffer.userPrefixes()).toEqual([{ symbol: '@', mode: 'o' }]);
        expect(buffer.userModePrefix(user)).toBe('@');
        expect(buffer.userMode(user)).toBe('o');
        expect(buffer.isUserAnOp('bob')).toBe(true);
    });
});

describe('channel topics', () => {
    it('defaults Twitch channel topics and preserves real or non-Twitch topics', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let channel = s.addBuffer(twitch.id, '#theprimeagen');

        expect(channel.topic).toBe('https://twitch.tv/theprimeagen');

        channel.topic = 'A real topic';
        expect(channel.topic).toBe('A real topic');

        let other = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let otherChannel = s.addBuffer(other.id, '#chan');
        expect(otherChannel.topic).toBe('');

        let query = s.addBuffer(twitch.id, 'theprimeagen');
        expect(query.topic).toBe('');
    });
});

describe('WHO loop', () => {
    let s;
    let network;

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.state = 'connected';
        network.ircClient.who = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        s.$destroy();
    });

    it('polls a small channel once every three minutes', () => {
        const channel = s.addBuffer(network.id, '#chan');
        channel.joined = true;

        jest.advanceTimersByTime(30000);
        expect(network.ircClient.who).not.toHaveBeenCalled();

        jest.advanceTimersByTime(150000);
        expect(network.ircClient.who).toHaveBeenCalledWith('#chan');
    });

    it('does not poll a channel with more than 100 users', () => {
        const channel = s.addBuffer(network.id, '#chan');
        channel.joined = true;
        for (let i = 0; i < 101; i += 1) {
            s.addUserToBuffer(channel, { nick: `user${i}` });
        }

        jest.advanceTimersByTime(180000);
        expect(network.ircClient.who).not.toHaveBeenCalled();

        jest.advanceTimersByTime(180000);
        expect(network.ircClient.who).not.toHaveBeenCalled();
    });

    it('still polls a channel with exactly 100 users', () => {
        const channel = s.addBuffer(network.id, '#chan');
        channel.joined = true;
        for (let i = 0; i < 100; i += 1) {
            s.addUserToBuffer(channel, { nick: `user${i}` });
        }

        jest.advanceTimersByTime(180000);
        expect(network.ircClient.who).toHaveBeenCalledWith('#chan');
    });

    it('does not let a removed buffer poll its replacement', () => {
        const oldChannel = s.addBuffer(network.id, '#chan');
        oldChannel.joined = true;
        s.removeBuffer(oldChannel);

        const newChannel = s.addBuffer(network.id, '#chan');
        newChannel.joined = true;

        jest.advanceTimersByTime(180000);
        expect(network.ircClient.who).toHaveBeenCalledTimes(1);
        expect(network.ircClient.who).toHaveBeenCalledWith('#chan');
    });
});

describe('query user status', () => {
    it('does not WHO a query partner on Twitch', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let query = s.addBuffer(network.id, 'alice');
        network.ircClient.who = jest.fn();

        query.initUserStatus();

        expect(network.ircClient.who).not.toHaveBeenCalled();
    });

    it('WHO a query partner on a normal network', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let query = s.addBuffer(network.id, 'alice');
        network.ircClient.who = jest.fn();

        query.initUserStatus();

        expect(network.ircClient.who).toHaveBeenCalledWith('alice');
    });
});

describe('buffer history trimming', () => {
    let created;

    function makeContext(options = {}) {
        const s = state.create();
        s.setting('buffers.scrollback_size', 2);
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        if (options.chathistory !== false) {
            network.enabled_caps = ['draft/chathistory'];
        }
        const buffer = s.addBuffer(network.id, '#channel');
        created.push(s);
        return { s, network, buffer };
    }

    function addMessages(s, buffer, count) {
        for (let i = 0; i < count; i += 1) {
            s.addMessage(buffer, {
                time: Date.now() + i,
                nick: 'user',
                message: 'message ' + i,
                irc_id: 'id' + i,
                tags: {},
                type: 'privmsg',
            });
        }
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        jest.useRealTimers();
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('restores chathistory after trimming and anchors from the oldest message', () => {
        jest.useFakeTimers();
        let { s, network, buffer } = makeContext();
        addMessages(s, buffer, 4);
        buffer.flag('chathistory_available', false);
        buffer.chathistory_cursor = { irc_id: 'hidden-before-trim' };

        expect(buffer.trimMessages()).toBe(true);
        expect(buffer.chathistory_cursor).toBeNull();
        expect(buffer.getMessages()).toHaveLength(2);
        expect(buffer.getMessages()[0].irc_id).toBe('id2');
        expect(buffer.flags.chathistory_available).toBe(true);

        const history = network.ircClient.chathistory;
        history.isSupported = () => true;
        history.supportedRefTypes = () => ['msgid'];
        history.before = jest.fn(() => Promise.resolve(null));

        buffer.requestScrollback();

        expect(history.before).toHaveBeenCalledWith('#channel', 'id2');

        ({ s, network, buffer } = makeContext({ chathistory: false }));
        addMessages(s, buffer, 4);
        buffer.flag('chathistory_available', false);

        expect(buffer.trimMessages()).toBe(true);
        expect(buffer.flags.chathistory_available).toBe(false);
    });

    test('delays trimming, can be cancelled, and skips while scrolled up', () => {
        jest.useFakeTimers();
        const { s, buffer } = makeContext();
        addMessages(s, buffer, 4);

        buffer.scheduleTrim();
        expect(buffer.trim_timeout).toBeTruthy();
        expect(buffer.getMessages()).toHaveLength(4);

        buffer.cancelScheduledTrim();
        jest.advanceTimersByTime(30000);
        expect(buffer.trim_timeout).toBeNull();
        expect(buffer.getMessages()).toHaveLength(4);

        buffer.scheduleTrim();
        jest.advanceTimersByTime(30000);
        expect(buffer.trim_timeout).toBeNull();
        expect(buffer.getMessages()).toHaveLength(2);

        const scrolled = makeContext();
        scrolled.buffer.isMessageTrimming = false;
        addMessages(scrolled.s, scrolled.buffer, 4);

        scrolled.buffer.scheduleTrim();

        expect(scrolled.buffer.trim_timeout).toBeNull();
        jest.advanceTimersByTime(30000);
        expect(scrolled.buffer.getMessages()).toHaveLength(4);
    });

    test('marks the message list changed when a forced trim removes messages', () => {
        jest.useFakeTimers();
        const { s, buffer } = makeContext();
        addMessages(s, buffer, 4);
        buffer.isMessageTrimming = false;

        const countBefore = buffer.message_count;
        expect(buffer.trimMessages(true)).toBe(true);
        expect(buffer.getMessages()).toHaveLength(2);
        expect(buffer.message_count).toBe(countBefore + 1);
    });

    test('trims internal buffers immediately without the grace period', () => {
        jest.useFakeTimers();
        const { s, network } = makeContext();

        ['*raw', '*help', '*'].forEach((bufferName) => {
            const internalBuffer = s.addBuffer(network.id, bufferName);
            if (internalBuffer.isRaw()) {
                network.setting('raw_scrollback_size', 2);
            }
            internalBuffer.isMessageTrimming = false;

            addMessages(s, internalBuffer, 4);

            expect(internalBuffer.getMessages()).toHaveLength(2);
            expect(internalBuffer.trim_timeout).toBeNull();
        });
    });

    test('does not build live history segments for internal buffers', () => {
        jest.useFakeTimers();
        const { s, network } = makeContext();

        const raw = s.addBuffer(network.id, '*raw');
        network.setting('raw_scrollback_size', 5000);

        for (let i = 0; i < 1000; i += 1) {
            s.addMessage(raw, {
                time: Date.now() + i,
                nick: '',
                message: '[S] raw line ' + i,
                type: 'message',
                tags: {},
            });
        }

        expect(raw.getMessages()).toHaveLength(1000);
        expect(raw.historySegments).toHaveLength(0);
        expect(raw.historyGaps).toHaveLength(0);
    });
});

describe('BufferState.say echo confirmation', () => {
    let created;

    function fresh(caps) {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = caps;
        const buffer = s.addBuffer(network.id, '#channel');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        created.push(s);
        return { s, network, buffer };
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        jest.restoreAllMocks();
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('confirms labeled and unlabeled echoes without duplicating', () => {
        let ctx = fresh(['echo-message', 'labeled-response']);
        let url = 'https://files.example/upload.txt';

        ctx.buffer.say(url);

        let local = ctx.buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);
        expect(local.tags.label).toBeTruthy();

        let count = ctx.buffer.getMessages().length;
        ctx.s.addMessage(ctx.buffer, {
            time: Date.now(),
            nick: ctx.network.nick,
            message: url,
            raw_text: url,
            tags: { label: local.tags.label },
            type: 'privmsg',
        });

        expect(ctx.buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);

        ctx = fresh(['echo-message']);
        url = 'https://files.example/upload.txt';

        ctx.buffer.say(url);

        local = ctx.buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);

        count = ctx.buffer.getMessages().length;
        ctx.s.addMessage(ctx.buffer, {
            time: Date.now(),
            nick: ctx.network.nick,
            message: url,
            raw_text: url,
            tags: {},
            type: 'privmsg',
        });

        expect(ctx.buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);
    });
});

describe('raw buffer backlog', () => {
    let s;
    let network;
    let raw;

    function rawMessage(index) {
        return {
            time: Date.now() + index,
            nick: '',
            message: '[S] line ' + index,
        };
    }

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        raw = s.addBuffer(network.id, '*raw');
    });

    afterEach(() => {
        s.$destroy();
    });

    test('keeps hidden raw lines until opened and caps the backlog', () => {
        raw.queueRawMessage(rawMessage(1));
        raw.queueRawMessage(rawMessage(2));

        expect(raw.getMessages()).toHaveLength(0);
        expect(raw.rawBacklog).toHaveLength(2);

        raw.isVisible = true;

        expect(raw.rawBacklog).toHaveLength(0);
        expect(raw.getMessages()).toHaveLength(2);
        expect(raw.getMessages()[0].message).toBe('[S] line 1');
        expect(raw.getMessages()[1].message).toBe('[S] line 2');

        raw.isVisible = false;
        raw.setting('scrollback_size', 2);
        raw.queueRawMessage(rawMessage(1));
        raw.queueRawMessage(rawMessage(2));
        raw.queueRawMessage(rawMessage(3));

        expect(raw.rawBacklog).toHaveLength(2);
        expect(raw.rawBacklog[0].message).toBe('[S] line 2');
        expect(raw.rawBacklog[1].message).toBe('[S] line 3');
    });
});
