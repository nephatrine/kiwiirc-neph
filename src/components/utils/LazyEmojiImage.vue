<template>
    <span class="kiwi-lazy-emoji">
        <img
            v-if="renderedSrc"
            :src="renderedSrc"
            :alt="alt"
            loading="lazy"
            decoding="async"
            @load="onLoad"
            @error="onError"
        >
    </span>
</template>

<script>
'kiwi public';

import {
    isImageLoaded,
    markImageLoaded,
    scheduleImageLoad
} from '@/libs/ImageLoadQueue';

let imageObserver = null;
const observerCallbacks = new WeakMap();

function getImageObserver() {
    if (typeof IntersectionObserver === 'undefined') {
        return null;
    }
    if (!imageObserver) {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                const callback = observerCallbacks.get(entry.target);
                if (callback) {
                    callback();
                }
                imageObserver.unobserve(entry.target);
                observerCallbacks.delete(entry.target);
            });
        }, {
            rootMargin: '200px',
        });
    }
    return imageObserver;
}

export default {
    props: {
        src: {
            type: String,
            default: '',
        },
        alt: {
            type: String,
            default: '',
        },
    },
    data() {
        return {
            renderedSrc: '',
            imageHandle: null,
            loadingStarted: false,
        };
    },
    watch: {
        src() {
            this.reset();
            this.observe();
        },
    },
    mounted() {
        this.observe();
    },
    beforeDestroy() {
        if (imageObserver) {
            imageObserver.unobserve(this.$el);
        }
        observerCallbacks.delete(this.$el);
        this.cancelLoad();
    },
    methods: {
        observe() {
            const observer = getImageObserver();
            if (!observer) {
                this.startLoad();
                return;
            }

            observerCallbacks.set(this.$el, () => this.startLoad());
            observer.observe(this.$el);
        },
        startLoad() {
            if (this.loadingStarted || !this.src) {
                return;
            }
            this.loadingStarted = true;

            if (isImageLoaded(this.src)) {
                this.renderedSrc = this.src;
                return;
            }

            this.imageHandle = scheduleImageLoad(() => {
                this.renderedSrc = this.src;
            });
        },
        release() {
            if (this.imageHandle) {
                this.imageHandle.release();
                this.imageHandle = null;
            }
        },
        cancelLoad() {
            if (this.imageHandle) {
                this.imageHandle.cancel();
                this.imageHandle = null;
            }
        },
        reset() {
            this.cancelLoad();
            this.renderedSrc = '';
            this.loadingStarted = false;
        },
        onLoad() {
            markImageLoaded(this.src);
            this.release();
        },
        onError() {
            this.release();
            this.renderedSrc = '';
        },
    },
};
</script>

<style lang="less" scoped>
.kiwi-lazy-emoji {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
}

.kiwi-lazy-emoji img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
