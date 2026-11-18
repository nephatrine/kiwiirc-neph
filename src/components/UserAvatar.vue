<template>
    <span
        v-if="avatar.hasImage"
        :class="[`kiwi-avatar--${shape}`, 'kiwi-avatar', 'kiwi-avatar--image']"
    >
        <span class="kiwi-avatar-frame" :style="frameStyle">
            <img
                :src="avatar[avatar.sizeKey[size]].url"
                class="kiwi-avatar-image"
                alt=""
                @error="avatar[avatar.sizeKey[size]].setFailed()"
            >
        </span>
        <span
            v-if="awayStatus.show"
            class="kiwi-avatar-status"
            :class="{
                'kiwi-avatar-status--toggle': allowToggle,
                'kiwi-avatar-status--away': user.isAway(),
                'kiwi-avatar-status--offline': user.isOffline(),
            }"
            :style="statusStyle"
            :title="allowToggle ? $t('toggle_away') : null"
            @click.stop="toggleAway"
        />
    </span>
    <svg
        v-else
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        width="100"
        height="100"
        :class="`kiwi-avatar--${shape}`"
        class="kiwi-avatar"
    >
        <g
            v-bind="awayStatus.vbind"
            :clip-path="`url(#${clipId})`"
        >
            <rect
                v-if="avatar.showBackground"
                width="100"
                height="100"
                class="kiwi-avatar-background"
                :style="avatar.backgroundStyle"
            />
            <template v-if="avatar.useInitials">
                <text
                    x="50"
                    y="50"
                    dy="0.36em"
                    text-anchor="middle"
                    class="kiwi-avatar-initials"
                    :style="avatar.fallbackFill ? { fill: avatar.fallbackFill } : null"
                    :font-size="avatar.initials.length === 1 ? '64px' : '44px'"
                >{{ avatar.initials }}</text>
            </template>
            <template v-else>
                <rect
                    v-for="(cell, index) in avatar.identicon"
                    :key="index"
                    v-bind="cell"
                    :style="avatar.fallbackFill ? { fill: avatar.fallbackFill } : null"
                    class="kiwi-avatar-fallback-shape"
                />
            </template>
        </g>
        <circle
            v-if="awayStatus.show"
            :transform="awayStatus.transform"
            r="12"
            cx="50"
            cy="0"
            class="kiwi-avatar-status"
            :class="{
                'kiwi-avatar-status--toggle': allowToggle,
                'kiwi-avatar-status--away': user.isAway(),
                'kiwi-avatar-status--offline': user.isOffline(),
            }"
            @click.stop="toggleAway"
        >
            <title v-if="allowToggle">{{ $t('toggle_away') }}</title>
        </circle>
    </svg>
</template>

<script>
'kiwi public';

import { computed } from 'vue';

import getState from '@/libs/state';
import * as TextFormatting from '@/helpers/TextFormatting';
import {
    LOCAL_INITIALS,
    getConfiguredAvatarFallbackUrl,
    getLocalIdenticon,
    getLocalInitials
} from '@/helpers/AvatarFallback';
import {
    avatarLoadState,
    markAvatarFailed,
    requestAvatarLoad
} from '@/libs/AvatarCache';
import { getAvatarStatusPoint, getAvatarTransform } from './UserAvatarCommon';

</script>

<script setup>
const state = getState();
const props = defineProps({
    user: {
        type: Object,
        default: null,
    },
    message: {
        type: Object,
        default: null,
    },
    network: {
        type: Object,
        default: null,
    },
    size: {
        type: String,
        default: 'small',
    },
    shape: {
        type: String,
        default: 'circle',
        validator: (value) => ['circle', 'square'].indexOf(value) !== -1,
    },
    forceShowStatus: {
        type: Boolean,
        default: false,
    },
    allowToggle: {
        type: Boolean,
        default: false,
    },
});

const clipId = computed(() => (
    props.shape === 'square' ? 'kiwi-avatar-clip-square' : 'kiwi-avatar-clip'
));

const getSizeObj = (size) => ({
    url: props.user.avatar[size],
    setFailed: () => {
        const avatar = props.user.avatar;
        const failedAvatar = avatar[size];
        const source = String(avatar.avatarSource || '');
        avatar[size] = '';
        if (avatar.avatarSource) {
            avatar.small = '';
            avatar.large = '';
        }
        if (source.startsWith('fallback:')) {
            markAvatarFailed(failedAvatar);
        }
        if (!avatar.small && !avatar.large) {
            state.$emit('user.avatar.failed', {
                user: props.user,
                network: props.network,
                failed: failedAvatar,
            });
        }
    },
});

const getOverrideObj = () => ({
    url: props.message.bridged_avatar,
    setFailed: () => {
        props.message.bridged_avatar = '';
    },
});

const shouldShowStatus = () => {
    if (!props.network || !props.user) {
        return false;
    }

    if (props.forceShowStatus) {
        return true;
    }

    if (props.network.state !== 'connected' || !state.setting('showAwayStatusIndicators')) {
        return false;
    }

    const awayNotifyEnabled = props.network.hasCap('away-notify');
    return state.setting('buffers.who_loop') || awayNotifyEnabled;
};

const awayStatus = computed(() => {
    const show = shouldShowStatus();

    const vbind = {};
    if (show) {
        vbind.mask = 'url(#kiwi-avatar-mask)';
    }

    const transform = getAvatarTransform();
    const point = getAvatarStatusPoint();

    return {
        show,
        vbind,
        transform,
        point,
    };
});

const avatar = computed(() => {
    const bridgedNick = props.message?.bridged_nick || '';
    const nick = bridgedNick || props.message?.nick || props.user?.nick || 'User';
    const overrideUrl = props.message?.bridged_avatar || '';
    const userAvatar = props.user ? props.user.avatar : null;
    const userAvatarSource = userAvatar ? String(userAvatar.avatarSource || '') : '';
    const userFallbackUrl = userAvatarSource.startsWith('fallback:') ?
        (userAvatar.small || userAvatar.large) :
        '';
    const unknownFallbackUrl = props.user ?
        '' :
        getConfiguredAvatarFallbackUrl(nick, state);
    const fallbackUrl = unknownFallbackUrl || userFallbackUrl;
    const fallbackState = fallbackUrl ? avatarLoadState(fallbackUrl) : 'none';

    if (fallbackUrl && fallbackState === 'idle') {
        requestAvatarLoad(fallbackUrl);
    }

    const fallbackReady = fallbackState === 'loaded';
    const userImageReady = !!userAvatar && !userFallbackUrl &&
        !!(userAvatar.small || userAvatar.large);
    const hasImage = !!overrideUrl || fallbackReady || userImageReady;

    const showBackground = state.setting('avatars.show_image_background') !== false;
    const backgroundStyle = {};
    const useInitials = state.setting('avatars.fallback_style') === LOCAL_INITIALS;
    const initialsLength = state.setting('avatars.initials_length') || 1;

    const avatars = {
        hasImage,
        useInitials,
        initials: useInitials ? getLocalInitials(nick, initialsLength) : '',
        identicon: useInitials ? [] : getLocalIdenticon(nick),
        showBackground,
        backgroundStyle,
        fallbackFill: '',
        sizeKey: {},
    };

    if (bridgedNick) {
        backgroundStyle.fill = TextFormatting.createNickColour(bridgedNick);
    } else if (props.user) {
        backgroundStyle.fill = props.user.getColour();
    } else {
        backgroundStyle.fill = TextFormatting.createNickColour(nick);
    }

    avatars.fallbackFill = showBackground ? '' : backgroundStyle.fill;

    if (overrideUrl) {
        avatars.small = getOverrideObj();
        avatars.sizeKey.small = 'small';
        avatars.large = getOverrideObj();
        avatars.sizeKey.large = 'large';
        return avatars;
    }

    if (!props.user) {
        if (fallbackReady) {
            const fallbackObj = {
                url: unknownFallbackUrl,
                setFailed: () => {
                    markAvatarFailed(unknownFallbackUrl);
                },
            };
            avatars.small = fallbackObj;
            avatars.sizeKey.small = 'small';
            avatars.large = fallbackObj;
            avatars.sizeKey.large = 'large';
        }
        return avatars;
    }

    if (userImageReady || fallbackReady) {
        if (props.user.avatar.small) {
            avatars.small = getSizeObj('small');
            avatars.sizeKey.small = 'small';
            if (!props.user.avatar.large) {
                avatars.sizeKey.large = 'small';
            }
        }

        if (props.user.avatar.large) {
            avatars.large = getSizeObj('large');
            avatars.sizeKey.large = 'large';
            if (!props.user.avatar.small) {
                avatars.sizeKey.small = 'large';
            }
        }
    }

    return avatars;
});

const frameStyle = computed(() => {
    const style = {};

    if (avatar.value.showBackground) {
        style.backgroundColor = avatar.value.backgroundStyle.fill;
    }

    if (awayStatus.value.show) {
        const point = awayStatus.value.point;
        style.maskImage = 'radial-gradient(ellipse 14% 14% at ' +
            `${point.x}% ${point.y}%, transparent 98%, #000 100%)`;
    }

    return style;
});

const statusStyle = computed(() => ({
    left: `${awayStatus.value.point.x}%`,
    top: `${awayStatus.value.point.y}%`,
}));

const toggleAway = () => {
    if (!props.allowToggle || props.user.away === 'offline') {
        return;
    }
    const isAway = props.user.isAway();
    props.network.ircClient.raw('AWAY', isAway ? '' : TextFormatting.t('default_away_message'));
};
</script>

<style lang="less">
.kiwi-avatar {
    display: block;
    max-width: 100px;
    max-height: 100px;
    font-size: 0;
    line-height: 0;
    user-select: none;
}

.kiwi-avatar--image {
    position: relative;
}

.kiwi-avatar-frame {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.kiwi-avatar--circle .kiwi-avatar-frame {
    border-radius: 50%;
}

.kiwi-avatar-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.kiwi-avatar-status {
    transition: fill 0.5s ease, background-color 0.5s ease;
}

.kiwi-avatar--image .kiwi-avatar-status {
    position: absolute;
    width: 24%;
    height: 24%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
}

.kiwi-avatar-status--toggle {
    cursor: pointer;
}

.kiwi-avatar-fallback-shape {
    fill: var(--brand-default-bg);
    opacity: 0.92;
}

.kiwi-avatar-initials {
    font-family: Arial, sans-serif;
    font-weight: 900;
}
</style>
