import state from '@/libs/state';
import { AudioManager } from '@/libs/AudioManager';

describe('CTCP notifications', () => {
    let s;
    let network;
    let buffer;
    let notifications;
    let titleFlashes;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = network.serverBuffer();
        buffer.setting('alert_on', 'message');
        buffer.setting('flash_title', 'message');
        s.setting('buffers.server_as_activity', true);
        s.ui.app_has_focus = false;

        notifications = [];
        titleFlashes = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
        s.$on('notification.title', () => {
            titleFlashes.push(true);
        });
    });

    it('does not notify, flash, or mark unread for CTCP messages', () => {
        s.addMessage(buffer, {
            nick: '',
            message: '[CTCP Other reply] TIME Fri Oct 30 12:00:00 2026',
            type: 'ctcp',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(0);
        expect(titleFlashes).toHaveLength(0);
        expect(buffer.flags.unread || 0).toBe(0);
    });

    it('still notifies, flashes, and marks unread for normal messages', () => {
        s.addMessage(buffer, {
            nick: 'Other',
            message: 'hello',
            type: 'notice',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(1);
        expect(titleFlashes).toHaveLength(1);
        expect(buffer.flags.unread).toBe(1);
    });

    it('does not play an alert sound for CTCP messages', () => {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: '',
            message: '[CTCP Other reply] TIME Fri Oct 30 12:00:00 2026',
            type: 'ctcp',
            time: Date.now(),
        });
        expect(audio.play).not.toHaveBeenCalled();

        s.addMessage(buffer, {
            nick: 'Other',
            message: 'hello',
            type: 'notice',
            time: Date.now(),
        });
        expect(audio.play).toHaveBeenCalledWith('message');
    });
});
