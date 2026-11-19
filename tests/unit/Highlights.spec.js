import state from '@/libs/state';
import ThemeManager from '@/libs/ThemeManager';
import Message from '@/libs/Message';
import * as TextFormatting from '@/helpers/TextFormatting';
import { AudioManager } from '@/libs/AudioManager';

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

describe('self mention notifications', () => {
    let s;
    let network;
    let buffer;
    let notifications;
    let flashes;

    beforeEach(() => {
        jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        buffer.setting('flash_title', 'message');
        network.setting('highlightGroupMentions', true);
        s.setting('buffers.show_notifications', true);
        s.ui.app_has_focus = false;

        notifications = [];
        flashes = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
        s.$on('notification.title', () => {
            flashes.push(true);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('notifies and flashes only for non-self team mentions', () => {
        s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(0);
        expect(flashes).toHaveLength(0);

        let msg = s.addMessage(buffer, {
            nick: 'BridgeBot',
            message: '<TestNick> @channel!',
            tags: { bot: true },
            type: 'privmsg',
            time: Date.now(),
        });

        expect(msg.isHighlight).toBe(true);
        expect(msg.is_new).toBe(true);
        expect(s.setting('buffers.show_notifications')).toBe(true);
        expect(buffer.setting('alert_on')).toBe('message');
        expect(notifications).toHaveLength(1);
        expect(flashes).toHaveLength(1);

        notifications.length = 0;
        flashes.length = 0;
        msg = s.addMessage(buffer, {
            nick: 'TestNick/bridged',
            message: '@channel!',
            tags: { 'draft/relaymsg': 'TestNick' },
            type: 'privmsg',
            time: Date.now(),
        });

        expect(msg.isHighlight).toBe(true);
        expect(notifications).toHaveLength(1);

        notifications.length = 0;
        flashes.length = 0;
        msg = s.addMessage(buffer, {
            nick: 'OtherUser',
            message: '@channel!',
            type: 'privmsg',
            time: Date.now(),
        });

        expect(msg.is_new).toBe(true);
        expect(msg.ignore).toBe(false);
        expect(buffer.isSpecial()).toBe(false);
        expect(notifications).toHaveLength(1);
    });

    it('plays an alert sound only for bridged self-like messages', () => {
        const quietAudio = { play: jest.fn() };
        const quietManager = new AudioManager(quietAudio);
        quietManager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });

        expect(quietAudio.play).not.toHaveBeenCalled();

        const loudAudio = { play: jest.fn() };
        const loudManager = new AudioManager(loudAudio);
        loudManager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: 'BridgeBot',
            message: '<TestNick> @channel!',
            tags: { bot: true },
            time: Date.now(),
        });

        expect(loudAudio.play).toHaveBeenCalledWith('notification');
    });
});

describe('draft/oper-tag', () => {
    it('marks draft/oper messages and keeps bot flags independent', () => {
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

        let unprefixed = new Message({
            nick: 'Oper',
            message: 'hello',
            tags: { oper: '' },
        });
        expect(unprefixed.is_oper).toBe(false);

        let operBot = new Message({
            nick: 'OperBot',
            message: 'hello',
            tags: { 'bot': true, 'draft/oper': '' },
        });
        expect(operBot.is_bot).toBe(true);
        expect(operBot.is_oper).toBe(true);
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
