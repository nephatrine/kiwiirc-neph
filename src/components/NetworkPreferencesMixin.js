import { filehostSupported as networkFilehostSupported } from '@/libs/fileupload';
import { isDesktop } from '@/libs/desktop/Http';

function bindNetworkSetting(settingName, fallback) {
    return {
        get() {
            const network = this.networkPreferencesTarget();
            if (!network) {
                return fallback;
            }
            const value = network.setting(settingName);
            return typeof value === 'undefined' ? fallback : value;
        },
        set(newVal) {
            const network = this.networkPreferencesTarget();
            if (network) {
                network.setting(settingName, newVal);
            }
        },
    };
}

export default {
    methods: {
        // Overridden by NetworkSettings to target its prop instead of the
        // currently active network.
        networkPreferencesTarget() {
            return this.$state.getActiveNetwork();
        },
        applyPersistencePreference() {
            const network = this.networkPreferencesTarget();
            if (network && network.setPersistencePreference) {
                network.setPersistencePreference();
            }
        },
        applyWebpushEnabled() {
            const network = this.networkPreferencesTarget();
            if (network && network.setWebpushEnabled) {
                network.setWebpushEnabled();
            }
        },
        resetWebpush() {
            const network = this.networkPreferencesTarget();
            if (!network || !network.resetWebpush) {
                return;
            }
            if (!confirm(this.$t('webpush_reset_confirm'))) {
                return;
            }
            network.resetWebpush();
        },
    },
    computed: {
        persistencePreferenceAvailable() {
            const network = this.networkPreferencesTarget();
            return network && network.persistencePreferenceAvailable();
        },
        webpushAvailable() {
            if (isDesktop()) {
                return false;
            }

            const network = this.networkPreferencesTarget();
            return network && network.webpushAvailable() &&
                typeof window !== 'undefined' &&
                'Notification' in window;
        },
        webpushError() {
            const network = this.networkPreferencesTarget();
            return network && network.webpush_error;
        },
        messageTagsSupported() {
            const network = this.networkPreferencesTarget();
            return network && network.hasCap('message-tags');
        },
        typingSupported() {
            const network = this.networkPreferencesTarget();
            return network &&
                network.hasCap('message-tags') &&
                network.supportsTag('+typing');
        },
        redactionsSupported() {
            const network = this.networkPreferencesTarget();
            return network && network.hasCap('draft/message-redaction');
        },
        botSupportFound() {
            const network = this.networkPreferencesTarget();
            if (!network) {
                return false;
            }
            const metadataBot = !!network.metadataCap() &&
                !!network.metadata_limits &&
                network.metadata_limits.maxKeys > 0;
            return typeof network.supports('BOT') !== 'undefined' || metadataBot;
        },
        replySupported() {
            const network = this.networkPreferencesTarget();
            return network &&
                typeof network.replyTagName === 'function' &&
                !!network.replyTagName();
        },
        filehostSupported() {
            return networkFilehostSupported(this.networkPreferencesTarget());
        },
        reactionNotificationsAvailable() {
            const network = this.networkPreferencesTarget();
            return network && network.supportsTag('+draft/react');
        },
        settingNetworkAlertOn: bindNetworkSetting('alert_on', 'highlight'),
        settingReactionNotifications: bindNetworkSetting('reactionNotifications', 'all'),
        settingHighlightReplies: bindNetworkSetting('highlightReplies', true),
        settingHighlightGroupMentions: bindNetworkSetting('highlightGroupMentions', true),
        settingUseFilehost: bindNetworkSetting('useFilehost', true),
        settingPersistencePreference: bindNetworkSetting('persistencePreference', 'keep'),
        settingWebpushEnabled: bindNetworkSetting('webpushEnabled', false),
        settingBufferShareTyping: bindNetworkSetting('share_typing', true),
        settingBufferLenientRerouting: bindNetworkSetting('lenient_rerouting', true),
        settingBufferShowRedactions: bindNetworkSetting('show_redactions', 'default'),
        settingBufferAutoRequestHistory: bindNetworkSetting('auto_request_history', 'all'),
        settingShowBotMessages: bindNetworkSetting('showBotMessages', 'default'),
        settingShowJoinParts: bindNetworkSetting('show_joinparts', 'default'),
        settingShowTopics: bindNetworkSetting('show_topics', 'default'),
        settingShowNickChanges: bindNetworkSetting('show_nick_changes', 'default'),
        settingShowModeChanges: bindNetworkSetting('show_mode_changes', 'default'),
        settingShowPresenceChanges: bindNetworkSetting('show_presence_changes', 'default'),
    },
};
