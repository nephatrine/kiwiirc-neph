import state from '@/libs/state';

describe('highlight replies', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        s.addUserToBuffer(buffer, { nick: 'TestNick' });
        s.addUserToBuffer(buffer, { nick: 'OtherUser' });
    });

    afterEach(() => {
        s.$destroy();
    });

    function addOriginal(nick, ircId) {
        return s.addMessage(buffer, {
            nick,
            message: 'original',
            type: 'privmsg',
            irc_id: ircId,
            time: 100,
        });
    }

    function addReply(ircId) {
        return s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'reply',
            type: 'privmsg',
            tags: { '+reply': ircId },
            time: 200,
        });
    }

    test('highlights replies to our own messages by default', () => {
        addOriginal('TestNick', 'self-msg');

        expect(addReply('self-msg').isHighlight).toBe(true);
    });

    test('does not highlight replies when disabled per network', () => {
        network.setting('highlightReplies', false);
        addOriginal('TestNick', 'self-msg');

        expect(addReply('self-msg').isHighlight).toBe(false);
    });

    test('does not highlight replies to another user', () => {
        addOriginal('OtherUser', 'other-msg');

        expect(addReply('other-msg').isHighlight).toBe(false);
    });
});
