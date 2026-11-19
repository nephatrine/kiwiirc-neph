import state from '@/libs/state';
import Message from '@/libs/Message';
import InputHandler from '@/libs/InputHandler';
import { shouldShowReplyPreview } from '@/libs/bufferTools';

describe('reply preview grouping', () => {
    const BASE_TIME = 1000000;

    function makeMessage(opts = {}) {
        const nick = opts.nick || 'Alice';
        return {
            nick,
            bridged_nick: opts.bridged_nick || '',
            reply: opts.reply,
            type: opts.type || 'privmsg',
            time: opts.time || BASE_TIME,
            day_num: typeof opts.day_num === 'undefined' ? 100 : opts.day_num,
            condenseKey() {
                return this.nick + '\n' + this.bridged_nick;
            },
        };
    }

    function previewFlags(messages) {
        return messages.map((message, idx) => (
            shouldShowReplyPreview(messages, message, idx)
        ));
    }

    it('groups consecutive replies by target, author, time, day, and type', () => {
        let messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([true, false, false]);

        messages = [
            makeMessage({ reply: 'first' }),
            makeMessage({ reply: 'second' }),
            makeMessage({ reply: 'second' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true, false]);

        messages = [
            makeMessage({ nick: 'Alice', reply: 'target' }),
            makeMessage({ nick: 'Bob', reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target', time: BASE_TIME + 60000 }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target', day_num: 101 }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target', type: 'privmsg' }),
            makeMessage({ reply: 'target', type: 'action' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);
    });

    it('handles non-reply and first-message cases', () => {
        let messages = [
            makeMessage(),
            makeMessage({ reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([false, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage(),
        ];
        expect(previewFlags(messages)).toEqual([true, false]);
    });
});

describe('ReplySupport', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        buffer = s.addBuffer(network.id, '#channel');
    });

    it('should parse +reply and +draft/reply tags', () => {
        const msg1 = new Message({
            nick: 'user1',
            message: 'hello',
            tags: { '+reply': 'msg123' },
        });
        expect(msg1.reply).toBe('msg123');

        const msg2 = new Message({
            nick: 'user2',
            message: 'world',
            tags: { '+draft/reply': 'msg456' },
        });
        expect(msg2.reply).toBe('msg456');

        const msg3 = new Message({
            nick: 'user3',
            message: 'twitch',
            tags: { 'reply-parent-msg-id': 'msg789' },
        });
        expect(msg3.reply).toBe('msg789');
    });

    it('includes +reply when allowed, omits it when denied, and keeps the body', () => {
        let originalMsg = new Message({
            nick: 'user1',
            message: 'original',
            tags: { msgid: 'msg123' },
        });

        buffer.replying_to = originalMsg;

        // Mock supportsTag to return true for +reply
        network.isupport.CLIENTTAGDENY = ''; // Allow all
        network.enabled_caps = ['message-tags'];

        // Mock ircClient functions
        let saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        buffer.say('reply message');

        expect(saySpy).toHaveBeenCalledWith('#channel', 'reply message', { '+reply': 'msg123' });
        expect(buffer.replying_to).toBeNull();

        originalMsg = new Message({
            nick: 'user1',
            message: 'original',
            tags: { msgid: 'msg123' },
        });

        buffer.replying_to = originalMsg;

        // Mock supportsTag to return false for +reply and +draft/reply
        network.isupport.CLIENTTAGDENY = '+reply,+draft/reply';
        network.enabled_caps = ['message-tags'];
        saySpy.mockClear();

        buffer.say('reply message');

        expect(saySpy).toHaveBeenCalledWith('#channel', 'reply message', {});
    });

    it('should use reply-parent-msg-id for Twitch replies', () => {
        network.connection.server = 'irc.chat.twitch.tv';
        network.enabled_caps = ['twitch.tv/tags'];

        const originalMsg = new Message({
            nick: 'user1',
            message: 'original',
            irc_id: 'msg123',
        });

        buffer.replying_to = originalMsg;

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        buffer.say('reply message');

        expect(saySpy).toHaveBeenCalledWith('#channel', 'reply message', {
            'reply-parent-msg-id': 'msg123',
        });
    });
});

describe('ThreadedReplies', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
            port: 6667,
        });
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        network.enabled_caps = ['message-tags'];
        network.isupport.CLIENTTAGDENY = '';
        /* eslint-disable no-new */
        new InputHandler(s);
    });

    it('should use irc_id (msgid) for +reply, falling back to +draft/reply', () => {
        const msgId = 'server-msg-id-789';
        let originalMsg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        // Note: originalMsg.id is auto-generated as a number

        buffer.replying_to = originalMsg;

        let saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        // Simulate sending a message via input
        s.$emit('input.raw', 'my reply', { network, buffer });

        expect(saySpy).toHaveBeenCalledWith('#test', 'my reply', { '+reply': msgId });
        // Double check it's NOT the numeric ID
        expect(saySpy.mock.calls[0][2]['+reply']).not.toBe(originalMsg.id);

        originalMsg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        buffer.replying_to = originalMsg;
        network.isupport.CLIENTTAGDENY = '+reply'; // Deny +reply, allow others
        saySpy.mockClear();

        s.$emit('input.raw', 'my reply', { network, buffer });

        expect(saySpy).toHaveBeenCalledWith('#test', 'my reply', { '+draft/reply': msgId });
    });

    it('should use reply-parent-msg-id for Twitch replies', () => {
        network.connection.server = 'irc.chat.twitch.tv';
        network.enabled_caps = ['twitch.tv/tags'];

        const originalMsg = new Message({
            nick: 'sender',
            message: 'hello',
            irc_id: 'twitch-msg-id',
        });

        buffer.replying_to = originalMsg;

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        s.$emit('input.raw', 'my reply', { network, buffer });

        expect(saySpy).toHaveBeenCalledWith('#test', 'my reply', {
            'reply-parent-msg-id': 'twitch-msg-id',
        });
    });

    it('should NOT send reply tag if irc_id is missing (pending message)', () => {
        const originalMsg = new Message({
            nick: 'TestNick',
            message: 'pending message',
            // No msgid yet
        });
        originalMsg.is_pending = true;

        buffer.replying_to = originalMsg;

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        s.$emit('input.raw', 'reply to pending', { network, buffer });

        expect(saySpy).toHaveBeenCalledWith('#test', 'reply to pending', {});
    });
});
