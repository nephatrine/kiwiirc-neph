import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';
import * as TextFormatting from '@/helpers/TextFormatting';
import {
    compareMessages,
    insertMessageInOrder,
    messageNeedsSort,
    orderedMessages
} from '@/libs/bufferTools';

describe('message ordering', () => {
    test('compares messages and reports sort requirements', () => {
        expect(compareMessages(
            { time: 100, instance_num: 1 },
            { time: 200, instance_num: 2 }
        )).toBe(-1);
        expect(compareMessages(
            { time: 200, instance_num: 2 },
            { time: 100, instance_num: 1 }
        )).toBe(1);
        expect(compareMessages(
            { time: 100, instance_num: 2 },
            { time: 100, instance_num: 1 }
        )).toBe(1);
        expect(compareMessages(
            { time: 100, instance_num: 1 },
            { time: 100, instance_num: 1 }
        )).toBe(0);

        const previous = { time: 200, instance_num: 10 };

        expect(messageNeedsSort(previous, { time: 201, instance_num: 11 })).toBe(false);
        expect(messageNeedsSort(previous, { time: 200, instance_num: 11 })).toBe(false);
        expect(messageNeedsSort(previous, { time: 199, instance_num: 12 })).toBe(true);
        expect(messageNeedsSort(previous, { time: 200, instance_num: 9 })).toBe(true);
        expect(messageNeedsSort(null, { time: 1, instance_num: 1 })).toBe(false);
    });

    test('inserts late messages in chronological order', () => {
        const messages = [
            { time: 100, instance_num: 1 },
            { time: 300, instance_num: 3 },
        ];

        insertMessageInOrder(messages, { time: 200, instance_num: 2 });
        insertMessageInOrder(messages, { time: 400, instance_num: 4 });
        insertMessageInOrder(messages, { time: 100, instance_num: 0 });

        expect(messages.map((message) => message.time)).toEqual([100, 100, 200, 300, 400]);
        expect(messages.map((message) => message.instance_num)).toEqual([0, 1, 2, 3, 4]);

        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#channel');

        s.addMessage(buffer, {
            time: 300,
            nick: 'alice',
            message: 'third',
            type: 'privmsg',
        });
        s.addMessage(buffer, {
            time: 100,
            nick: 'alice',
            message: 'first',
            type: 'privmsg',
        });
        s.addMessage(buffer, {
            time: 400,
            nick: 'alice',
            message: 'fourth',
            type: 'privmsg',
        });

        expect(buffer.getMessages().map((message) => message.message)).toEqual([
            'first',
            'third',
            'fourth',
        ]);
        s.$destroy();
    });

    test('shows ignored users in queries but hides them in channels', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const alice = s.addUser(network.id, { nick: 'Alice' });
        alice.ignore = true;
        const channel = s.addBuffer(network.id, '#channel');
        const query = s.addBuffer(network.id, 'Alice');

        s.addMessage(channel, {
            time: 100,
            nick: 'Alice',
            message: 'channel message',
            type: 'privmsg',
        });
        s.addMessage(query, {
            time: 200,
            nick: 'Alice',
            message: 'query message',
            type: 'privmsg',
        });

        expect(orderedMessages(channel)).toEqual([]);
        expect(orderedMessages(query).map((message) => message.message))
            .toEqual(['query message']);
        s.$destroy();
    });
});

describe('message echo confirmation', () => {
    let s;
    let network;
    let handler;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // addNetwork() only sets connection.nick; nick is populated on registration
        network.nick = 'TestNick';
        // echo-message without labeled-response and without message-ids
        network.enabled_caps = ['echo-message', 'message-tags'];
        handler = new InputHandler(s);
        buffer = s.getOrAddBufferByName(network.id, '#chan');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    function messages() {
        return buffer.getMessages();
    }

    function send(text) {
        handler.processLine(text, { network, buffer });
    }

    function receiveEcho(text, tags, rendered) {
        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: rendered || text,
            raw_text: text,
            type: 'privmsg',
            tags: tags || {},
        });
    }

    it('confirms pending messages by msgid, raw text, order, or rewrite', () => {
        const confirmed = jest.fn();
        s.$on('message.confirmed', confirmed);

        send('hello world');
        receiveEcho('hello world', { msgid: 'abc123' });
        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('abc123');
        expect(messages()[0].is_pending).toBe(false);
        expect(buffer.messagesObj.messageIds.abc123).toBe(messages()[0]);
        expect(confirmed).toHaveBeenCalledWith({
            message: messages()[0],
            buffer,
        });

        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        network.enabled_caps = ['echo-message', 'message-tags'];
        handler = new InputHandler(s);
        buffer = s.getOrAddBufferByName(network.id, '#chan');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        send('hello world');
        receiveEcho('hello world');
        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBeUndefined();
        expect(messages()[0].is_pending).toBe(false);
        expect(messages()[0].tags).toEqual({});

        send('same');
        send('same');
        receiveEcho('same', { msgid: 'first' });
        receiveEcho('same', { msgid: 'second' });
        expect(messages()).toHaveLength(3);
        expect(messages()[1].irc_id).toBe('first');
        expect(messages()[2].irc_id).toBe('second');

        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        network.enabled_caps = ['echo-message', 'message-tags'];
        handler = new InputHandler(s);
        buffer = s.getOrAddBufferByName(network.id, '#chan');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        send('hello world');
        receiveEcho('hello world', { msgid: 'raw123' }, 'TestNick (ident@host): hello world');
        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('raw123');
        expect(messages()[0].is_pending).toBe(false);

        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        network.enabled_caps = ['echo-message', 'message-tags'];
        handler = new InputHandler(s);
        buffer = s.getOrAddBufferByName(network.id, '#chan');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        send('hello world');
        receiveEcho('Hello, world!', { msgid: 'rewrite123' });
        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('rewrite123');
        expect(messages()[0].is_pending).toBe(false);
    });

    it('does not guess when more than one message is pending', () => {
        send('first message');
        send('second message');
        receiveEcho('rewritten', { msgid: 'abc123' });

        expect(messages()).toHaveLength(3);
        expect(messages()[0].is_pending).toBe(true);
        expect(messages()[1].is_pending).toBe(true);
        expect(messages()[2].is_pending).toBe(false);
    });

    it('does not confirm a pending message from a chathistory replay', () => {
        send('hello world');
        receiveEcho('hello world', { 'kiwi-history': true });

        expect(messages()).toHaveLength(2);
        expect(messages()[0].is_pending).toBe(true);
    });

    it('still reverts a genuinely unconfirmed message after the timeout', () => {
        jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
        jest.useFakeTimers();
        send('hello world');
        jest.advanceTimersByTime(60000);

        expect(messages()).toHaveLength(2);
        expect(messages()[0].is_pending).toBe(false);
        expect(messages()[0].type).toBe('error');
        expect(messages()[1].type).toBe('error');
        expect(messages()[1].message).toBe('error_confirm_timeout');
    });
});
