import state from '@/libs/state';

describe('HighlightSuppression', () => {
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
        network.ircClient.user.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        s.addUserToBuffer(buffer, { nick: 'TestNick' });
        s.addUserToBuffer(buffer, { nick: 'OtherUser' });

        // Set up highlights in state
        s.setSetting('user_settings.highlights', 'secret-word apple');
        s.setSetting('user_settings.teamHighlights', true);
    });

    it('should NOT highlight when current user mentions their own nick', () => {
        const msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: 'hello TestNick!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('should NOT highlight when current user uses a highlight word', () => {
        const msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: 'this is a secret-word',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('should NOT highlight when current user uses team highlights', () => {
        const msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: 'hey @everyone',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('should STILL highlight when another user mentions current user', () => {
        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'hello TestNick!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(true);
    });

    it('should STILL highlight when another user uses a highlight word', () => {
        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'this is an apple',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(true);
    });

    it('should STILL highlight when another user uses team highlights', () => {
        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@channel check this out',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(true);
    });
});
