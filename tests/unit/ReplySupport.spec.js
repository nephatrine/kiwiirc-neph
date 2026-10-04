import state from '@/libs/state';
import Message from '@/libs/Message';

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
    });

    it('should include +reply tag in buffer.say() when replying_to is set, but NOT modify body', () => {
        const originalMsg = new Message({
            nick: 'user1',
            message: 'original',
            tags: { msgid: 'msg123' },
        });

        buffer.replying_to = originalMsg;

        // Mock supportsTag to return true for +reply
        network.isupport.CLIENTTAGDENY = ''; // Allow all
        network.enabled_caps = ['message-tags'];

        // Mock ircClient functions
        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        buffer.say('reply message');

        expect(saySpy).toHaveBeenCalledWith('#channel', 'reply message', { '+reply': 'msg123' });
        expect(buffer.replying_to).toBeNull();
    });

    it('should NOT include +reply tag if server does not support it, and NOT modify body', () => {
        const originalMsg = new Message({
            nick: 'user1',
            message: 'original',
            tags: { msgid: 'msg123' },
        });

        buffer.replying_to = originalMsg;

        // Mock supportsTag to return false for +reply
        network.isupport.CLIENTTAGDENY = '+reply';
        network.enabled_caps = ['message-tags'];

        const saySpy = jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});

        buffer.say('reply message');

        expect(saySpy).toHaveBeenCalledWith('#channel', 'reply message', {});
    });
});
