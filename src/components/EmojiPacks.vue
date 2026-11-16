<template>
    <div
        v-if="networkPackSupported || channels.length > 0"
        class="kiwi-appsettings-block kiwi-emojipacks"
    >
        <h3>{{ $t('settings_emoji_packs') }}</h3>
        <div class="kiwi-appsettings-section">
            <div class="kiwi-emojipacks-warning">
                {{ $t('settings_emoji_packs_warning') }}
            </div>

            <div
                v-if="networkPackSupported"
                class="kiwi-emojipacks-channel kiwi-emojipacks-network"
            >
                <div class="kiwi-emojipacks-channel-header">
                    <strong>{{ network.name }}</strong>
                    <button
                        v-if="networkPolicy !== 'never'"
                        type="button"
                        class="u-button u-button-secondary kiwi-emojipacks-load"
                        :disabled="!networkPacksEnabled ||
                            networkPackState.status === 'loading'"
                        @click="loadNetwork"
                    >
                        {{ networkPackState.packs.length ?
                            $t('settings_emoji_packs_refresh') :
                            $t('settings_emoji_packs_load')
                        }}
                    </button>
                    <label class="kiwi-emojipacks-policy">
                        <span>{{ $t('settings_emoji_packs_policy') }}</span>
                        <select
                            class="u-input"
                            :value="networkPolicy"
                            @change="changeNetworkPolicy($event.target.value)"
                        >
                            <option value="default">{{ $t('settings_default') }}</option>
                            <option value="always">{{ $t('settings_emoji_packs_policy_always') }}</option>
                            <option value="never">{{ $t('settings_emoji_packs_policy_never') }}</option>
                        </select>
                    </label>
                </div>
                <div v-if="networkPolicy === 'default'" class="kiwi-emojipacks-status">
                    {{ networkPacksEnabled ?
                        $t('settings_emoji_packs_policy_default_hint') :
                        $t('settings_emoji_packs_remote_disabled')
                    }}
                </div>
                <div
                    v-if="networkPacksEnabled && networkPackState.status === 'loading'"
                    class="kiwi-emojipacks-status"
                >
                    {{ $t('settings_emoji_packs_loading') }}
                </div>
                <div
                    v-else-if="networkPacksEnabled && networkPackState.error"
                    class="kiwi-emojipacks-error"
                >
                    {{ $t('settings_emoji_packs_error') }}
                    <span>{{ networkPackState.error }}</span>
                </div>
                <div
                    v-else-if="networkPacksEnabled && networkPackState.packs.length === 0"
                    class="kiwi-emojipacks-status"
                >
                    {{ $t('settings_emoji_packs_empty') }}
                </div>
                <div v-else-if="networkPacksEnabled" class="kiwi-emojipacks-list">
                    <div
                        v-for="(pack, index) in networkPackState.packs"
                        :key="pack.id + '-' + index"
                        class="kiwi-emojipacks-pack"
                    >
                        <span class="kiwi-emojipacks-pack-info">
                            <span class="kiwi-emojipacks-pack-name">{{ pack.name }}</span>
                            <span class="kiwi-emojipacks-pack-id">{{ pack.id }}</span>
                            <span v-if="pack.description" class="kiwi-emojipacks-pack-description">
                                {{ pack.description }}
                            </span>
                            <span v-if="!pack.supported" class="kiwi-emojipacks-pack-unsupported">
                                {{ $t('settings_emoji_packs_unsupported') }}
                            </span>
                            <a
                                v-if="pack.homepage"
                                :href="pack.homepage"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="kiwi-emojipacks-pack-homepage"
                            >{{ $t('settings_emoji_packs_homepage') }}</a>
                        </span>
                    </div>
                </div>
            </div>

            <div
                v-for="channel in channels"
                :key="channel.name"
                class="kiwi-emojipacks-channel"
            >
                <div class="kiwi-emojipacks-channel-header">
                    <strong>{{ channel.name }}</strong>
                    <span v-if="!channel.joined" class="kiwi-emojipacks-not-joined">
                        {{ $t('settings_emoji_packs_not_joined') }}
                    </span>
                    <label class="kiwi-emojipacks-policy">
                        <span>{{ $t('settings_emoji_packs_policy') }}</span>
                        <select
                            class="u-input"
                            :value="policyOf(channel.name)"
                            @change="changePolicy(channel.name, $event.target.value)"
                        >
                            <option value="prompt">{{ $t('settings_emoji_packs_policy_prompt') }}</option>
                            <option value="always">{{ $t('settings_emoji_packs_policy_always') }}</option>
                            <option value="never">{{ $t('settings_emoji_packs_policy_never') }}</option>
                        </select>
                    </label>
                    <button
                        v-if="policyOf(channel.name) === 'always'"
                        type="button"
                        class="u-button u-button-secondary kiwi-emojipacks-load"
                        :disabled="statusOf(channel.name).status === 'loading'"
                        @click="load(channel.name)"
                    >
                        {{ statusOf(channel.name).packs.length ?
                            $t('settings_emoji_packs_refresh') :
                            $t('settings_emoji_packs_load')
                        }}
                    </button>
                </div>

                <div v-if="policyOf(channel.name) === 'prompt'" class="kiwi-emojipacks-status">
                    {{ remoteEnabled ?
                        $t('settings_emoji_packs_policy_prompt_hint') :
                        $t('settings_emoji_packs_remote_disabled')
                    }}
                </div>
                <div v-else-if="policyOf(channel.name) === 'always'" class="kiwi-emojipacks-status">
                    <div v-if="!statusOf(channel.name).url">
                        {{ $t('settings_emoji_packs_metadata_pending') }}
                    </div>
                    <div v-else-if="statusOf(channel.name).status === 'loading'">
                        {{ $t('settings_emoji_packs_loading') }}
                    </div>
                    <div v-else-if="statusOf(channel.name).error" class="kiwi-emojipacks-error">
                        {{ $t('settings_emoji_packs_error') }}
                        <span>{{ statusOf(channel.name).error }}</span>
                    </div>
                    <div v-else-if="statusOf(channel.name).packs.length === 0">
                        {{ $t('settings_emoji_packs_empty') }}
                    </div>
                    <div v-else class="kiwi-emojipacks-list">
                        <div
                            v-for="(pack, index) in statusOf(channel.name).packs"
                            :key="pack.id + '-' + index"
                            class="kiwi-emojipacks-pack"
                        >
                            <span class="kiwi-emojipacks-pack-info">
                                <span class="kiwi-emojipacks-pack-name">{{ pack.name }}</span>
                                <span class="kiwi-emojipacks-pack-id">{{ pack.id }}</span>
                                <span v-if="pack.description" class="kiwi-emojipacks-pack-description">
                                    {{ pack.description }}
                                </span>
                                <span v-if="!pack.supported" class="kiwi-emojipacks-pack-unsupported">
                                    {{ $t('settings_emoji_packs_unsupported') }}
                                </span>
                                <a
                                    v-if="pack.homepage"
                                    :href="pack.homepage"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="kiwi-emojipacks-pack-homepage"
                                >{{ $t('settings_emoji_packs_homepage') }}</a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import {
    channelPackStateByName,
    channelPolicy,
    ensureChannelMetadata,
    ensureChannelPackByName,
    ensureServerPack,
    getChannelPolicyEntries,
    networkPackEnabled,
    networkPackPolicy,
    serverPackState,
    setChannelPolicy,
    setNetworkPackPolicy
} from '@/libs/EmojiPackStore';

export default {
    props: ['network'],
    computed: {
        remoteEnabled() {
            return this.$state.setting('remoteEmojiPacks') !== false;
        },
        networkPackSupported() {
            return typeof this.network.supports === 'function' &&
                !!this.network.supports('draft/EMOJI');
        },
        networkPolicy() {
            return networkPackPolicy(this.network);
        },
        networkPacksEnabled() {
            return networkPackEnabled(this.network);
        },
        networkPackState() {
            return serverPackState(this.network) || {
                url: '',
                status: '',
                error: '',
                packs: [],
            };
        },
        channels() {
            const rows = [];
            const seen = new Set();
            const add = (name, joined) => {
                const key = name.toLowerCase();
                if (seen.has(key)) {
                    return;
                }
                seen.add(key);
                rows.push({ name, joined });
            };

            this.network.buffers.forEach((buffer) => {
                if (buffer.isChannel() &&
                    buffer.metadata &&
                    buffer.metadata['draft/emoji']
                ) {
                    add(buffer.name, true);
                }
            });

            getChannelPolicyEntries(this.network).forEach((entry) => {
                add(entry.name, !!this.network.bufferByName(entry.name));
            });

            return rows.sort((left, right) => left.name.localeCompare(right.name));
        },
    },
    mounted() {
        ensureServerPack(this.network).catch(() => undefined);
        this.channels.forEach((channel) => {
            if (this.policyOf(channel.name) === 'always') {
                ensureChannelMetadata(this.network, channel.name);
            }
        });
    },
    methods: {
        statusOf(channelName) {
            return channelPackStateByName(this.network, channelName) || {
                url: '',
                status: 'detected',
                error: '',
                packs: [],
            };
        },
        policyOf(channelName) {
            return channelPolicy(this.network, channelName);
        },
        changePolicy(channelName, policy) {
            setChannelPolicy(this.network, channelName, policy);
        },
        changeNetworkPolicy(policy) {
            setNetworkPackPolicy(this.network, policy);
        },
        loadNetwork() {
            ensureServerPack(this.network, true).catch(() => undefined);
        },
        load(channelName) {
            const status = this.statusOf(channelName);
            if (status.url) {
                ensureChannelPackByName(this.network, channelName, true)
                    .catch(() => undefined);
            } else {
                ensureChannelMetadata(this.network, channelName)
                    .catch(() => undefined);
            }
        },
    },
};
</script>

<style lang="less">
.kiwi-emojipacks-warning {
    margin-bottom: 10px;
    opacity: 0.8;
}

.kiwi-emojipacks-channel {
    margin-bottom: 16px;
}

.kiwi-emojipacks-channel-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 6px;
}

.kiwi-emojipacks-not-joined {
    font-size: 0.85em;
    opacity: 0.7;
}

.kiwi-emojipacks-policy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;

    select {
        width: auto;
    }
}

.kiwi-emojipacks-status {
    opacity: 0.75;
}

.kiwi-emojipacks-error {
    color: var(--brand-error, #c0392b);
}

.kiwi-emojipacks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.kiwi-emojipacks-pack {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.kiwi-emojipacks-pack-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.kiwi-emojipacks-pack-name {
    font-weight: bold;
}

.kiwi-emojipacks-pack-id,
.kiwi-emojipacks-pack-description {
    opacity: 0.75;
}

.kiwi-emojipacks-pack-unsupported {
    color: var(--brand-warning, #b36b00);
}
</style>
