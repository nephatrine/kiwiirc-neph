import state from '@/libs/state';

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
