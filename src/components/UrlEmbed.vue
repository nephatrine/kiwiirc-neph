<template>
    <div
        :key="url"
        class="kiwi-url-embed"
    >
        <template v-if="media.type === 'image'">
            <div class="kiwi-url-embed-image">
                <img
                    :src="media.url"
                    :style="mediaStyle"
                    alt=""
                    loading="lazy"
                    @load="onLoad"
                    @error="onError"
                    @click="openLightbox"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'audio'">
            <div class="kiwi-url-embed-audio">
                <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
                <audio
                    :src="media.url"
                    controls
                    @loadedmetadata="onLoad"
                    @error="onError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'video'">
            <div class="kiwi-url-embed-video">
                <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
                <video
                    :src="media.url"
                    :style="mediaStyle"
                    controls
                    @loadedmetadata="onLoad"
                    @error="onError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'youtube'">
            <div class="kiwi-url-embed-youtube" :style="containerStyle">
                <iframe
                    :src="`https://www.youtube-nocookie.com/embed/${media.id}`"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowfullscreen
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'youtube-shorts'">
            <div class="kiwi-url-embed-youtube-shorts" :style="containerStyle">
                <iframe
                    :src="`https://www.youtube-nocookie.com/embed/${media.id}`"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowfullscreen
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'twitch-clip'">
            <div class="kiwi-url-embed-twitch" :style="containerStyle">
                <iframe
                    :src="`https://clips.twitch.tv/embed?clip=${media.id}&parent=${hostname}&theme=${themeMode}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    allowfullscreen="true"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'twitch-channel'">
            <div class="kiwi-url-embed-twitch" :style="containerStyle">
                <iframe
                    :src="`https://player.twitch.tv/?channel=${media.id}&parent=${hostname}&theme=${themeMode}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    allowfullscreen="true"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'fediverse' && !sameOriginFediverse">
            <div class="kiwi-url-embed-fediverse" :style="containerStyle">
                <iframe
                    :src="`${media.url}/embed`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'giphy'">
            <div class="kiwi-url-embed-giphy" :style="containerStyle">
                <iframe
                    :src="`https://giphy.com/embed/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'streamable'">
            <div class="kiwi-url-embed-streamable" :style="containerStyle">
                <iframe
                    :src="`https://streamable.com/o/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    allowfullscreen
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'redgifs'">
            <div class="kiwi-url-embed-redgifs" :style="containerStyle">
                <iframe
                    :src="`https://www.redgifs.com/ifr/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    allowfullscreen
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'spotify'">
            <div class="kiwi-url-embed-spotify" :class="`kiwi-url-embed-spotify--${media.id.split('/')[0]}`" :style="containerStyle">
                <iframe
                    :src="`https://open.spotify.com/embed/${media.id}`"
                    frameborder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'soundcloud'">
            <div class="kiwi-url-embed-soundcloud" :style="containerStyle">
                <iframe
                    :src="soundcloudEmbedUrl"
                    frameborder="0"
                    allow="autoplay"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'steam'">
            <div class="kiwi-url-embed-steam">
                <iframe
                    :src="`https://store.steampowered.com/widget/${media.id}/`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                />
            </div>
        </template>
        <template v-else-if="settings.Key || settings.key">
            <div class="kiwi-mediaviewer-embedly">
                <a
                    ref="embedlyLink"
                    :href="url"
                    :data-card-key="settings.Key || settings.key"
                    :data-card-width="cardWidth"
                    :data-card-theme="themeMode"
                    class="kiwi-embedly-card"
                    data-card-chrome="0"
                    data-card-controls="0"
                    data-card-recommend="0"
                >{{ $t('media_loading', { url }) }}</a>
            </div>
        </template>
        <template v-else>
            <div class="kiwi-url-embed-fallback">
                <a
                    :href="url"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click="onFallbackClick"
                    @auxclick="onFallbackClick"
                >
                    <i class="fa fa-external-link" aria-hidden="true" /> {{ url }}
                </a>
            </div>
        </template>
    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import ThemeManager from '@/libs/ThemeManager';

let embedlyTagIncluded = false;

export default {
    props: ['url', 'showPin', 'iframeSandboxOptions'],
    data() {
        return {
            embedlyObject: null,
            waitTimer: 0,
            waitCount: 0,
            hostname: window.location.hostname,
            mediaError: false,
            themeMode: 'light',
        };
    },
    computed: {
        settings() {
            return this.$state.setting('embedly');
        },
        cardWidth() {
            if (!this.showPin) {
                return '600px';
            }

            return this.settings.cardWidth || '400px';
        },
        media() {
            if (this.mediaError) {
                return { type: '', url: this.url, id: '' };
            }
            const sanitized = Misc.sanitizeUrl(this.url);
            const info = Misc.getMediaInfo(sanitized);
            return info;
        },
        sameOriginFediverse() {
            return Misc.isSameOriginUrl(`${this.media.url}/embed`);
        },
        mediaStyle() {
            if (!this.showPin) {
                // Pinned container has a fixed height, so 100% works
                return { maxHeight: '100%' };
            }
            // Inline container has auto height, so we need a concrete limit
            return { maxHeight: (this.settings.maxHeight || 400) + 'px' };
        },
        soundcloudEmbedUrl() {
            const pageUrl = 'https://soundcloud.com/' + this.media.id;
            return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(pageUrl) + '&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true';
        },
        containerStyle() {
            const styles = {};
            const type = this.media.type;

            if (this.showPin) {
                styles.maxWidth = '600px';
                styles.width = '100%';
                styles.maxHeight = (this.settings.maxHeight || 400) + 'px';
            } else {
                styles.maxWidth = '1000px';
                styles.width = '100%';
                styles.height = '100%';
                styles.maxHeight = '100%';
                styles.margin = '0 auto';
            }

            if (type === 'youtube-shorts') {
                styles.aspectRatio = '9 / 16';
                if (this.showPin) {
                    styles.maxWidth = '250px';
                }
            } else if (['youtube', 'twitch-clip', 'twitch-channel', 'giphy', 'streamable', 'redgifs', 'fediverse', 'soundcloud'].includes(type)) {
                styles.aspectRatio = '16 / 9';
            } else if (type === 'spotify') {
                delete styles.height;
            }

            return styles;
        },
    },
    watch: {
        url() {
            this.mediaError = false;
            this.cleanEmbed();
            this.updateEmbed();
        },
    },
    created() {
        this.themeMode = ThemeManager.instance().themeMode();
        this.listen(this.$state, 'theme.change', () => {
            const nextMode = ThemeManager.instance().themeMode();
            if (nextMode !== this.themeMode) {
                this.themeMode = nextMode;
                if (this.embedlyObject) {
                    this.cleanEmbed();
                    this.updateEmbed();
                }
            }
        });
        this.updateEmbed();
    },
    mounted() {
        if (this.media.type) {
            this.onLoad();
        }
    },
    beforeDestroy() {
        this.cleanEmbed();
    },
    methods: {
        onLoad() {
            this.$emit('setHeight', 'auto');
            if (this.showPin) {
                this.$el.style.maxHeight = (this.settings.maxHeight || 400) + 'px';
                this.$emit('setMaxHeight', (this.settings.maxHeight || 400) + 'px');
            } else {
                this.$emit('setMaxHeight', '45%');
                this.$emit('setHeight', 'auto');
            }
        },
        onError() {
            // If direct media fails to load, mark as error and try fallback (Embedly or Link)
            this.mediaError = true;
            this.$nextTick(() => {
                this.updateEmbed();
            });
        },
        onFallbackClick(event) {
            if (event.type === 'auxclick' && event.button !== 1) {
                return;
            }
            if (!Misc.isSameOriginUrl(this.url) || Misc.isSafeSameOriginOpen(this.url)) {
                return;
            }
            event.preventDefault();
            Misc.downloadUrl(this.url);
        },
        openLightbox() {
            this.$state.ui.lightbox_url = this.media.url;
        },
        updateEmbed() {
            if (this.media.type) {
                // If we have a direct media type, we don't need embedly
                this.$nextTick(() => {
                    this.onLoad();
                });
                return;
            }

            if (!this.settings.Key && !this.settings.key) {
                // If no media type and no embedly key, we still need height for the fallback link
                this.$nextTick(() => {
                    this.onLoad();
                });
                return;
            }

            let checkEmbedlyAndShowCard = () => {
                if (typeof window.embedly !== 'function') {
                    if (this.waitTimer) {
                        clearTimeout(this.waitTimer);
                        this.waitTimer = 0;
                    }
                    if (this.waitCount < 300) {
                        this.waitCount++;
                        this.waitTimer = setTimeout(checkEmbedlyAndShowCard, 100);
                    }
                    return;
                }

                this.$nextTick(() => {
                    this.embedlyObject = window.embedly('card', this.$refs.embedlyLink);
                    if (!this.embedlyObject) {
                        if (this.showPin) {
                            this.$emit('close');
                        }
                        return;
                    }

                    this.embedlyObject.on('card.error', (iframe) => {
                        if (this.showPin) {
                            this.$emit('close');
                        }
                    });

                    this.onLoad();
                });
            };

            if (!embedlyTagIncluded) {
                const head = document.getElementsByTagName('head')[0];
                const script = document.createElement('script');
                script.type = 'text/javascript';
                const embedlyUrl = this.$state.getSetting('settings.embedly.script') ||
                    '//cdn.embedly.com/widgets/platform.js';
                script.src = embedlyUrl;
                head.appendChild(script);
                embedlyTagIncluded = true;
            }
            checkEmbedlyAndShowCard();
        },
        cleanEmbed() {
            if (this.waitTimer) {
                clearTimeout(this.waitTimer);
                this.waitTimer = 0;
            }
            if (this.embedlyObject) {
                this.embedlyObject.remove();
                this.embedlyObject = null;
            }
        },
    },
};

</script>

<style>
.kiwi-url-embed {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    max-width: 100%;
}

.kiwi-main-mediaviewer .kiwi-url-embed {
    display: flex;
    justify-content: center;
    height: 100%;
    width: 100%;
}

.kiwi-url-embed-image {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.kiwi-main-mediaviewer .kiwi-url-embed-image {
    justify-content: center;
}

.kiwi-url-embed-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    cursor: pointer;
    display: block;
}

.kiwi-url-embed-audio,
.kiwi-url-embed-video {
    width: 100%;
    max-width: 500px;
}

.kiwi-url-embed-video {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    max-width: 100%;
}

.kiwi-main-mediaviewer .kiwi-url-embed-video {
    justify-content: center;
    width: 100%;
    height: 100%;
}

.kiwi-url-embed-video video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
}

.kiwi-url-embed-youtube,
.kiwi-url-embed-youtube-shorts,
.kiwi-url-embed-twitch,
.kiwi-url-embed-fediverse,
.kiwi-url-embed-giphy,
.kiwi-url-embed-streamable,
.kiwi-url-embed-redgifs {
    position: relative;
    width: 100%;
    margin: 0;
}

.kiwi-url-embed-steam {
    position: relative;
    height: 190px;
    width: 100%;
    max-width: 600px;
    color-scheme: light;
}

.kiwi-main-mediaviewer .kiwi-url-embed-steam {
    height: 190px;
    max-width: 1000px;
    margin: 0 auto;
}

.kiwi-url-embed-spotify {
    position: relative;
    width: 100%;
    height: 352px;
    color-scheme: light;
}

.kiwi-url-embed-spotify--track {
    height: 152px;
}

.kiwi-url-embed-youtube iframe,
.kiwi-url-embed-youtube-shorts iframe,
.kiwi-url-embed-twitch iframe,
.kiwi-url-embed-fediverse iframe,
.kiwi-url-embed-giphy iframe,
.kiwi-url-embed-streamable iframe,
.kiwi-url-embed-redgifs iframe,
.kiwi-url-embed-spotify iframe,
.kiwi-url-embed-soundcloud iframe,
.kiwi-url-embed-steam iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.kiwi-url-embed-fallback {
    padding: 10px;
    border: 1px solid rgb(0 0 0 / 10%);
    border-radius: 4px;
}

.embedly-card {
    display: block;
    margin: 4px 0;
}

.kiwi-mediaviewer-embedly {
    display: inline-block;
    overflow: auto;
    color-scheme: light;
}
</style>
