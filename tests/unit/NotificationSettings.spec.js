import state from '@/libs/state';
import { AudioManager } from '@/libs/AudioManager';

describe('notification settings', () => {
    let s;
    let network;
    let buffer;
    let notifications;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        s.ui.app_has_focus = false;
        notifications = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
    });

    afterEach(() => {
        s.$destroy();
    });

    function addMessage(target, message) {
        return s.addMessage(target, Object.assign({
            nick: 'OtherUser',
            time: Date.now(),
        }, message));
    }

    test('global desktop notifications gate message notifications', () => {
        s.setting('buffers.show_notifications', false);
        addMessage(buffer, {
            message: 'hello',
            type: 'privmsg',
        });
        expect(notifications).toHaveLength(0);

        s.setting('buffers.show_notifications', true);
        addMessage(buffer, {
            message: 'hello again',
            type: 'privmsg',
        });
        expect(notifications).toHaveLength(1);
    });

    test('global notification sounds gate message sounds', () => {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);

        s.setting('notificationSounds', false);
        addMessage(buffer, {
            message: 'quiet',
            type: 'privmsg',
        });
        expect(audio.play).not.toHaveBeenCalled();

        s.setting('notificationSounds', true);
        addMessage(buffer, {
            message: 'loud',
            type: 'privmsg',
        });
        expect(audio.play).toHaveBeenCalled();
    });

    test('JOIN/PART activity notifies under All Messages', () => {
        s.setting('buffers.traffic_as_activity', true);
        addMessage(buffer, {
            message: 'OtherUser joined',
            type: 'traffic',
        });

        expect(notifications).toHaveLength(1);
    });

    test('JOIN/PART activity stays quiet under Only Highlights', () => {
        s.setting('buffers.traffic_as_activity', true);
        buffer.setting('alert_on', 'highlight');
        addMessage(buffer, {
            message: 'OtherUser joined',
            type: 'traffic',
        });

        expect(notifications).toHaveLength(0);
    });

    test('server activity notifies under All Messages', () => {
        s.setting('buffers.server_as_activity', true);
        const server = network.serverBuffer();
        server.setting('alert_on', 'message');
        addMessage(server, {
            message: 'server message',
            type: 'notice',
        });

        expect(notifications).toHaveLength(1);
    });
});
