import state from '@/libs/state';

describe('per-network settings', () => {
    it('starts from the admin config defaults', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});

        expect(network.setting('show_notifications')).toBe(true);
        expect(network.setting('rememberPassword')).toBe(true);
        expect(network.setting('persistencePreference')).toBe('keep');
        expect(network.setting('share_typing')).toBe(true);
        expect(network.setting('lenient_rerouting')).toBe(true);
        expect(network.setting('ignore_bots')).toBe(false);
        expect(network.setting('show_redactions')).toBe('placeholder');
        expect(network.setting('useFilehost')).toBe(true);
    });

    it('keeps settings independent between networks', () => {
        const s = state.create();
        const first = s.addNetwork('First', 'FirstNick', {});
        const second = s.addNetwork('Second', 'SecondNick', {});

        first.setting('show_notifications', false);
        first.setting('rememberPassword', false);
        first.setting('persistencePreference', 'off');
        first.setting('share_typing', false);
        first.setting('lenient_rerouting', false);
        first.setting('ignore_bots', true);
        first.setting('show_redactions', 'hidden');
        first.setting('useFilehost', false);

        expect(second.setting('show_notifications')).toBe(true);
        expect(second.setting('rememberPassword')).toBe(true);
        expect(second.setting('persistencePreference')).toBe('keep');
        expect(second.setting('share_typing')).toBe(true);
        expect(second.setting('lenient_rerouting')).toBe(true);
        expect(second.setting('ignore_bots')).toBe(false);
        expect(second.setting('show_redactions')).toBe('placeholder');
        expect(second.setting('useFilehost')).toBe(true);
    });

    it('falls back to the network value from a buffer', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        network.setting('show_notifications', false);
        network.setting('share_typing', false);
        network.setting('show_redactions', 'hidden');

        expect(buffer.setting('show_notifications')).toBe(false);
        expect(buffer.setting('share_typing')).toBe(false);
        expect(buffer.setting('show_redactions')).toBe('hidden');
    });

    it('lets a buffer override its network setting', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        network.setting('show_notifications', false);
        buffer.setting('show_notifications', true);

        expect(buffer.setting('show_notifications')).toBe(true);
    });

    it('gates notification events by the network setting', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        const listener = jest.fn();
        s.$on('notification.show', listener);

        s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'hello',
            type: 'privmsg',
            time: Date.now(),
        });
        expect(listener).toHaveBeenCalledTimes(1);

        network.setting('show_notifications', false);
        s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'again',
            type: 'privmsg',
            time: Date.now(),
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('ignores legacy global user values', () => {
        const s = state.create();
        s.setting('buffers.show_notifications', false);
        s.setting('buffers.share_typing', false);
        s.setting('buffers.lenient_rerouting', false);
        s.setting('buffers.ignore_bots', true);
        s.setting('buffers.show_redactions', 'hidden');
        s.setting('persistencePreference', 'off');

        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(network.setting('show_notifications')).toBe(true);
        expect(network.setting('share_typing')).toBe(true);
        expect(network.setting('lenient_rerouting')).toBe(true);
        expect(network.setting('ignore_bots')).toBe(false);
        expect(network.setting('show_redactions')).toBe('placeholder');
        expect(network.setting('persistencePreference')).toBe('keep');
    });

    it('keeps defaults when an old state lacks the new keys', () => {
        const s = state.create();
        s.addNetwork('TestNetwork', 'TestNick', {});
        const exported = JSON.parse(s.exportState(true));
        delete exported.networks[0].settings.show_notifications;
        delete exported.networks[0].settings.persistencePreference;
        delete exported.networks[0].settings.useFilehost;

        const restored = state.create();
        restored.importState(JSON.stringify(exported));
        expect(restored.networks[0].setting('show_notifications')).toBe(true);
        expect(restored.networks[0].setting('persistencePreference')).toBe('keep');
        expect(restored.networks[0].setting('useFilehost')).toBe(true);
    });
});
