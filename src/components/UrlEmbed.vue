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
    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import ThemeManager from '@/libs/ThemeManager';

const MAX_MEDIA_HEIGHT = 400;

export default {
    props: ['url', 'showPin', 'iframeSandboxOptions'],
    data() {
        return {
            hostname: window.location.hostname,
            mediaError: false,
            themeMode: 'light',
        };
    },
    computed: {
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
            return { maxHeight: MAX_MEDIA_HEIGHT + 'px' };
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
                styles.maxHeight = MAX_MEDIA_HEIGHT + 'px';
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
            this.updateEmbed();
        },
    },
    created() {
        this.themeMode = ThemeManager.instance().themeMode();
        this.listen(this.$state, 'theme.change', () => {
            this.themeMode = ThemeManager.instance().themeMode();
        });
        this.updateEmbed();
    },
    mounted() {
        if (this.media.type) {
            this.onLoad();
        }
    },
    methods: {
        onLoad() {
            this.$emit('setHeight', 'auto');
            if (this.showPin) {
                this.$el.style.maxHeight = MAX_MEDIA_HEIGHT + 'px';
                this.$emit('setMaxHeight', MAX_MEDIA_HEIGHT + 'px');
            } else {
                this.$emit('setMaxHeight', '45%');
                this.$emit('setHeight', 'auto');
            }
        },
        onError() {
            // If direct media fails to load, there is nothing left to show.
            this.mediaError = true;
            this.$nextTick(() => {
                this.updateEmbed();
            });
        },
        openLightbox() {
            this.$state.ui.lightbox_url = this.media.url;
        },
        updateEmbed() {
            if (this.media.type) {
                this.$nextTick(() => {
                    this.onLoad();
                });
                return;
            }

            // No native media: there is nothing to preview.
            this.$nextTick(() => {
                this.$emit('close');
            });
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

</style>
