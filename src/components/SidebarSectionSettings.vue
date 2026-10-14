<template>
    <div class="kiwi-sidebar-buffersettings" @click.stop="">
        <tabbed-view ref="tabs">
            <tabbed-tab :header="$t('settings')" :focus="true" name="settings">
                <div
                    v-if="buffer.isChannel() && areWeAnOp"
                    class="kiwi-sidebar-settings"
                >
                    <h3>{{ $t('channel_topic') }}</h3>
                    <hr>
                    <form class="u-form" @submit.prevent="">
                        <label>
                            <textarea v-model.lazy="topic" rows="2" />
                        </label>
                    </form>

                    <template v-if="hasMetadata">
                        <h3>{{ $t('channel_branding') }}</h3>
                        <hr>
                        <p class="kiwi-sidebar-settings-warning">
                            <i class="fa fa-exclamation-triangle" aria-hidden="true" />
                            {{ $t('channel_metadata_warning') }}
                        </p>
                        <form class="u-form" @submit.prevent="">
                            <label>
                                <span>{{ $t('display_name') }}</span>
                                <input v-model.lazy="displayName" type="text" class="u-input">
                            </label>
                            <label>
                                <span>{{ $t('description') }}</span>
                                <textarea v-model.lazy="description" rows="2" />
                            </label>
                            <label>
                                <span>{{ $t('avatar_url') }}</span>
                                <input v-model.lazy="avatar" type="text" class="u-input">
                            </label>
                        </form>
                    </template>

                    <h3>{{ $t('channel_settings') }}</h3>
                    <hr>
                    <form class="u-form" @submit.prevent="">
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('channel_moderated') }}</span>
                            <input v-model="modeM" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('channel_invite') }}</span>
                            <input v-model="modeI" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('channel_secret') }}</span>
                            <input v-model="modeS" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('channel_moderated_topic') }}</span>
                            <input v-model="modeT" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('channel_external') }}</span>
                            <input v-model="modeN" type="checkbox">
                        </label>
                        <label>
                            <span>{{ $t('password') }}</span>
                            <input v-model.lazy="modeK" type="text" class="u-input">
                        </label>
                    </form>
                </div>

                <div class="kiwi-sidebar-settings">
                    <h3>{{ $t('side_settings') }}</h3>
                    <hr>
                    <form class="u-form">
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('favorite_channel') }}</span>
                            <input v-model="settingFavorite" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_joins') }}</span>
                            <input v-model="settingShowJoinParts" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_topics') }}</span>
                            <input v-model="settingShowTopics" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_nick_changes') }}</span>
                            <input v-model="settingShowNickChanges" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_mode_changes') }}</span>
                            <input v-model="settingShowModeChanges" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_formatting') }}</span>
                            <input v-model="settingExtraFormatting" type="checkbox">
                        </label>
                        <label class="u-checkbox-wrapper">
                            <span>{{ $t('side_colours') }}</span>
                            <input v-model="settingColouredNicklist" type="checkbox">
                        </label>
                        <label v-if="messageTagsSupported" class="u-checkbox-wrapper">
                            <span>{{ $t('settings_share_typing') }}</span>
                            <input v-model="settingShareTyping" type="checkbox">
                        </label>
                    </form>
                </div>
            </tabbed-tab>
            <tabbed-tab :header="$t('access')" name="access">
                <div class="kiwi-sidebar-settings">
                    <a
                        :class="{
                            'kiwi-sidebar-accesstab--active': accessTab === 'banlist',
                        }"
                        class="u-link kiwi-sidebar-accesstab"
                        @click="accessTab = 'banlist'"
                    >
                        {{ $t('banned') }}
                    </a>
                    <a
                        :class="{
                            'kiwi-sidebar-accesstab--active': accessTab === 'invitelist',
                        }"
                        class="u-link kiwi-sidebar-accesstab"
                        @click="accessTab = 'invitelist'"
                    >
                        {{ $t('invited') }}
                    </a>
                    <channel-banlist v-if="accessTab === 'banlist'" :buffer="buffer" />
                    <channel-invitelist v-if="accessTab === 'invitelist'" :buffer="buffer" />
                </div>
            </tabbed-tab>
            <tabbed-tab :header="$t('notifications')" name="notifications">
                <div class="kiwi-sidebar-settings">
                    <buffer-settings :buffer="buffer" />
                </div>
            </tabbed-tab>
            <tabbed-tab
                v-for="item in pluginUiElements"
                :key="item.id"
                :header="item.title()"
                :name="item.tabName"
            >
                <component
                    :is="item.component"
                    v-bind="item.props"
                    :network="network"
                    :buffer="buffer"
                    :sidebar-state="sidebarState"
                />
            </tabbed-tab>
        </tabbed-view>
    </div>
</template>

<script>
'kiwi public';

import GlobalApi from '@/libs/GlobalApi';

import ChannelBanlist from './ChannelBanlist';
import ChannelInvitelist from './ChannelInvitelist';
import BufferSettings from './BufferSettings';

// Helper to generate Vues computed methods for simple channel modes.
// Eg. +i, +n, etc
function generateComputedMode(mode) {
    return {
        get() {
            return this.modeVal(mode);
        },
        set(newVal) {
            return this.setMode((newVal ? '+' : '-') + mode);
        },
    };
}

// Helper to generate Vues computed methods for channel modes with a parameter
// Eg. "+k key"
function generateComputedModeWithParam(mode) {
    return {
        get() {
            let val = this.modeVal(mode);
            return val === false ?
                '' :
                val;
        },
        set(newVal) {
            if (newVal) {
                this.setMode('+' + mode, newVal);
            } else {
                this.setMode('-' + mode, this.modeVal(mode));
            }
        },
    };
}

// Helper to generate Vue's computed methods for getting/setting settings.
function generateComputedSetting(setting) {
    return {
        get() {
            return this.buffer.setting(setting);
        },
        set(newVal) {
            return this.buffer.setting(setting, newVal);
        },
    };
}

export default {
    components: {
        ChannelBanlist,
        ChannelInvitelist,
        BufferSettings,
    },
    props: ['network', 'buffer', 'sidebarState'],
    data() {
        return {
            pluginUiElements: GlobalApi.singleton().sideBarPlugins,
            accessTab: 'banlist',
        };
    },
    computed: {
        settingShowJoinParts: generateComputedSetting('show_joinparts'),
        settingShowTopics: generateComputedSetting('show_topics'),
        settingShowNickChanges: generateComputedSetting('show_nick_changes'),
        settingShowModeChanges: generateComputedSetting('show_mode_changes'),
        settingColouredNicklist: generateComputedSetting('coloured_nicklist'),
        settingExtraFormatting: generateComputedSetting('extra_formatting'),
        settingShareTyping: generateComputedSetting('share_typing'),
        settingFavorite: generateComputedSetting('favorite'),
        messageTagsSupported() {
            let network = this.buffer.getNetwork();
            return network && network.hasCap('message-tags');
        },
        areWeAnOp() {
            return this.buffer.isUserAnOp(this.buffer.getNetwork().nick);
        },
        hasMetadata() {
            return this.buffer.getNetwork().metadataCap();
        },
        topic: {
            get() {
                return this.buffer.topic;
            },
            set(newVal) {
                let newTopic = newVal.replace('\n', ' ');
                if (!newTopic.trim()) {
                    this.buffer.getNetwork().ircClient.raw(`TOPIC ${this.buffer.name} :`);
                } else {
                    this.buffer.getNetwork().ircClient.setTopic(this.buffer.name, newTopic);
                }
            },
        },
        displayName: {
            get() {
                return this.buffer.metadata['display-name'] || '';
            },
            set(newVal) {
                this.buffer.getNetwork().setMetadata(this.buffer.name, 'display-name', newVal);
            },
        },
        description: {
            get() {
                return this.buffer.metadata.description || '';
            },
            set(newVal) {
                this.buffer.getNetwork().setMetadata(this.buffer.name, 'description', newVal);
            },
        },
        avatar: {
            get() {
                return this.buffer.metadata.avatar || '';
            },
            set(newVal) {
                this.buffer.getNetwork().setMetadata(this.buffer.name, 'avatar', newVal);
            },
        },
        modeM: generateComputedMode('m'),
        modeI: generateComputedMode('i'),
        modeS: generateComputedMode('s'),
        modeT: generateComputedMode('t'),
        modeN: generateComputedMode('n'),
        modeK: generateComputedModeWithParam('k'),
    },
    methods: {
        setMode(mode, param) {
            this.buffer.getNetwork().ircClient.raw('MODE', this.buffer.name, mode, param);
        },
        modeVal(mode) {
            let val = false;

            if (typeof this.buffer.modes[mode] === 'undefined') {
                // Specifically undefined = mode not set
                val = false;
            } else if (!this.buffer.modes[mode]) {
                // Falsy value = mode set without value
                val = true;
            } else {
                // Anything else = mode set with a value
                val = this.buffer.modes[mode];
            }

            return val;
        },
    },
};
</script>

<style lang="less">
.kiwi-sidebar-buffersettings {
    overflow: hidden;
    height: 100%;
}

.kiwi-sidebar-settings {
    padding: 0 1em 1em 1em;

    &:first-of-type {
        margin-top: 1em;
    }

    h3 {
        margin-top: 20px;
        margin-bottom: 5px;
        font-size: 1.1em;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.7;
    }

    hr {
        margin-bottom: 15px;
        opacity: 0.2;
    }

    label {
        display: block;
        margin-bottom: 10px;

        span {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
        }
    }

    textarea,
    input[type='text'] {
        width: 100%;
        box-sizing: border-box;
    }

    .kiwi-sidebar-settings-warning {
        font-size: 0.9em;
        opacity: 0.8;
        color: var(--brand-warning);
        margin-bottom: 1em;
        font-style: italic;
    }

    .u-checkbox-wrapper {
        display: flex;
        align-items: center;

        span {
            order: 2;
            margin-bottom: 0;
            font-weight: normal;
            margin-left: 10px;
        }

        input {
            order: 1;
        }
    }
}

.kiwi-sidebar-settings-disabled {
    .u-form input[type='checkbox'] {
        cursor: not-allowed;
    }
}

.kiwi-channelsettings-disabled {
    float: right;
    border-radius: 4px;
    font-size: 0.8em;
    padding: 0 16px;

    > i {
        margin-left: 5px;
    }
}

.kiwi-sidebar-accesstab {
    margin-right: 1em;
}

.kiwi-sidebar-accesstab--active {
    font-weight: bold;
}

.kiwi-sidebar-settings-access-table {
    width: 100%;
    display: grid;
    grid-template-columns: 2fr minmax(0, 1fr) repeat(2, min-content);

    > div {
        border-bottom: 1px solid;
        padding-right: 4px;
    }

    &:not(.kiwi-sidebar-settings-access-restricted) {
        > div:nth-child(4n+4) {
            padding-right: initial;
        }
    }

    &.kiwi-sidebar-settings-access-restricted {
        grid-template-columns: 2fr minmax(0, 1fr) min-content;

        > div:nth-child(3n+3) {
            padding-right: initial;
        }
    }

    .kiwi-sidebar-settings-access-table-header {
        font-weight: 600;
        white-space: nowrap;
    }

    .kiwi-sidebar-settings-access-mask {
        word-break: break-all;
    }

    .kiwi-sidebar-settings-access-who {
        white-space: nowrap;
        overflow-x: hidden;
        text-overflow: ellipsis;
        position: relative;

        &:hover {
            white-space: initial;
            word-break: break-all;
        }
    }

    .kiwi-sidebar-settings-access-when {
        white-space: nowrap;
    }

    .kiwi-sidebar-settings-access-actions {
        text-align: center;
        position: relative;
        transition: all 0.3s;
        z-index: 1;

        > i {
            padding: 0 5px;
            cursor: pointer;
        }
    }
}
</style>
