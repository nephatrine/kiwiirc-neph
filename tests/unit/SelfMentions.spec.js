import state from '@/libs/state';
import { AudioManager } from '@/libs/AudioManager';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
    };
});

describe('self mention notifications', () => {
    let s;
    let network;
    let buffer;
    let notifications;
    let flashes;

    beforeEach(() => {
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
