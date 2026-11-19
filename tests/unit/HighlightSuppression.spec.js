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
        network.setting('highlightGroupMentions', true);
    });

    it('does not highlight self nick, highlights, or team mentions', () => {
        const cases = [
            'hello TestNick!',
            'this is a secret-word',
            'hey @everyone',
        ];

        cases.forEach((message) => {
            const msg = s.addMessage(buffer, {
                nick: 'TestNick',
                message,
                time: Date.now(),
            });
            expect(msg.isHighlight).toBe(false);
        });
    });

    it('still highlights another user mentioning nick, highlights, or teams', () => {
        const cases = [
            'hello TestNick!',
            'this is an apple',
            '@channel check this out',
        ];

        cases.forEach((message) => {
            const msg = s.addMessage(buffer, {
                nick: 'OtherUser',
                message,
                time: Date.now(),
            });
            expect(msg.isHighlight).toBe(true);
        });
    });

    it('handles team mention punctuation, case, formatting, and retired tokens', () => {
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

        const formatted = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '\x02@Channel!\x02',
            time: Date.now(),
        });
        expect(formatted.isHighlight).toBe(true);

        const retired = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@everybody!',
            time: Date.now(),
        });
        expect(retired.isHighlight).toBe(false);
    });

    it('handles word boundaries, URLs, and away team mentions', () => {
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

    it('detects self messages by nick, connection nick, and account', () => {
        network.nick = 'testnick';
        let msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);

        network.nick = '';
        network.connection.nick = 'TestNick';
        msg = s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);

        network.nick = 'TestNick';
        network.sasl_account = 'TestNick';
        msg = s.addMessage(buffer, {
            nick: 'OtherDevice',
            message: '@channel!',
            tags: { account: 'TestNick' },
            time: Date.now(),
        });
        expect(msg.isHighlight).toBe(false);
    });

    it('does not highlight group mentions when disabled per network', () => {
        network.setting('highlightGroupMentions', false);

        const msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@channel check this out',
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
