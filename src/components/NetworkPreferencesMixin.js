import { filehostSupported as networkFilehostSupported } from '@/libs/fileupload';

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
        applyDesktopNotifications() {
            const network = this.networkPreferencesTarget();
            if (network && network.setWebpushEnabled) {
                network.setWebpushEnabled();
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
            return network && typeof network.supports('BOT') !== 'undefined';
        },
        filehostSupported() {
            return networkFilehostSupported(this.networkPreferencesTarget());
        },
        settingUseFilehost: bindNetworkSetting('useFilehost', true),
        settingPersistencePreference: bindNetworkSetting('persistencePreference', 'keep'),
        settingWebpushEnabled: bindNetworkSetting('webpushEnabled', false),
        settingBufferShowNotifications: bindNetworkSetting('show_notifications', true),
        settingBufferShareTyping: bindNetworkSetting('share_typing', true),
        settingBufferIgnoreBots: bindNetworkSetting('ignore_bots', false),
        settingBufferLenientRerouting: bindNetworkSetting('lenient_rerouting', true),
        settingBufferShowRedactions: bindNetworkSetting('show_redactions', 'placeholder'),
    },
};
