<template>
    <div v-if="available" class="kiwi-radio-controls">
        <div class="kiwi-radio-controls-row">
            <a :title="$t('radio_prev')" @click="radio.skip(-1)">
                <i class="fa fa-step-backward" aria-hidden="true" />
            </a>
            <a
                :title="radio.ui.playing ? $t('radio_pause') : $t('radio_play')"
                @click="radio.toggle()"
            >
                <i
                    :class="radio.ui.playing ? 'fa fa-pause' : 'fa fa-play'"
                    aria-hidden="true"
                />
            </a>
            <a :title="$t('radio_next')" @click="radio.skip(1)">
                <i class="fa fa-step-forward" aria-hidden="true" />
            </a>
            <span
                ref="nameTrack"
                class="kiwi-radio-controls-name"
                :title="radio.ui.currentName"
            >
                <span
                    ref="nameText"
                    class="kiwi-radio-controls-name-text"
                    :class="{ 'kiwi-radio-controls-name-text--scroll': nameScroll > 0 }"
                    :style="nameScrollStyle"
                >{{ radio.ui.currentName }}</span>
            </span>
            <a
                v-if="radio.ui.currentName"
                :title="radio.isStarred(radio.ui.currentName) ? $t('radio_unstar') : $t('radio_star')"
                @click="radio.toggleStar(radio.ui.currentName)"
            >
                <i
                    :class="radio.isStarred(radio.ui.currentName) ? 'fa fa-star' : 'fa fa-star-o'"
                    aria-hidden="true"
                />
            </a>
            <a :title="$t('radio_stations')" @click="openList">
                <i class="fa fa-list" aria-hidden="true" />
            </a>
        </div>
        <div
            v-if="radio.ui.trackTitle"
            ref="trackTrack"
            class="kiwi-radio-controls-track"
            :title="radio.ui.trackTitle"
        >
            <span
                ref="trackText"
                class="kiwi-radio-controls-track-text"
                :class="{ 'kiwi-radio-controls-track-text--scroll': trackScroll > 0 }"
                :style="trackScrollStyle"
            >{{ radio.ui.trackTitle }}</span>
        </div>
        <div class="kiwi-radio-controls-row">
            <a
                :title="radio.ui.muted ? $t('radio_unmute') : $t('radio_mute')"
                @click="radio.toggleMute()"
            >
                <i
                    :class="radio.ui.muted ? 'fa fa-volume-off' : 'fa fa-volume-up'"
                    aria-hidden="true"
                />
            </a>
            <input
                class="kiwi-radio-controls-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="radio.volume()"
                :aria-label="$t('radio_volume')"
                @input="onVolume"
            >
        </div>
        <canvas
            v-if="showWave"
            ref="wave"
            class="kiwi-radio-controls-wave"
            width="180"
            height="28"
        />
    </div>
</template>

<script>
'kiwi public';

import { getRadio } from '@/libs/radio/player';
import RadioBrowser from './RadioBrowser';

export default {
    data() {
        return {
            radio: getRadio(),
            waveFrame: 0,
            nameScroll: 0,
            nameObserver: null,
            trackScroll: 0,
            trackObserver: null,
        };
    },
    computed: {
        available() {
            return this.radio.ui.stations.length > 0 || this.radio.ui.playing;
        },
        showWave() {
            return this.$state.setting('radio.showWave')
                && this.radio.ui.playing
                && this.radio.ui.waveReady;
        },
        nameScrollStyle() {
            if (!this.nameScroll) {
                return null;
            }
            let travel = Math.max(3, this.nameScroll / 28);
            return {
                '--kiwi-radio-scroll': this.nameScroll + 'px',
                'animation-duration': (travel + 3) + 's',
            };
        },
        trackScrollStyle() {
            if (!this.trackScroll) {
                return null;
            }
            let travel = Math.max(3, this.trackScroll / 28);
            return {
                '--kiwi-radio-scroll': this.trackScroll + 'px',
                'animation-duration': (travel + 3) + 's',
            };
        },
    },
    watch: {
        available(show) {
            if (show) {
                this.$nextTick(() => {
                    this.observeName();
                    this.measureName();
                });
            }
        },
        'radio.ui.currentName'() {
            this.measureName();
        },
        'radio.ui.trackTitle'() {
            this.$nextTick(() => {
                if (!this.radio.ui.trackTitle) {
                    this.trackScroll = 0;
                    this.disconnectTrackObserver();
                    return;
                }
                this.observeTrack();
                this.measureTrack();
            });
        },
        showWave: {
            immediate: true,
            handler(show) {
                this.stopWave();
                if (show) {
                    this.drawWave();
                }
            },
        },
    },
    created() {
        if (!this.radio.enabled()) {
            return;
        }
        this.radio.loadStations();
        if (this.$state.setting('radio.autoPlay')) {
            this.$state.$once('document.clicked', () => {
                this.radio.playCurrent();
            });
        }
    },
    beforeDestroy() {
        this.stopWave();
        if (this.nameObserver) {
            this.nameObserver.disconnect();
            this.nameObserver = null;
        }
        this.disconnectTrackObserver();
    },
    methods: {
        observeName() {
            let track = this.$refs.nameTrack;
            if (!track || this.nameObserver || !window.ResizeObserver) {
                return;
            }
            this.nameObserver = new ResizeObserver(() => {
                this.measureName();
            });
            this.nameObserver.observe(track);
        },
        measureName() {
            this.$nextTick(() => {
                let track = this.$refs.nameTrack;
                let text = this.$refs.nameText;
                if (!track || !text) {
                    this.nameScroll = 0;
                    return;
                }
                let overflow = text.scrollWidth - track.clientWidth;
                this.nameScroll = overflow > 2 ? overflow : 0;
            });
        },
        observeTrack() {
            let track = this.$refs.trackTrack;
            if (!track || !window.ResizeObserver) {
                return;
            }
            this.disconnectTrackObserver();
            this.trackObserver = new ResizeObserver(() => {
                this.measureTrack();
            });
            this.trackObserver.observe(track);
        },
        measureTrack() {
            this.$nextTick(() => {
                let track = this.$refs.trackTrack;
                let text = this.$refs.trackText;
                if (!track || !text) {
                    this.trackScroll = 0;
                    return;
                }
                let overflow = text.scrollWidth - track.clientWidth;
                this.trackScroll = overflow > 2 ? overflow : 0;
            });
        },
        disconnectTrackObserver() {
            if (this.trackObserver) {
                this.trackObserver.disconnect();
                this.trackObserver = null;
            }
        },
        openList() {
            if (this.radio.ui.listOpen) {
                this.radio.ui.listOpen = false;
                this.$state.$emit('active.component', null);
                this.$state.$emit('statebrowser.show');
                return;
            }
            this.radio.ui.listOpen = true;
            if (this.$state.setting('radio.reloadOnOpen')) {
                this.radio.loadStations();
            }
            this.$state.$emit('active.component', RadioBrowser);
            this.$state.$emit('statebrowser.hide');
        },
        onVolume(event) {
            this.radio.setVolume(event.target.value);
        },
        stopWave() {
            if (this.waveFrame) {
                window.cancelAnimationFrame(this.waveFrame);
                this.waveFrame = 0;
            }
        },
        drawWave() {
            this.stopWave();
            let canvas = this.$refs.wave;
            let analyser = this.radio.ui.analyser;
            if (!canvas || !analyser || !this.showWave) {
                if (this.showWave) {
                    this.waveFrame = window.requestAnimationFrame(() => this.drawWave());
                }
                return;
            }
            let ctx = canvas.getContext('2d');
            let data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let styles = window.getComputedStyle(canvas);
            let top = styles.getPropertyValue('--brand-primary-hover').trim() || '#5ec9a6';
            let bottom = styles.getPropertyValue('--brand-primary').trim() || '#2f896b';
            let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, top);
            gradient.addColorStop(1, bottom);
            ctx.fillStyle = gradient;
            let bar = canvas.width / data.length;
            data.forEach((value, index) => {
                let height = (value / 255) * canvas.height;
                ctx.fillRect(index * bar, canvas.height - height, bar - 1, height);
            });
            this.waveFrame = window.requestAnimationFrame(() => this.drawWave());
        },
    },
};
</script>

<style lang="less">
.kiwi-radio-controls {
    padding: 6px 8px 8px;
    font-size: 0.9em;
    user-select: none;
}

.kiwi-radio-controls a {
    cursor: pointer;
}

@media screen and (max-width: 769px) {
    .kiwi-radio-controls a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1em;
        min-height: 1em;
    }
}

.kiwi-radio-controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.kiwi-radio-controls-row + .kiwi-radio-controls-row {
    margin-top: 6px;
}

.kiwi-radio-controls-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: left;
}

.kiwi-radio-controls-name-text {
    display: inline-block;
    white-space: nowrap;
}

.kiwi-radio-controls-name-text--scroll,
.kiwi-radio-controls-track-text--scroll {
    animation-name: kiwi-radio-scroll;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}

@keyframes kiwi-radio-scroll {
    0%,
    18% {
        transform: translateX(0);
    }

    82%,
    100% {
        transform: translateX(calc(-1 * var(--kiwi-radio-scroll)));
    }
}

@media (prefers-reduced-motion: reduce) {
    .kiwi-radio-controls-name-text--scroll,
    .kiwi-radio-controls-track-text--scroll {
        animation: none;
    }
}

.kiwi-radio-controls-track {
    margin-top: 2px;
    font-size: 0.8em;
    opacity: 0.8;
    overflow: hidden;
    text-align: left;
}

.kiwi-radio-controls-track-text {
    display: inline-block;
    white-space: nowrap;
}

.kiwi-radio-controls-volume {
    flex: 1;
    min-width: 0;
}

.kiwi-radio-controls-wave {
    display: block;
    width: 100%;
    height: 28px;
    margin-top: 6px;
}
</style>
