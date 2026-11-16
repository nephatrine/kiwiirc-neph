import state from '@/libs/state';
import NetworkPreferencesMixin from '@/components/NetworkPreferencesMixin';

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
        expect(network.setting('show_redactions')).toBe('default');
        expect(network.setting('showBotMessages')).toBe('default');
        expect(network.setting('show_joinparts')).toBe('default');
        expect(network.setting('show_topics')).toBe('default');
        expect(network.setting('show_nick_changes')).toBe('default');
        expect(network.setting('show_mode_changes')).toBe('default');
        expect(network.setting('show_presence_changes')).toBe('default');
        expect(network.setting('auto_request_history')).toBe('all');
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
        first.setting('show_redactions', 'hidden');
        first.setting('show_joinparts', 'no');
        first.setting('show_topics', 'no');
        first.setting('show_nick_changes', 'yes');
        first.setting('show_mode_changes', 'no');
        first.setting('useFilehost', false);

        expect(second.setting('alert_on')).toBe('highlight');
        expect(second.setting('reactionNotifications')).toBe('all');
        expect(second.setting('highlightReplies')).toBe(true);
        expect(second.setting('highlightGroupMentions')).toBe(true);
        expect(second.setting('rememberPassword')).toBe(true);
        expect(second.setting('persistencePreference')).toBe('keep');
        expect(second.setting('share_typing')).toBe(true);
        expect(second.setting('lenient_rerouting')).toBe(true);
        expect(second.setting('show_redactions')).toBe('default');
        expect(second.setting('showBotMessages')).toBe('default');
        expect(second.setting('show_joinparts')).toBe('default');
        expect(second.setting('show_topics')).toBe('default');
        expect(second.setting('show_nick_changes')).toBe('default');
        expect(second.setting('show_mode_changes')).toBe('default');
        expect(second.setting('show_presence_changes')).toBe('default');
        expect(second.setting('auto_request_history')).toBe('all');
        expect(second.setting('useFilehost')).toBe(true);
    });

    it('falls back to the network value from a buffer', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        network.setting('alert_on', 'never');
        network.setting('share_typing', false);
        network.setting('show_redactions', 'hidden');
        network.setting('show_joinparts', 'no');
        network.setting('show_topics', 'no');
        network.setting('show_nick_changes', 'yes');
        network.setting('show_mode_changes', 'no');

        expect(buffer.setting('alert_on')).toBe('never');
        expect(buffer.setting('share_typing')).toBe(false);
        expect(buffer.setting('show_redactions')).toBe('hidden');
        expect(buffer.setting('show_joinparts')).toBe(false);
        expect(buffer.setting('show_topics')).toBe(false);
        expect(buffer.setting('show_nick_changes')).toBe(true);
        expect(buffer.setting('show_mode_changes')).toBe(false);
        network.setting('auto_request_history', 'channels');
        expect(buffer.setting('auto_request_history')).toBe('channels');
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
        s.setting('buffers.show_redactions', 'hidden');
        s.setting('persistencePreference', 'off');

        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(network.setting('alert_on')).toBe('highlight');
        expect(network.setting('reactionNotifications')).toBe('all');
        expect(network.setting('highlightReplies')).toBe(true);
        expect(network.setting('highlightGroupMentions')).toBe(true);
        expect(network.setting('share_typing')).toBe(true);
        expect(network.setting('lenient_rerouting')).toBe(true);
        expect(network.setting('show_redactions')).toBe('default');
        expect(network.setting('showBotMessages')).toBe('default');
        expect(network.setting('show_joinparts')).toBe('default');
        expect(network.setting('show_topics')).toBe('default');
        expect(network.setting('show_nick_changes')).toBe('default');
        expect(network.setting('show_mode_changes')).toBe('default');
        expect(network.setting('show_presence_changes')).toBe('default');
        expect(network.setting('persistencePreference')).toBe('keep');
    });

    it('resolves default network message settings from the global values', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        s.setting('buffers.show_redactions', 'hidden');
        s.setting('buffers.show_presence_changes', true);
        s.setting('buffers.show_joinparts', true);
        s.setting('buffers.show_topics', false);
        s.setting('buffers.show_nick_changes', true);
        s.setting('buffers.show_mode_changes', false);
        s.setting('showBotMessages', false);
        expect(buffer.setting('show_redactions')).toBe('hidden');
        expect(buffer.setting('show_presence_changes')).toBe(true);
        expect(buffer.setting('show_joinparts')).toBe(true);
        expect(buffer.setting('show_topics')).toBe(false);
        expect(buffer.setting('show_nick_changes')).toBe(true);
        expect(buffer.setting('show_mode_changes')).toBe(false);
        expect(network.showBotMessages()).toBe(false);

        network.setting('show_redactions', 'revealed');
        network.setting('show_presence_changes', 'no');
        network.setting('show_joinparts', 'no');
        network.setting('show_topics', 'yes');
        network.setting('show_nick_changes', 'no');
        network.setting('show_mode_changes', 'yes');
        network.setting('showBotMessages', 'yes');
        expect(buffer.setting('show_redactions')).toBe('revealed');
        expect(buffer.setting('show_presence_changes')).toBe(false);
        expect(buffer.setting('show_joinparts')).toBe(false);
        expect(buffer.setting('show_topics')).toBe(true);
        expect(buffer.setting('show_nick_changes')).toBe(false);
        expect(buffer.setting('show_mode_changes')).toBe(true);
        expect(network.showBotMessages()).toBe(true);
    });

    it('gates reply and bot settings by network capabilities', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const context = {
            networkPreferencesTarget: () => network,
        };

        network.enabled_caps = ['message-tags'];
        network.isupport.CLIENTTAGDENY = '';
        expect(NetworkPreferencesMixin.computed.replySupported.call(context)).toBe(true);
        expect(NetworkPreferencesMixin.computed.botSupportFound.call(context)).toBe(false);

        network.isupport.BOT = '';
        expect(NetworkPreferencesMixin.computed.botSupportFound.call(context)).toBe(true);

        delete network.isupport.BOT;
        network.enabled_caps = ['draft/metadata-3'];
        network.metadata_limits.maxKeys = 32;
        expect(NetworkPreferencesMixin.computed.botSupportFound.call(context)).toBe(true);

        network.enabled_caps = [];
        network.metadata_limits.maxKeys = 0;
        expect(NetworkPreferencesMixin.computed.replySupported.call(context)).toBe(false);
        expect(NetworkPreferencesMixin.computed.botSupportFound.call(context)).toBe(false);
    });

    it('keeps defaults when an old state lacks the new keys', () => {
        const s = state.create();
        s.addNetwork('TestNetwork', 'TestNick', {});
        const exported = JSON.parse(s.exportState(true));
        delete exported.networks[0].settings.alert_on;
        delete exported.networks[0].settings.reactionNotifications;
        delete exported.networks[0].settings.highlightReplies;
        delete exported.networks[0].settings.highlightGroupMentions;
        delete exported.networks[0].settings.show_redactions;
        delete exported.networks[0].settings.showBotMessages;
        delete exported.networks[0].settings.show_joinparts;
        delete exported.networks[0].settings.show_topics;
        delete exported.networks[0].settings.show_nick_changes;
        delete exported.networks[0].settings.show_mode_changes;
        delete exported.networks[0].settings.show_presence_changes;
        delete exported.networks[0].settings.persistencePreference;
        delete exported.networks[0].settings.useFilehost;

        const restored = state.create();
        restored.importState(JSON.stringify(exported));
        expect(restored.networks[0].setting('alert_on')).toBe('highlight');
        expect(restored.networks[0].setting('reactionNotifications')).toBe('all');
        expect(restored.networks[0].setting('highlightReplies')).toBe(true);
        expect(restored.networks[0].setting('highlightGroupMentions')).toBe(true);
        expect(restored.networks[0].setting('show_redactions')).toBe('default');
        expect(restored.networks[0].setting('showBotMessages')).toBe('default');
        expect(restored.networks[0].setting('show_joinparts')).toBe('default');
        expect(restored.networks[0].setting('show_topics')).toBe('default');
        expect(restored.networks[0].setting('show_nick_changes')).toBe('default');
        expect(restored.networks[0].setting('show_mode_changes')).toBe('default');
        expect(restored.networks[0].setting('show_presence_changes')).toBe('default');
        expect(restored.networks[0].setting('auto_request_history')).toBe('all');
        expect(restored.networks[0].setting('persistencePreference')).toBe('keep');
        expect(restored.networks[0].setting('useFilehost')).toBe(true);
    });
});
