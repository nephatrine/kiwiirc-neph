<template>
    <div
        :key="url"
        class="kiwi-url-embed"
    >
        <template v-if="fallbackPreview">
            <a
                class="kiwi-url-embed-card"
                :href="fallbackPreview.url || media.url"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
            >
                <img
                    v-if="previewImage"
                    :src="previewImage"
                    alt=""
                    loading="lazy"
                    class="kiwi-url-embed-card-image"
                    @click.stop.prevent="openPreviewImage"
                    @error="onPreviewImageError"
                >
                <span class="kiwi-url-embed-card-body">
                    <span class="kiwi-url-embed-card-site">
                        <i class="bx bx-link" aria-hidden="true" />
                        {{ fallbackPreview.providerName }}
                    </span>
                    <span v-if="fallbackPreview.title" class="kiwi-url-embed-card-title">
                        {{ fallbackPreview.title }}
                    </span>
                    <span
                        v-if="fallbackPreview.description"
                        class="kiwi-url-embed-card-description"
                    >
                        {{ fallbackPreview.description }}
                    </span>
                </span>
            </a>
        </template>
        <template v-else-if="media.type === 'image'">
            <div class="kiwi-url-embed-image">
                <img
                    :src="mediaUrl"
                    :style="mediaStyle"
                    alt=""
                    loading="lazy"
                    @load="onLoad"
                    @error="onError"
                    @click="openLightbox"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'vimeo'">
            <div class="kiwi-url-embed-vimeo" :style="containerStyle">
                <iframe
                    :src="`https://player.vimeo.com/video/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'embed'">
            <div class="kiwi-url-embed-frame" :style="containerStyle">
                <iframe
                    :src="media.src"
                    :allow="embedAllow"
                    frameborder="0"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'imgur'">
            <div class="kiwi-url-embed-imgur" :style="containerStyle">
                <iframe
                    :src="`https://imgur.com/a/${media.id}/embed?pub=true&context=false`"
                    frameborder="0"
                    allow="fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'audio'">
            <div class="kiwi-url-embed-audio">
                <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
                <audio
                    :src="mediaUrl"
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
                    :src="mediaUrl"
                    :style="mediaStyle"
                    controls
                    @loadedmetadata="onLoad"
                    @error="onError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'oembed' || media.type === 'metadata'">
            <div
                v-if="linkPreview && linkPreview.kind === 'embed'"
                class="kiwi-url-embed-oembed-frame"
                :style="linkPreviewEmbedStyle"
            >
                <iframe
                    :src="linkPreview.embedUrl"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    frameborder="0"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
            <a
                v-else-if="linkPreview"
                class="kiwi-url-embed-card"
                :class="{ 'kiwi-url-embed-card--banner': linkPreview.imageLayout === 'banner' }"
                :href="linkPreview.url || media.url"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
            >
                <img
                    v-if="previewImage"
                    :src="previewImage"
                    alt=""
                    loading="lazy"
                    class="kiwi-url-embed-card-image"
                    @click.stop.prevent="openPreviewImage"
                    @error="onPreviewImageError"
                >
                <span class="kiwi-url-embed-card-body">
                    <span class="kiwi-url-embed-card-site">
                        <i class="bx bx-link" aria-hidden="true" />
                        {{ linkPreview.providerName }}
                    </span>
                    <span v-if="linkPreview.title" class="kiwi-url-embed-card-title">
                        {{ linkPreview.title }}
                    </span>
                    <span
                        v-if="linkPreview.description"
                        class="kiwi-url-embed-card-description"
                    >
                        {{ linkPreview.description }}
                    </span>
                </span>
            </a>
            <div v-else-if="previewLoading" class="kiwi-url-embed-card-loading">
                {{ $t('link_preview_loading') }}
            </div>
        </template>
        <template v-else-if="media.type === 'youtube'">
            <div class="kiwi-url-embed-youtube" :style="containerStyle">
                <iframe
                    :src="`https://www.youtube-nocookie.com/embed/${media.id}`"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'youtube-playlist'">
            <div class="kiwi-url-embed-youtube" :style="containerStyle">
                <iframe
                    :src="`https://www.youtube-nocookie.com/embed/videoseries?list=${media.id}`"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'youtube-shorts'">
            <div class="kiwi-url-embed-youtube-shorts" :style="containerStyle">
                <iframe
                    :src="`https://www.youtube-nocookie.com/embed/${media.id}`"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'twitch-clip'">
            <div class="kiwi-url-embed-twitch" :style="containerStyle">
                <iframe
                    :src="`https://clips.twitch.tv/embed?clip=${media.id}&parent=${hostname}&theme=${themeMode}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'twitch-channel'">
            <div class="kiwi-url-embed-twitch" :style="containerStyle">
                <iframe
                    :src="`https://player.twitch.tv/?channel=${media.id}&parent=${hostname}&theme=${themeMode}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'twitch-video'">
            <div class="kiwi-url-embed-twitch" :style="containerStyle">
                <iframe
                    :src="`https://player.twitch.tv/?video=${media.id}&parent=${hostname}&theme=${themeMode}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
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
                    @error="onFrameError"
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
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'streamable'">
            <div class="kiwi-url-embed-streamable" :style="containerStyle">
                <iframe
                    :src="`https://streamable.com/o/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'redgifs'">
            <div class="kiwi-url-embed-redgifs" :style="containerStyle">
                <iframe
                    :src="`https://www.redgifs.com/ifr/${media.id}`"
                    frameborder="0"
                    allow="autoplay; fullscreen"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
                />
            </div>
        </template>
        <template v-else-if="media.type === 'spotify'">
            <div class="kiwi-url-embed-spotify" :class="`kiwi-url-embed-spotify--${media.id.split('/')[0]}`" :style="containerStyle">
                <iframe
                    :src="`https://open.spotify.com/embed/${media.id}`"
                    frameborder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    @load="onLoad"
                    @error="onFrameError"
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
                    @error="onFrameError"
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
                    @error="onFrameError"
                />
            </div>
        </template>
    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import { desktopMediaUrl } from '@/libs/desktop/Media';
import { embedParentHostname } from '@/libs/desktop/Embed';
import { resolveEmbedFallback, resolveLinkPreview } from '@/libs/LinkPreview';
import { resolvePagePreview } from '@/libs/PagePreview';
import ThemeManager from '@/libs/ThemeManager';

const MAX_MEDIA_HEIGHT = 400;

export default {
    props: ['url', 'showPin', 'iframeSandboxOptions'],
    data() {
        return {
            hostname: embedParentHostname(),
            mediaError: false,
            themeMode: 'light',
            linkPreview: null,
            previewLoading: false,
            fallbackPreview: null,
            removeEmbedErrorListener: null,
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
        mediaUrl() {
            return desktopMediaUrl(this.media.url);
        },
        embedAllow() {
            const allow = String(this.media.allow || '').trim();
            if (/\bfullscreen\b/i.test(allow)) {
                return allow;
            }
            return allow ? allow + '; fullscreen' : 'fullscreen';
        },
        previewImage() {
            return this.linkPreview && this.linkPreview.image ?
                desktopMediaUrl(this.linkPreview.image) :
                '';
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
            } else if (type === 'embed') {
                if (this.media.aspectRatio) {
                    styles.aspectRatio = this.media.aspectRatio;
                }
                if (this.media.height) {
                    styles.height = this.media.height;
                }
                if (this.media.maxWidth) {
                    styles.maxWidth = this.media.maxWidth;
                }
            } else if (['youtube', 'youtube-playlist', 'twitch-clip', 'twitch-channel', 'twitch-video', 'giphy', 'streamable', 'redgifs', 'fediverse', 'vimeo', 'imgur', 'soundcloud'].includes(type)) {
                styles.aspectRatio = '16 / 9';
            } else if (type === 'spotify') {
                delete styles.height;
            }

            return styles;
        },
        linkPreviewEmbedStyle() {
            const styles = {
                width: '100%',
                margin: '0 auto',
                maxWidth: this.showPin ? '600px' : '1000px',
            };
            if (this.showPin) {
                styles.maxHeight = MAX_MEDIA_HEIGHT + 'px';
            }
            if (this.linkPreview && this.linkPreview.aspectRatio) {
                styles.aspectRatio = this.linkPreview.aspectRatio;
            }
            return styles;
        },
    },
    watch: {
        url() {
            this.mediaError = false;
            this.linkPreview = null;
            this.previewLoading = false;
            this.fallbackPreview = null;
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
        if (window.kiwiDesktop && window.kiwiDesktop.embedErrors) {
            this.removeEmbedErrorListener = window.kiwiDesktop.embedErrors.on((event) => {
                const frame = this.$el && this.$el.querySelector('iframe');
                const src = frame ? frame.getAttribute('src') : '';
                if (src && event.url === src) {
                    this.onFrameError();
                }
            });
        }

        if (this.media.type) {
            this.onLoad();
        }
    },
    beforeDestroy() {
        if (this.removeEmbedErrorListener) {
            this.removeEmbedErrorListener();
            this.removeEmbedErrorListener = null;
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
        onFrameError() {
            if (this.fallbackPreview || this.previewLoading ||
                this.media.type === 'oembed' ||
                this.media.type === 'metadata') {
                return;
            }

            this.previewLoading = true;
            resolveEmbedFallback(this.media.url).then((preview) => {
                this.fallbackPreview = preview;
                this.linkPreview = preview;
                this.previewLoading = false;
                this.$nextTick(() => {
                    this.onLoad();
                });
            }).catch(() => {
                this.previewLoading = false;
                this.mediaError = true;
                this.$nextTick(() => {
                    this.updateEmbed();
                });
            });
        },
        onError() {
            // If direct media fails to load, there is nothing left to show.
            this.mediaError = true;
            this.$nextTick(() => {
                this.updateEmbed();
            });
        },
        onPreviewImageError() {
            if (this.linkPreview) {
                this.linkPreview.image = '';
            }
            if (this.fallbackPreview) {
                this.fallbackPreview.image = '';
            }
        },
        openLightbox() {
            this.$state.ui.lightbox_url = this.media.url;
        },
        openPreviewImage() {
            const image = (this.linkPreview && this.linkPreview.image) ||
                (this.fallbackPreview && this.fallbackPreview.image);
            if (image) {
                this.$state.ui.lightbox_url = image;
            }
        },
        resolvePreview() {
            this.loadPreview(() => resolveLinkPreview(this.media.url));
        },
        resolveMetadataPreview() {
            this.loadPreview(() => resolvePagePreview(this.media.url));
        },
        loadPreview(loader) {
            if (this.previewLoading || this.linkPreview) {
                return;
            }

            this.previewLoading = true;
            loader().then((preview) => {
                this.linkPreview = preview;
                this.previewLoading = false;
                this.$nextTick(() => {
                    this.onLoad();
                });
            }).catch(() => {
                if (this.media.type === 'metadata') {
                    Misc.markPreviewFailed(this.media.url);
                    this.$state.$emit('link-preview.failed', this.media.url);
                }
                this.linkPreview = null;
                this.previewLoading = false;
                this.mediaError = true;
                this.$nextTick(() => {
                    this.updateEmbed();
                });
            });
        },
        updateEmbed() {
            if (this.media.type === 'oembed') {
                this.resolvePreview();
                return;
            }

            if (this.media.type === 'metadata') {
                this.resolveMetadataPreview();
                return;
            }

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

.kiwi-url-embed-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 33em;
    overflow: hidden;
    padding: 10px 12px;
    border: 0;
    border-left: 3px solid rgb(127 127 127 / 45%);
    border-radius: 4px;
    background: rgb(127 127 127 / 6%);
    color: inherit;
    text-decoration: none;
}

.kiwi-url-embed-card-image {
    display: block;
    flex: 0 0 auto;
    order: 2;
    width: auto;
    max-width: 100%;
    height: 128px;
    max-height: 128px;
    border-radius: 3px;
    object-fit: contain;
    align-self: flex-start;
    cursor: pointer;
}

.kiwi-url-embed-card--banner {
    max-width: 560px;
    gap: 0;
    padding: 0;
}

.kiwi-url-embed-card--banner .kiwi-url-embed-card-image {
    order: 0;
    width: 100%;
    height: auto;
    max-height: none;
    border-radius: 0;
}

.kiwi-url-embed-card--banner .kiwi-url-embed-card-body {
    order: 1;
    padding: 10px 12px;
}

.kiwi-url-embed-card-body {
    display: flex;
    flex-direction: column;
    order: 1;
    gap: 6px;
    min-width: 0;
    padding: 0;
}

.kiwi-url-embed-card-site {
    display: flex;
    align-items: center;
    gap: 5px;
    opacity: 0.8;
    font-size: 0.85em;
}

.kiwi-url-embed-card-site .bx {
    font-size: 1em;
}

.kiwi-url-embed-card-title {
    font-size: 1.08em;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
    white-space: normal;
}

.kiwi-url-embed-card-description {
    opacity: 0.8;
    font-size: 0.9em;
    line-height: 1.4;
    overflow-wrap: anywhere;
    white-space: normal;
}

.kiwi-url-embed-card-loading {
    box-sizing: border-box;
    max-width: 33em;
    padding: 10px 12px;
    border-left: 3px solid rgb(127 127 127 / 45%);
    border-radius: 4px;
    background: rgb(127 127 127 / 6%);
    opacity: 0.7;
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
.kiwi-url-embed-redgifs,
.kiwi-url-embed-vimeo,
.kiwi-url-embed-imgur,
.kiwi-url-embed-frame,
.kiwi-url-embed-oembed-frame {
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
.kiwi-url-embed-vimeo iframe,
.kiwi-url-embed-imgur iframe,
.kiwi-url-embed-frame iframe,
.kiwi-url-embed-oembed-frame iframe,
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
