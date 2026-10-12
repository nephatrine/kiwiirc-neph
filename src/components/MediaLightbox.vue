<template>
    <transition name="kiwi-lightbox-transition">
        <div
            v-if="url"
            class="kiwi-lightbox"
            @click.self="close"
        >
            <div class="kiwi-lightbox-controls">
                <a
                    :title="$t('close')"
                    class="u-button u-button-warning kiwi-lightbox-close"
                    @click="close"
                >
                    <i class="fa fa-times" aria-hidden="true" />
                </a>
            </div>
            <div class="kiwi-lightbox-content" @click.self="close">
                <img :src="url" alt="" class="kiwi-lightbox-image" @click.stop />
            </div>
        </div>
    </transition>
</template>

<script>
'kiwi public';

export default {
    computed: {
        url() {
            return this.$state.ui.lightbox_url;
        },
    },
    methods: {
        close() {
            this.$state.ui.lightbox_url = '';
        },
    },
};
</script>

<style>
.kiwi-lightbox {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgb(0 0 0 / 85%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.kiwi-lightbox-controls {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10001;
}

.kiwi-lightbox-close {
    padding: 10px 15px;
    font-size: 1.5em;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
}

.kiwi-lightbox-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    overflow: hidden;
}

.kiwi-lightbox-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 0 20px rgb(0 0 0 / 50%);
    user-select: none;
}

.kiwi-lightbox-transition-enter-active,
.kiwi-lightbox-transition-leave-active {
    transition: opacity 0.2s ease;
}

.kiwi-lightbox-transition-enter,
.kiwi-lightbox-transition-leave-to {
    opacity: 0;
}

@media screen and (width <= 769px) {
    .kiwi-lightbox-content {
        padding: 10px;
    }

    .kiwi-lightbox-controls {
        top: 10px;
        right: 10px;
    }
}
</style>
