<template>
    <div class="kiwi-radio-browser">
        <div class="kiwi-radio-browser-header">
            <span>{{ $t('radio_stations') }}</span>
            <a
                class="kiwi-radio-browser-close"
                :title="$t('radio_close')"
                @click.stop="close(true)"
            >
                <i class="fa fa-times" aria-hidden="true" />
            </a>
        </div>
        <div v-if="radio.ui.loading" class="kiwi-radio-browser-status">
            {{ $t('radio_loading') }}
        </div>
        <div v-else-if="radio.ui.error" class="kiwi-radio-browser-status">
            {{ $t(radio.ui.error) }}
        </div>
        <div v-else-if="!radio.ui.stations.length" class="kiwi-radio-browser-status">
            {{ $t('radio_none') }}
        </div>
        <div v-else class="kiwi-radio-browser-list">
            <div
                v-for="station in ordered"
                :key="station.source"
                class="kiwi-radio-browser-station"
                :class="{ 'kiwi-radio-browser-station--active': radio.ui.currentName === station.name }"
                @click="radio.play(station)"
            >
                <img
                    v-if="station.image"
                    class="kiwi-radio-browser-image"
                    :src="station.image"
                    alt=""
                >
                <div v-else class="kiwi-radio-browser-image kiwi-radio-browser-image--empty">
                    <i class="fa fa-music" aria-hidden="true" />
                </div>
                <div class="kiwi-radio-browser-body">
                    <div class="kiwi-radio-browser-title">
                        <span class="kiwi-radio-browser-name">{{ station.name }}</span>
                        <a
                            class="kiwi-radio-browser-star"
                            :title="radio.isStarred(station.name) ? $t('radio_unstar') : $t('radio_star')"
                            @click.stop="radio.toggleStar(station.name)"
                        >
                            <i
                                :class="radio.isStarred(station.name) ? 'fa fa-star' : 'fa fa-star-o'"
                                aria-hidden="true"
                            />
                        </a>
                    </div>
                    <div
                        v-if="station.description || station.channels"
                        class="kiwi-radio-browser-description"
                        @click="onDetailsClick"
                        v-html="details(station)"
                    />
                    <div v-if="radio.ui.failed[station.name]" class="kiwi-radio-browser-error">
                        {{ $t('radio_error') }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import * as TextFormatting from '@/helpers/TextFormatting';
import { escapeHtml } from '@/helpers/Utils';
import { getRadio } from '@/libs/radio/player';

export default {
    data() {
        return {
            radio: getRadio(),
        };
    },
    computed: {
        ordered() {
            return this.radio.ui.stations.slice().sort((a, b) => {
                let aStar = this.radio.isStarred(a.name) ? 0 : 1;
                let bStar = this.radio.isStarred(b.name) ? 0 : 1;
                if (aStar !== bStar) {
                    return aStar - bStar;
                }
                return a.name.localeCompare(b.name);
            });
        },
    },
    mounted() {
        this.radio.ui.listOpen = true;
    },
    beforeDestroy() {
        this.radio.ui.listOpen = false;
    },
    methods: {
        details(station) {
            let text = [station.description, station.channels].filter(Boolean).join(' ');
            return TextFormatting.linkifyChannels(escapeHtml(text));
        },
        close(reopen) {
            this.radio.ui.listOpen = false;
            this.$state.$emit('active.component', null);
            if (reopen) {
                this.$state.$emit('statebrowser.show');
            }
        },
        onDetailsClick(event) {
            if (!event.target.closest('a[data-channel-name]')) {
                return;
            }
            event.stopPropagation();
            this.openChannel(event);
        },
        openChannel(event) {
            let el = event.target.closest('a[data-channel-name]');
            if (!el) {
                return;
            }
            event.preventDefault();
            let networks = this.$state.networks || [];
            let network = null;
            networks.forEach((item) => {
                if (!network && item.state === 'connected' && item.ircClient) {
                    network = item;
                }
            });
            if (!network || !network.ircClient) {
                return;
            }
            let name = el.getAttribute('data-channel-name');
            if (!name) {
                return;
            }
            this.$state.addBuffer(network.id, name);
            let buffer = this.$state.getBufferByName(network.id, name);
            if (buffer && !buffer.joined) {
                network.ircClient.join(name);
            }
            this.$state.setActiveBuffer(network.id, name);
            if (this.$state.ui.app_width <= 550) {
                this.close();
            }
        },
    },
};
</script>

<style lang="less">
.kiwi-radio-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.kiwi-radio-browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: bold;
}

.kiwi-radio-browser-status {
    padding: 12px;
}

.kiwi-radio-browser-list {
    overflow: auto;
    flex: 1;
}

.kiwi-radio-browser-station {
    display: flex;
    gap: 12px;
    margin: 6px 10px;
    padding: 8px;
    border: 1px solid var(--brand-midtone, #444);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
}

.kiwi-radio-browser-station:hover,
.kiwi-radio-browser-station--active {
    border-color: var(--brand-primary, #2f896b);
    box-shadow: inset 3px 0 0 var(--brand-primary, #2f896b);
}

.kiwi-radio-browser-image {
    width: 56px;
    height: 56px;
    object-fit: cover;
    flex: 0 0 auto;
    border-radius: 4px;
    background: var(--brand-midtone, #333);
}

.kiwi-radio-browser-image--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4em;
    opacity: 0.7;
}

.kiwi-radio-browser-body {
    min-width: 0;
    text-align: left;
}

.kiwi-radio-browser-close,
.kiwi-radio-browser-title a {
    cursor: pointer;
    user-select: none;
}

.kiwi-radio-browser-title {
    display: flex;
    gap: 8px;
    align-items: center;
}

.kiwi-radio-browser-name {
    flex: 1;
    font-weight: 700;
}

.kiwi-radio-browser-star {
    opacity: 0.85;
}

.kiwi-radio-browser-star:hover {
    opacity: 1;
}

.kiwi-radio-browser-description {
    margin-top: 4px;
    opacity: 0.8;
    font-size: 0.9em;
}

.kiwi-radio-browser-error {
    margin-top: 4px;
}
</style>
