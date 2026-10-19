import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';
import * as TextFormatting from '@/helpers/TextFormatting';

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

    it('confirms the pending message when the echo has a msgid', () => {
        send('hello world');
        receiveEcho('hello world', { msgid: 'abc123' });

        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('abc123');
        expect(messages()[0].is_pending).toBe(false);
        expect(buffer.messagesObj.messageIds.abc123).toBe(messages()[0]);
    });

    it('confirms the pending message when the echo has no msgid', () => {
        send('hello world');
        receiveEcho('hello world');

        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBeUndefined();
        expect(messages()[0].is_pending).toBe(false);
        expect(messages()[0].tags).toEqual({});
    });

    it('matches on the raw text rather than the rendered body', () => {
        send('hello world');
        // The server's rendering can differ (custom formats, relay rewrites)
        receiveEcho('hello world', { msgid: 'abc123' }, 'TestNick (ident@host): hello world');

        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('abc123');
        expect(messages()[0].is_pending).toBe(false);
    });

    it('confirms identical messages in the order they were sent', () => {
        send('same');
        send('same');
        receiveEcho('same', { msgid: 'first' });
        receiveEcho('same', { msgid: 'second' });

        expect(messages()).toHaveLength(2);
        expect(messages()[0].irc_id).toBe('first');
        expect(messages()[1].irc_id).toBe('second');
    });

    it('confirms the only pending message when the server rewrote the text', () => {
        send('hello world');
        receiveEcho('Hello, world!', { msgid: 'abc123' });

        expect(messages()).toHaveLength(1);
        expect(messages()[0].irc_id).toBe('abc123');
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
