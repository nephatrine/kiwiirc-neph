import state from '@/libs/state';
import ThemeManager from '@/libs/ThemeManager';

describe('HighlightSuppression', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        if (!document.querySelector('.kiwi-wrap')) {
            let wrap = document.createElement('div');
            wrap.className = 'kiwi-wrap';
            document.body.appendChild(wrap);
        }
        ThemeManager.instance(s);
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

    it('highlights team mentions followed by punctuation', () => {
        const messages = [
            '@channel!',
            '@channel?',
            '@channel:',
            '@channel)',
            '@channel-',
            '@here,',
            '@everyone.',
            '(@channel)',
        ];

        messages.forEach((message) => {
            const msg = s.addMessage(buffer, {
                nick: 'OtherUser',
                message,
                time: Date.now(),
            });
            expect(msg.isHighlight).toBe(true);
        });
    });

    it('does not highlight the retired @everybody token', () => {
        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@everybody!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('highlights team mentions regardless of case and formatting', () => {
        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '\x02@Channel!\x02',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(true);
    });

    it('does not highlight team mentions inside words or URLs', () => {
        const word = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@channelized',
            time: Date.now(),
        });
        expect(word.isHighlight).toBe(false);

        const url = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'https://example.com/@channel',
            time: Date.now(),
        });
        expect(url.isHighlight).toBe(false);
    });

    it('does not highlight @here while away, but still highlights @channel', () => {
        network.away = 'away';

        const here = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@here!',
            time: Date.now(),
        });
        expect(here.isHighlight).toBe(false);

        const channel = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@channel!',
            time: Date.now(),
        });
        expect(channel.isHighlight).toBe(true);
    });

    it('treats raw self messages case-insensitively', () => {
        network.nick = 'testnick';

        const msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('falls back to the connection nick for self detection', () => {
        network.nick = '';
        network.connection.nick = 'TestNick';

        const msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('treats another client on the same account as self', () => {
        network.sasl_account = 'TestNick';

        const msg = s.addMessage(buffer, {
            nick: 'OtherDevice',
            message: '@channel!',
            tags: { account: 'TestNick' },
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('does not treat bridged or relayed users as self', () => {
        const bridged = s.addMessage(buffer, {
            nick: 'BridgeBot',
            message: '<TestNick> @channel!',
            tags: { bot: true },
            time: Date.now(),
        });
        expect(bridged.bridged_nick).toBe('TestNick');
        expect(bridged.isHighlight).toBe(true);

        const relayed = s.addMessage(buffer, {
            nick: 'TestNick/bridged',
            message: '@channel!',
            tags: { 'draft/relaymsg': 'TestNick' },
            time: Date.now(),
        });
        expect(relayed.isHighlight).toBe(true);
    });
});
