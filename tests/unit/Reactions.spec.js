import state from '@/libs/state';
import Message from '@/libs/Message';
import { theMiddleware } from '@/libs/ReactionMiddleware';

describe('ReactionMiddleware', () => {
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
        // Enable message-tags and draft/react support in isupport
        network.enabled_caps = ['message-tags'];
        network.isupport.CLIENTTAGDENY = '';
        network.ircClient.user.nick = 'TestNick';
    });

    it('should add a reaction to an existing message', () => {
        const client = network.ircClient;
        const msgId = 'msg-123';
        const msg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        buffer.addMessage(msg);

        // Simulate a TAGMSG with a reaction
        const message = {
            nick: 'reactor',
            params: ['#test'],
            tags: {
                '+draft/react': '👍',
                '+reply': msgId,
            },
        };

        theMiddleware(network, 'TAGMSG', message, '', client, () => {});

        // The middleware should have processed the reaction
        expect(msg.reactions['👍']).toBeDefined();
        expect(msg.reactions['👍'].count).toBe(1);
        expect(msg.reactions['👍'].users).toContain('reactor');
    });

    it('should remove a reaction via +draft/unreact', () => {
        const client = network.ircClient;
        const msgId = 'msg-123';
        const msg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        buffer.addMessage(msg);

        // Add initial reaction
        const message1 = {
            nick: 'reactor',
            params: ['#test'],
            tags: {
                '+draft/react': '👍',
                '+reply': msgId,
            },
        };
        theMiddleware(network, 'TAGMSG', message1, '', client, () => {});
        expect(msg.reactions['👍'].count).toBe(1);

        // Unreact
        const message2 = {
            nick: 'reactor',
            params: ['#test'],
            tags: {
                '+draft/unreact': '👍',
                '+reply': msgId,
            },
        };
        theMiddleware(network, 'TAGMSG', message2, '', client, () => {});

        expect(msg.reactions['👍']).toBeUndefined();
    });

    it('should track our own reactions', () => {
        const client = network.ircClient;
        const msgId = 'msg-123';
        const msg = new Message({
            nick: 'sender',
            message: 'hello',
            tags: { msgid: msgId },
        });
        buffer.addMessage(msg);

        // React as ourselves
        const message = {
            nick: 'TestNick',
            params: ['#test'],
            tags: {
                '+draft/react': '🔥',
                '+reply': msgId,
            },
        };
        theMiddleware(network, 'TAGMSG', message, '', client, () => {});

        expect(msg.reactions['🔥'].reacted).toBe(true);
    });

    it('should not add reactions if target message is not found', () => {
        const client = network.ircClient;
        const message = {
            nick: 'reactor',
            params: ['#test'],
            tags: {
                '+draft/react': '👍',
                '+reply': 'nonexistent',
            },
        };
        theMiddleware(network, 'TAGMSG', message, '', client, () => {});
        // No error should occur
    });

    it('should correlate message echoes and update local IDs', () => {
        const text = 'test message';
        const msgId = 'server-id-456';

        // 1. Add a local message
        s.addMessage(buffer, {
            nick: 'TestNick',
            message: text,
            time: Date.now(),
        });

        const localMsg = buffer.getMessages()[0];
        expect(typeof localMsg.id).toBe('number');
        expect(localMsg.irc_id).toBeUndefined();

        // 2. Receive an echo of that message with a server msgid
        s.addMessage(buffer, {
            nick: 'TestNick',
            message: text,
            time: Date.now(),
            tags: { msgid: msgId },
        });

        // 3. The local message should have been updated with irc_id
        expect(typeof localMsg.id).toBe('number');
        expect(localMsg.irc_id).toBe(msgId);
        expect(buffer.getMessages().length).toBe(1); // No duplicates
        expect(buffer.messagesObj.messageIds[msgId]).toBe(localMsg);
    });
});
