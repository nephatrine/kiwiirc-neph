import state from '@/libs/state';
import { AudioManager } from '@/libs/AudioManager';

describe('notification settings', () => {
    let created;

    function freshState() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        s.ui.app_has_focus = false;
        const notifications = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
        created.push(s);

        function addMessage(target, message) {
            return s.addMessage(target, Object.assign({
                nick: 'OtherUser',
                time: Date.now(),
            }, message));
        }

        return {
            s, network, buffer, notifications, addMessage,
        };
    }

    function freshAudioManager(s) {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);
        manager.listen(s);
        return audio;
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('global desktop notifications gate message notifications', () => {
        const { s, buffer, notifications, addMessage } = freshState();

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

    test('global notification sounds gate message and startup sounds', () => {
        let ctx = freshState();
        let audio = freshAudioManager(ctx.s);
        ctx.s.setting('notificationSounds', false);
        ctx.addMessage(ctx.buffer, {
            message: 'quiet',
            type: 'privmsg',
        });
        expect(audio.play).not.toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.s.setting('notificationSounds', true);
        ctx.addMessage(ctx.buffer, {
            message: 'loud',
            type: 'privmsg',
        });
        expect(audio.play).toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.s.setting('notificationSounds', false);
        ctx.s.$emit('audio.play', 'startup', ctx.network);
        expect(audio.play).not.toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.s.setting('notificationSounds', true);
        ctx.s.$emit('audio.play', 'startup', ctx.network);
        expect(audio.play).toHaveBeenCalledWith('startup');
    });

    test('per-buffer Never and do not disturb gate message sounds', () => {
        let ctx = freshState();
        let audio = freshAudioManager(ctx.s);
        ctx.buffer.setting('alert_on', 'never');
        ctx.addMessage(ctx.buffer, {
            message: 'quiet',
            type: 'privmsg',
        });
        expect(audio.play).not.toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.buffer.setting('alert_on', 'message');
        ctx.addMessage(ctx.buffer, {
            message: 'loud',
            type: 'privmsg',
        });
        expect(audio.play).toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.s.ui.notifications_enabled = false;
        ctx.addMessage(ctx.buffer, {
            message: 'quiet',
            type: 'privmsg',
        });
        expect(audio.play).not.toHaveBeenCalled();

        ctx = freshState();
        audio = freshAudioManager(ctx.s);
        ctx.s.ui.notifications_enabled = true;
        ctx.addMessage(ctx.buffer, {
            message: 'loud',
            type: 'privmsg',
        });
        expect(audio.play).toHaveBeenCalled();
    });

    test('traffic and server activity follow the alert level', () => {
        const {
            s, network, buffer, notifications, addMessage,
        } = freshState();

        s.setting('buffers.traffic_as_activity', true);
        addMessage(buffer, {
            message: 'OtherUser joined',
            type: 'traffic',
        });
        expect(notifications).toHaveLength(1);

        buffer.setting('alert_on', 'highlight');
        addMessage(buffer, {
            message: 'OtherUser left',
            type: 'traffic',
        });
        expect(notifications).toHaveLength(1);

        s.setting('buffers.server_as_activity', true);
        const server = network.serverBuffer();
        server.setting('alert_on', 'message');
        addMessage(server, {
            message: 'server message',
            type: 'notice',
        });
        expect(notifications).toHaveLength(2);
    });
});
