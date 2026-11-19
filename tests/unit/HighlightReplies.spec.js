import state from '@/libs/state';

describe('highlight replies', () => {
    let created;

    function fresh() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        const buffer = s.addBuffer(network.id, '#test');
        s.addUserToBuffer(buffer, { nick: 'TestNick' });
        s.addUserToBuffer(buffer, { nick: 'OtherUser' });
        created.push(s);

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

        return {
            s, network, buffer, addOriginal, addReply,
        };
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('highlights replies to our own messages unless disabled per network', () => {
        let ctx = fresh();
        ctx.addOriginal('TestNick', 'self-msg');

        expect(ctx.addReply('self-msg').isHighlight).toBe(true);

        ctx = fresh();
        ctx.network.setting('highlightReplies', false);
        ctx.addOriginal('TestNick', 'self-msg');

        expect(ctx.addReply('self-msg').isHighlight).toBe(false);
    });

    test('does not highlight replies to another user', () => {
        const ctx = fresh();
        ctx.addOriginal('OtherUser', 'other-msg');

        expect(ctx.addReply('other-msg').isHighlight).toBe(false);
    });
});
