import state from '@/libs/state';
import Message from '@/libs/Message';

describe('draft/oper-tag', () => {
    it('marks messages with draft/oper', () => {
        let empty = new Message({
            nick: 'Oper',
            message: 'hello',
            tags: { 'draft/oper': '' },
        });
        expect(empty.is_oper).toBe(true);
        expect(empty.is_bot).toBe(false);

        let valued = new Message({
            nick: 'Oper',
            message: 'hello',
            tags: { 'draft/oper': 'launchd' },
        });
        expect(valued.is_oper).toBe(true);
    });

    it('does not use the unprefixed oper tag', () => {
        let message = new Message({
            nick: 'Oper',
            message: 'hello',
            tags: { oper: '' },
        });
        expect(message.is_oper).toBe(false);
    });

    it('keeps bot and oper flags independent', () => {
        let message = new Message({
            nick: 'OperBot',
            message: 'hello',
            tags: { 'bot': true, 'draft/oper': '' },
        });
        expect(message.is_bot).toBe(true);
        expect(message.is_oper).toBe(true);
    });

    it('updates oper status when a heuristic echo arrives', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        let buffer = s.addBuffer(network.id, '#test');

        let local = s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: 'hello',
            raw_text: 'hello',
            type: 'privmsg',
            is_pending: true,
        });
        expect(local.is_oper).toBe(false);

        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: 'hello',
            raw_text: 'hello',
            type: 'privmsg',
            tags: { 'draft/oper': '', 'msgid': 'oper-msgid' },
        });

        let messages = buffer.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe(local);
        expect(messages[0].is_oper).toBe(true);
        expect(messages[0].irc_id).toBe('oper-msgid');
    });

    it('updates oper status when a labeled echo arrives', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        let buffer = s.addBuffer(network.id, '#test');

        let local = s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: 'hello',
            raw_text: 'hello',
            type: 'privmsg',
            is_pending: true,
        });
        buffer.messagesObj.messageLabels['label-1'] = local;

        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: 'hello',
            raw_text: 'hello',
            type: 'privmsg',
            tags: { 'draft/oper': '', 'label': 'label-1', 'msgid': 'oper-msgid' },
        });

        let messages = buffer.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe(local);
        expect(messages[0].is_oper).toBe(true);
        expect(messages[0].irc_id).toBe('oper-msgid');
    });
});
