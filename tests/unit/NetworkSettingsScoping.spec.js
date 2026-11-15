import state from '@/libs/state';

describe('per-network settings', () => {
    it('starts from the admin config defaults', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});

        expect(network.setting('alert_on')).toBe('highlight');
        expect(network.setting('reactionNotifications')).toBe('all');
        expect(network.setting('highlightReplies')).toBe(true);
        expect(network.setting('highlightGroupMentions')).toBe(true);
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

        first.setting('alert_on', 'never');
        first.setting('reactionNotifications', 'none');
        first.setting('highlightReplies', false);
        first.setting('highlightGroupMentions', false);
        first.setting('rememberPassword', false);
        first.setting('persistencePreference', 'off');
        first.setting('share_typing', false);
        first.setting('lenient_rerouting', false);
        first.setting('ignore_bots', true);
        first.setting('show_redactions', 'hidden');
        first.setting('useFilehost', false);

        expect(second.setting('alert_on')).toBe('highlight');
        expect(second.setting('reactionNotifications')).toBe('all');
        expect(second.setting('highlightReplies')).toBe(true);
        expect(second.setting('highlightGroupMentions')).toBe(true);
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

        network.setting('alert_on', 'never');
        network.setting('share_typing', false);
        network.setting('show_redactions', 'hidden');

        expect(buffer.setting('alert_on')).toBe('never');
        expect(buffer.setting('share_typing')).toBe(false);
        expect(buffer.setting('show_redactions')).toBe('hidden');
    });

    it('lets a buffer override its network setting', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        network.setting('alert_on', 'never');
        buffer.setting('alert_on', 'message');

        expect(buffer.setting('alert_on')).toBe('message');
    });

    it('gates notification events by the global desktop setting', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        const listener = jest.fn();
        s.$on('notification.show', listener);

        s.setting('buffers.show_notifications', false);
        s.addMessage(buffer, {
            nick: 'OtherUser',
            message: 'hello',
            type: 'privmsg',
            time: Date.now(),
        });
        expect(listener).toHaveBeenCalledTimes(0);

        s.setting('buffers.show_notifications', true);
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
        s.setting('buffers.share_typing', false);
        s.setting('buffers.lenient_rerouting', false);
        s.setting('buffers.ignore_bots', true);
        s.setting('buffers.show_redactions', 'hidden');
        s.setting('persistencePreference', 'off');

        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(network.setting('alert_on')).toBe('highlight');
        expect(network.setting('reactionNotifications')).toBe('all');
        expect(network.setting('highlightReplies')).toBe(true);
        expect(network.setting('highlightGroupMentions')).toBe(true);
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
        delete exported.networks[0].settings.alert_on;
        delete exported.networks[0].settings.reactionNotifications;
        delete exported.networks[0].settings.highlightReplies;
        delete exported.networks[0].settings.highlightGroupMentions;
        delete exported.networks[0].settings.persistencePreference;
        delete exported.networks[0].settings.useFilehost;

        const restored = state.create();
        restored.importState(JSON.stringify(exported));
        expect(restored.networks[0].setting('alert_on')).toBe('highlight');
        expect(restored.networks[0].setting('reactionNotifications')).toBe('all');
        expect(restored.networks[0].setting('highlightReplies')).toBe(true);
        expect(restored.networks[0].setting('highlightGroupMentions')).toBe(true);
        expect(restored.networks[0].setting('persistencePreference')).toBe('keep');
        expect(restored.networks[0].setting('useFilehost')).toBe(true);
    });
});
