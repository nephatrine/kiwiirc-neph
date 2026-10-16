<template>
    <div class="kiwi-appsettings">

        <div :title="$t('close')" class="kiwi-appsettings-close" @click="closeSettings">
            <span>{{ $t('close') }}</span>
            <i class="fa fa-times" aria-hidden="true" />
        </div>

        <form class="u-form">
            <tabbed-view ref="tabs" class="kiwi-appsettings-tab-container">
                <tabbed-tab :header="$t('settings_general')" :focus="true" name="general">

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_general') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-general">
                            <label class="kiwi-appsettings-setting-language">
                                <span>{{ $t('settings_language') }}</span>
                                <div><i class="fa fa-globe" /></div>
                                <select v-model="settingLanguage">
                                    <option value="">
                                        Auto
                                    </option>
                                    <option v-for="l in localesList" :key="l[0]" :value="l[0]">
                                        {{ l[1] }}
                                    </option>
                                </select>
                            </label>
                            <label class="kiwi-appsettings-setting-theme">
                                <span>{{ $t('settings_theme') }} </span>
                                <a
                                    :title="$t('refresh_theme')"
                                    class="kiwi-appsettings-theme-reload"
                                    @click="refreshTheme"
                                >
                                    <i class="fa fa-refresh" aria-hidden="true" />
                                </a>
                                <select v-model="theme">
                                    <option
                                        v-for="t in settings.themes"
                                        :key="t.name"
                                        :value="t.name"
                                    >
                                        {{ t.name }}
                                    </option>
                                </select>
                            </label>
                            <label
                                v-if="theme.toLowerCase() === 'custom'"
                                class="kiwi-appsettings-setting-theme-custom"
                            >
                                <span>{{ $t('settings_themeurl') }} </span>
                                <input v-model="customThemeUrl" class="u-input">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_autocomplete') }} </span>
                                <input v-model="settingShowAutoComplete" type="checkbox">
                            </label>
                            <label v-if="themeSupportsMonospace" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_use_monospace') }} </span>
                                <input v-model="settingUseMonospace" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_auto_reconnect') }} </span>
                                <input v-model="settingAutoReconnect" type="checkbox">
                            </label>
                            <label v-if="persistencePreferenceAvailable" class="kiwi-appsettings-persistence">
                                <span>{{ $t('settings_persistence') }} </span>
                                <select
                                    v-model="settingPersistencePreference"
                                    @change="applyPersistencePreference"
                                >
                                    <option value="keep">{{ $t('settings_persistence_keep') }}</option>
                                    <option value="default">{{ $t('settings_persistence_default') }}</option>
                                    <option value="on">{{ $t('settings_persistence_enabled') }}</option>
                                    <option value="off">{{ $t('settings_persistence_disabled') }}</option>
                                </select>
                            </label>
                            <label v-if="webpushAvailable" class="kiwi-appsettings-webpush">
                                <span>{{ $t('settings_webpush') }} </span>
                                <input v-model="settingWebpushEnabled" type="checkbox" @change="applyWebpushEnabled">
                            </label>
                            <div
                                v-if="canRegisterProtocolHandler"
                                style="margin-top: 10px; text-align: center;"
                            >
                                <a
                                    class="u-button u-button-primary"
                                    @click="makeDefaultProtocolHandler()"
                                >
                                    <i>{{ $t('settings_default_handler') }}</i>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_messages_title') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-messages">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_messagelayout') }} </span>
                                <select v-model="settingMessageLayout">
                                    <option value="traditional">Traditional</option>
                                    <option value="modern">Modern</option>
                                    <option value="inline">Inline</option>
                                </select>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_timestamps') }} </span>
                                <input v-model="settingBufferShowTimestamps" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_24hour_timestamps') }} </span>
                                <input v-model="timestamps_24h" type="checkbox">
                            </label>
                            <label v-if="activeNetworkIsUtf8" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_emoji_convert_incoming') }} </span>
                                <input v-model="settingBufferEmojiConvertIncoming" type="checkbox">
                            </label>
                            <label v-if="activeNetworkIsUtf8" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_emoji_convert_as_typed') }} </span>
                                <input v-model="settingBufferEmojiConvertAsTyped" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_block_private') }} </span>
                                <input v-model="settingBufferBlockPms" type="checkbox">
                            </label>
                            <label
                                class="kiwi-appsettings-full kiwi-appsettings-setting-scrollback"
                            >
                                <input
                                    v-model="settingBufferScrollbackSize"
                                    type="number"
                                    class="u-input"
                                >
                                <span>{{ $t('settings_scrollback') }} </span>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_formatting') }} </span>
                                <input v-model="settingBufferExtraFormatting" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_nick_colouring') }} </span>
                                <input v-model="settingBufferColourNicknames" type="checkbox">
                            </label>
                            <label v-if="messageTagsSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_share_typing') }} </span>
                                <input v-model="settingBufferShareTyping" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_inline_previews') }} </span>
                                <input v-model="settingBufferInlineLinkPreviews" type="checkbox">
                            </label>
                            <label v-if="!botSupportFound" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_ignore_bots') }} </span>
                                <input v-model="settingBufferIgnoreBots" type="checkbox">
                            </label>
                            <label v-if="messageTagsSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_lenient_rerouting') }} </span>
                                <input v-model="settingBufferLenientRerouting" type="checkbox">
                            </label>
                            <label v-if="redactionsSupported" class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_show_redactions') }} </span>
                                <select v-model="settingBufferShowRedactions">
                                    <option value="hidden">{{ $t('settings_show_redactions_hidden') }}</option>
                                    <option value="placeholder">{{ $t('settings_show_redactions_placeholder') }}</option>
                                    <option value="revealed">{{ $t('settings_show_redactions_revealed') }}</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_fileupload') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_fileupload_service') }} </span>
                                <select v-model="fileuploadServiceChoice">
                                    <option value="">
                                        {{ $t('settings_fileupload_default') }}
                                    </option>
                                    <option value="none">
                                        {{ $t('settings_fileupload_none') }}
                                    </option>
                                    <option
                                        v-for="service in fileuploadServices"
                                        :key="service.id"
                                        :value="service.id"
                                    >
                                        {{ service.label }}
                                    </option>
                                </select>
                            </label>
                            <label
                                v-if="fileuploadRetentionOptions.length"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_fileupload_retention') }} </span>
                                <select v-model="fileuploadRetentionChoice">
                                    <option value="">
                                        {{ $t('settings_fileupload_default') }}
                                    </option>
                                    <option
                                        v-for="retention in fileuploadRetentionOptions"
                                        :key="retention"
                                        :value="retention"
                                    >
                                        {{ retention }}
                                    </option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('notifications') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-notifications">
                            <label class="kiwi-appsettings-setting-showjoinpart u-checkbox-wrapper">
                                <span>{{ $t('settings_show_joinpart') }} </span>
                                <input v-model="settingBufferTrafficAsActivity" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_mute_sound') }} </span>
                                <input v-model="settingBufferMuteSound" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_notifications') }} </span>
                                <input v-model="settingBufferShowNotifications" type="checkbox">
                            </label>
                            <label class="kiwi-appsettings-full">
                                <span>{{ $t('settings_highlight') }} </span>
                                <input v-model="settingHighlights" type="text" class="u-input">
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('operator_tools') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-operator-tools">
                            <label>
                                <span>{{ $t('settings_default_ban_mask') }} </span>
                                <input v-model="settingDefaultBanMask" class="u-input">
                            </label>
                            <label>
                                <span>{{ $t('settings_default_kick_reason') }}</span>
                                <input v-model="settingDefaultKickReason" class="u-input">
                            </label>
                        </div>
                    </div>
                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('troubleshooting') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <div style="margin-bottom: 10px;">
                                {{ $t('export_debug_description') }}
                            </div>
                            <div style="text-align: center;">
                                <a class="u-button u-button-primary" @click="downloadDebugDump()">
                                    <i>{{ $t('export_debug') }}</i>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="!$state.setting('hide_advanced') && !settingAdvancedEnable"
                        class="kiwi-appsettings-block"
                    >
                        <h3>{{ $t('settings_advanced_title') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-advanced-enable">
                            <div>
                                <span style="font-weight: 600;">
                                    {{ $t('warning') }}
                                </span>
                                {{ $t('settings_advanced_warning') }}
                            </div>
                            <div style="margin-top: 10px; text-align: center;">
                                <a class="u-button u-button-warning" @click="enableAdvancedTab()">
                                    <i>{{ $t('settings_advanced_button') }}</i>
                                </a>
                            </div>
                        </div>
                    </div>
                </tabbed-tab>

                <tabbed-tab :header="$t('settings_aliases')" name="aliases">
                    <div class="kiwi-appsettings-block kiwi-appsettings-block-aliases">
                        <h3>{{ $t('settings_aliases') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-aliases">
                            <settings-aliases />
                        </div>
                    </div>
                </tabbed-tab>

                <tabbed-tab
                    v-if="settingAdvancedEnable"
                    :header="$t('settings_advanced')"
                    name="advanced"
                >
                    <div class="kiwi-appsettings-block kiwi-appsettings-block-advanced">
                        <div class="kiwi-appsettings-section kiwi-appsettings-advanced">
                            <settings-advanced />
                        </div>
                    </div>
                </tabbed-tab>

                <tabbed-tab
                    v-for="item in pluginUiElements"
                    :key="item.id"
                    :header="item.title()"
                    :name="item.tabName"
                >
                    <component :is="item.component" v-bind="item.props" />
                </tabbed-tab>
            </tabbed-view>
        </form>
    </div>
</template>

<script>
'kiwi public';

import _ from 'lodash';
import ThemeManager from '@/libs/ThemeManager';
import GlobalApi from '@/libs/GlobalApi';
import localesList from '@/res/localesList';
import { effectiveService, filehostAvailable, listUploadServices } from '@/libs/fileupload';
import SettingsAliases from './SettingsAliases';
import SettingsAdvanced from './SettingsAdvanced';

/**
 * Returns an object for a vuejs computated property on a state settings value
 * This allows default settings from the server config, but overrides with user config
 */
function bindSetting(settingName) {
    return {
        get() {
            return this.$state.setting(settingName);
        },
        set(newVal) {
            this.$state.setting(settingName, newVal);
        },
    };
}

export default {
    components: {
        SettingsAliases,
        SettingsAdvanced,
    },
    data() {
        return {
            theme: '',
            customThemeUrl: '',
            pluginUiElements: GlobalApi.singleton().appSettingsPlugins,
            localesList,
        };
    },
    computed: {
        themeSupportsMonospace() {
            let themeMgr = ThemeManager.instance();
            let val = themeMgr.themeVar('supports-monospace');
            return val === '1';
        },
        canRegisterProtocolHandler() {
            return !!navigator.registerProtocolHandler && this.$state.setting('allowRegisterProtocolHandler');
        },
        messageTagsSupported() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork && activeNetwork.hasCap('message-tags');
        },
        persistencePreferenceAvailable() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork && activeNetwork.persistencePreferenceAvailable();
        },
        webpushAvailable() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork && activeNetwork.webpushAvailable();
        },
        redactionsSupported() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork && activeNetwork.hasCap('draft/message-redaction');
        },
        botSupportFound() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork && typeof activeNetwork.supports('BOT') !== 'undefined';
        },
        activeNetworkIsUtf8() {
            let activeNetwork = this.$state.getActiveNetwork();
            return !activeNetwork || activeNetwork.isUtf8;
        },
        timestamps_24h: {
            get() {
                // %H is 24 hour format
                return this.$state.setting('buffers.timestamp_format').substr(0, 2) === '%H';
            },
            set(newVal) {
                let newFormat = newVal ?
                    '%H:%M:%S' :
                    '%l:%M:%S %p';
                this.$state.setting('buffers.timestamp_format', newFormat);
            },
        },
        settings() {
            return this.$state.settings;
        },
        settingShowAutoComplete: bindSetting('showAutocomplete'),
        settingAutoReconnect: bindSetting('autoReconnect'),
        settingPersistencePreference: bindSetting('persistencePreference'),
        settingWebpushEnabled: bindSetting('webpushEnabled'),
        settingUseMonospace: bindSetting('useMonospace'),
        settingHighlights: bindSetting('highlights'),
        settingBufferColourNicknames: bindSetting('buffers.colour_nicknames_in_messages'),
        settingBufferShowTimestamps: bindSetting('buffers.show_timestamps'),
        settingBufferEmojiConvertIncoming: bindSetting('buffers.emoji_convert_incoming'),
        settingBufferEmojiConvertAsTyped: bindSetting('buffers.emoji_convert_as_typed'),
        settingBufferBlockPms: bindSetting('buffers.block_pms'),
        settingBufferScrollbackSize: bindSetting('buffers.scrollback_size'),
        settingBufferExtraFormatting: bindSetting('buffers.extra_formatting'),
        settingBufferTrafficAsActivity: bindSetting('buffers.traffic_as_activity'),
        settingBufferMuteSound: bindSetting('buffers.mute_sound'),
        settingBufferShowNotifications: bindSetting('buffers.show_notifications'),
        settingBufferShareTyping: bindSetting('buffers.share_typing'),
        settingBufferIgnoreBots: bindSetting('buffers.ignore_bots'),
        settingBufferLenientRerouting: bindSetting('buffers.lenient_rerouting'),
        settingBufferShowRedactions: bindSetting('buffers.show_redactions'),
        settingDefaultBanMask: bindSetting('buffers.default_ban_mask'),
        settingDefaultKickReason: bindSetting('buffers.default_kick_reason'),
        settingBufferInlineLinkPreviews: {
            get() {
                return this.$state.setting('buffers.inline_link_auto_previews')
                    || this.$state.setting('buffers.inline_link_auto_previews_query');
            },
            set(newVal) {
                this.$state.setting('buffers.inline_link_auto_previews', newVal);
                this.$state.setting('buffers.inline_link_auto_previews_query', newVal);
            },
        },
        settingAdvancedEnable: {
            get() {
                return this.$state.ui.show_advanced_tab;
            },
            set(newVal) {
                this.$state.ui.show_advanced_tab = newVal;
            },
        },
        settingLanguage: {
            get() {
                return this.$state.setting('language') || '';
            },
            set(newVal) {
                this.$state.setting('language', newVal || null);
            },
        },
        messageLayouts() {
            return {
                traditional: 'compact',
                modern: 'modern',
                inline: 'inline',
            };
        },
        settingMessageLayout: {
            get() {
                let s = this.$state.setting('buffers.messageLayout');
                let l = _.invert(this.messageLayouts);
                return l[s];
            },
            set(newVal) {
                let l = this.messageLayouts;
                this.$state.setting('buffers.messageLayout', l[newVal] || l.modern);
            },
        },
        fileuploadServices() {
            let network = this.$state.getActiveNetwork();
            let saved = this.fileuploadServiceChoice;
            return listUploadServices().filter((service) => {
                if (service.id !== 'filehost') {
                    return true;
                }
                return saved === 'filehost' || filehostAvailable(network);
            });
        },
        fileuploadServiceChoice: {
            get() {
                let userVal = this.$state.getSetting('user_settings.fileupload.service');
                return typeof userVal === 'undefined' ? '' : userVal;
            },
            set(newVal) {
                if (!newVal) {
                    this.$state.setSetting('user_settings.fileupload.service', null);
                    return;
                }
                this.$state.setting('fileupload.service', newVal);
            },
        },
        fileuploadRetentionOptions() {
            let service = effectiveService(this.$state, this.$state.getActiveNetwork());
            return (service && service.retentions) || [];
        },
        fileuploadRetentionChoice: {
            get() {
                let service = effectiveService(this.$state, this.$state.getActiveNetwork());
                if (!service || !service.retentionSetting) {
                    return '';
                }
                let userVal = this.$state.getSetting(
                    'user_settings.' + service.retentionSetting,
                );
                return typeof userVal === 'undefined' ? '' : userVal;
            },
            set(newVal) {
                let service = effectiveService(this.$state, this.$state.getActiveNetwork());
                if (!service || !service.retentionSetting) {
                    return;
                }
                if (!newVal) {
                    this.$state.setSetting(
                        'user_settings.' + service.retentionSetting,
                        null,
                    );
                    return;
                }
                this.$state.setting(service.retentionSetting, newVal);
            },
        },
    },
    created() {
        this.listenForThemeSettings();

        this.listen(this.$state, 'settings.tab.show', (tabName) => {
            this.showTab(tabName);
        });
    },
    methods: {
        closeSettings() {
            this.$state.$emit('active.component');
        },
        applyPersistencePreference() {
            // Push a dropdown change to the server immediately against the
            // last reported STATUS instead of waiting for the next one
            // (servers only send STATUS on change or at connect).
            let activeNetwork = this.$state.getActiveNetwork();
            if (activeNetwork && activeNetwork.setPersistencePreference) {
                activeNetwork.setPersistencePreference();
            }
        },
        applyWebpushEnabled() {
            // (Un)subscribe immediately on toggle instead of waiting for
            // the next connect.
            let activeNetwork = this.$state.getActiveNetwork();
            if (activeNetwork && activeNetwork.setWebpushEnabled) {
                activeNetwork.setWebpushEnabled();
            }
        },
        refreshTheme() {
            ThemeManager.instance().reload();
        },
        showTab(tabName) {
            this.$refs.tabs.setActiveByName(tabName);
        },
        listenForThemeSettings() {
            let themeMgr = ThemeManager.instance();
            let watches = [];

            // Called when the current theme changes (including url refreshes)
            let updateFn = () => {
                let theme = themeMgr.currentTheme();
                this.theme = theme.name;
                this.customThemeUrl = theme.name.toLowerCase() === 'custom' ?
                    theme.url :
                    '';
            };

            let failedFn = () => {
                if (this.theme.toLowerCase() !== 'custom') {
                    let theme = themeMgr.currentTheme();
                    this.theme = theme.name;
                }
            };

            let watchTheme = (newVal) => {
                if (newVal.toLowerCase() !== 'custom') {
                    themeMgr.setTheme(newVal);
                }
            };

            let watchCustomThemeUrl = _.debounce((newVal) => {
                if (this.theme.toLowerCase() === 'custom') {
                    themeMgr.setCustomThemeUrl(newVal);
                }
            }, 800, { leading: false, trailing: true });

            // Remove all our attached events to cleanup
            let teardownFn = () => {
                this.$state.$off('theme.change', updateFn);
                this.$state.$off('theme.failed', failedFn);
                watches.forEach((unwatchFn) => unwatchFn());
                this.$off('hook:destroy', teardownFn);
            };

            // Update our info with the latest theme settings before we start
            // listening for changes
            updateFn();

            this.$state.$on('theme.change', updateFn);
            this.$state.$on('theme.failed', failedFn);
            this.$once('hook:destroyed', teardownFn);

            // $watch returns a function to stop watching the data field. Add them into
            // an array to make it easier to iterate over them all and unwatch them all
            // when needed.
            watches = [
                this.$watch('theme', watchTheme),
                this.$watch('customThemeUrl', watchCustomThemeUrl),
            ];
        },
        enableAdvancedTab() {
            this.settingAdvancedEnable = true;
            this.$nextTick(() => {
                this.showTab('advanced');
                this.$el.scrollTop = 0;
            });
        },
        makeDefaultProtocolHandler() {
            const { origin, pathname } = document.location;
            navigator.registerProtocolHandler('irc', origin + pathname + '#%s', 'Kiwi IRC');
            navigator.registerProtocolHandler('ircs', origin + pathname + '#%s', 'Kiwi IRC');
        },
        downloadDebugDump() {
            const dump = this.$state.getDebugDump();
            const blob = new Blob([dump], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `kiwi-debug-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },
    },
};
</script>

<style lang="less">
.kiwi-appsettings {
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
    padding: 0;
    position: relative;

    .u-form {
        width: 100%;
        overflow: hidden;
    }
}

.u-form label.kiwi-appsettings-setting-language.kiwi-appsettings-setting-language {
    display: flex;
    margin-bottom: 2em;
}

.kiwi-appsettings-setting-language select {
    flex-grow: 0;
    max-width: 200px;
}

.kiwi-appsettings-setting-language div {
    flex-grow: 1;
    text-align: right;
    margin-right: 1em;
}

.kiwi-appsettings-setting-language .fa-globe {
    vertical-align: middle;
    font-size: 1.8em;
}

.kiwi-appsettings-setting-theme span {
    margin-left: 0;
}

.kiwi-appsettings-setting-theme select {
    float: right;
}

.kiwi-appsettings-setting-theme-custom {
    .kiwi-appsettings .u-form & {
        display: flex;
        align-items: center;

        > input {
            flex-grow: 1;
        }
    }
}

.kiwi-appsettings-setting-showjoinpart span {
    max-width: none;
}

.kiwi-appsettings-full span,
.kiwi-appsettings-full input {
    width: 100%;
}

.kiwi-appsettings-aliases {
    padding: 1em 20px 2em 20px;
}

.kiwi-appsettings .kiwi-appsettings-setting-scrollback input {
    margin-right: 10px;
    width: 80px;
}

.kiwi-appsettings-tab-container {
    width: 100%;
}

.kiwi-appsettings .u-form label {
    display: block;
}

.kiwi-appsettings .u-form label span {
    text-align: left;
    margin-left: 0;
}

.kiwi-appsettings-theme-reload {
    margin-left: 1em;
    float: right;
    cursor: pointer;
}

.kiwi-settings-aliases-input {
    height: auto;
    min-height: 400px;
    line-height: normal;
    width: 100%;
    max-width: 100%;
    resize: vertical;
}

.kiwi-appsettings-block {
    max-width: 400px;
    width: auto;
    display: block;
    box-sizing: border-box;
    margin: 20px auto 20px auto;
}

.kiwi-appsettings-block.kiwi-appsettings-block-advanced {
    max-width: inherit;
    margin: 20px;
}

.kiwi-appsettings-block h3 {
    width: 100%;
    line-height: 45px;
    padding: 0 10px;
    box-sizing: border-box;
}

.kiwi-appsettings-section {
    padding: 10px;
}

.kiwi-appsettings-block-aliases {
    max-width: 750px;
}

.kiwi-appsettings-close {
    cursor: pointer;
    position: absolute;
    top: 0;
    right: 0;
    padding: 0 10px;
    font-weight: 600;
    box-sizing: border-box;
    text-transform: uppercase;
    line-height: 55px;
    text-align: right;
    transition: background 0.3s;
}

.kiwi-appsettings-close h2 {
    padding: 10px 0 11px 20px;
    width: auto;
    float: left;
}

.kiwi-appsettings-close a {
    float: right;
    position: static;
    background: none;
    border: none;
    padding: 10px 20px;
    font-size: 1.4em;
}

.kiwi-appsettings-close i {
    margin-left: 10px;
    font-size: 1.5em;
    float: right;
    line-height: 53px;
}

.kiwi-appsettings-messagelistDisplay select {
    float: right;
}

.kiwi-appsettings-operator-tools input {
    width: 100%;
}

@media screen and (max-width: 769px) {
    .kiwi-appsettings {
        width: 100%;
        z-index: 999;
        position: fixed;
        left: 0;
        top: 0;
        transition: left 0.5s;
    }

    .kiwi-appsettings .kiwi-appsettings-block {
        width: 90%;
    }

    .kiwi-appsettings .u-form label span {
        width: auto;
        margin-right: 0;
        display: inline-block;
    }

    .kiwi-appsettings-close,
    .kiwi-appsettings-close i {
        line-height: 46px;
    }
}
</style>
