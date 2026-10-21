import state from '@/libs/state';
import Message from '@/libs/Message';
import InputHandler from '@/libs/InputHandler';

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

    it('should use irc_id (msgid) for +reply, NOT internal id', () => {
        const msgId = 'server-msg-id-789';
        const originalMsg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        // Note: originalMsg.id is auto-generated as a number

        buffer.replying_to = originalMsg;

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        // Simulate sending a message via input
        s.$emit('input.raw', 'my reply', { network, buffer });

        expect(saySpy).toHaveBeenCalledWith('#test', 'my reply', { '+reply': msgId });
        // Double check it's NOT the numeric ID
        expect(saySpy.mock.calls[0][2]['+reply']).not.toBe(originalMsg.id);
    });

    it('should fallback to +draft/reply if +reply is denied', () => {
        const msgId = 'server-msg-id-789';
        const originalMsg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });

        buffer.replying_to = originalMsg;
        network.isupport.CLIENTTAGDENY = '+reply'; // Deny +reply, allow others

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

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
