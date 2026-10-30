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
        buffer.setting('show_notifications', true);
        buffer.setting('flash_title', 'message');
        s.setSetting('user_settings.teamHighlights', true);
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

    it('does not notify or flash for a genuine self team mention', () => {
        s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(0);
        expect(flashes).toHaveLength(0);
    });

    it('notifies and flashes for a bridged user with the same displayed name', () => {
        const msg = s.addMessage(buffer, {
            nick: 'BridgeBot',
            message: '<TestNick> @channel!',
            tags: { bot: true },
            time: Date.now(),
        });

        expect(msg.isHighlight).toBe(true);
        expect(msg.is_new).toBe(true);
        expect(buffer.setting('show_notifications')).toBe(true);
        expect(buffer.setting('alert_on')).toBe('message');
        expect(notifications).toHaveLength(1);
        expect(flashes).toHaveLength(1);
    });

    it('notifies for a relayed user with the same displayed name', () => {
        const msg = s.addMessage(buffer, {
            nick: 'TestNick/bridged',
            message: '@channel!',
            tags: { 'draft/relaymsg': 'TestNick' },
            time: Date.now(),
        });

        expect(msg.isHighlight).toBe(true);
        expect(notifications).toHaveLength(1);
    });

    it('still notifies for another user team mention', () => {
        const msg = s.addMessage(buffer, {
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

    it('does not play an alert sound for a genuine self message', () => {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: 'TestNick',
            message: '@channel!',
            time: Date.now(),
        });

        expect(audio.play).not.toHaveBeenCalled();
    });

    it('plays an alert sound for a bridged self-like message', () => {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: 'BridgeBot',
            message: '<TestNick> @channel!',
            tags: { bot: true },
            time: Date.now(),
        });

        expect(audio.play).toHaveBeenCalledWith('notification');
    });
});
