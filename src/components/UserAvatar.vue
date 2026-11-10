<template>
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="kiwi-avatar">
        <g
            v-bind="awayStatus.vbind"
            clip-path="url(#kiwi-avatar-clip)"
        >
            <rect
                v-if="avatar.showBackground"
                width="100"
                height="100"
                class="kiwi-avatar-background"
                :style="avatar.backgroundStyle"
            />
            <image
                v-if="avatar.hasImage"
                v-bind="{ ...avatar[avatar.sizeKey[size]].vbind }"
                width="100"
                height="100"
                preserveAspectRatio="xMidYMid slice"
                loading="lazy"
                class="kiwi-avatar-image"
                @error="avatar[avatar.sizeKey[size]].setFailed()"
            />
            <template v-else>
                <rect
                    v-for="(cell, index) in avatar.identicon"
                    :key="index"
                    v-bind="cell"
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
import { getLocalIdenticon } from '@/helpers/AvatarFallback';
import { getAvatarTransform } from './UserAvatarCommon';

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
    forceShowStatus: {
        type: Boolean,
        default: false,
    },
    allowToggle: {
        type: Boolean,
        default: false,
    },
});

const getSizeObj = (size) => ({
    url: props.user.avatar[size],
    vbind: {
        'href': props.user.avatar[size],
        'xlink:href': props.user.avatar[size],
    },
    setFailed: () => {
        const avatar = props.user.avatar;
        const failedAvatar = avatar[size];
        avatar[size] = '';
        if (avatar.avatarSource) {
            avatar.small = '';
            avatar.large = '';
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
    vbind: {
        'href': props.message.bridged_avatar,
        'xlink:href': props.message.bridged_avatar,
    },
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

    return {
        show,
        vbind,
        transform,
    };
});

const avatar = computed(() => {
    const bridgedNick = props.message?.bridged_nick || '';
    const nick = bridgedNick || props.message?.nick || props.user?.nick || 'User';
    const overrideUrl = props.message?.bridged_avatar || '';
    const hasImage = !!overrideUrl ||
        !!(props.user && (props.user.avatar.small || props.user.avatar.large));

    const showBackground = !hasImage || state.setting('avatars.show_image_background');
    const backgroundStyle = {};

    const avatars = {
        hasImage,
        identicon: getLocalIdenticon(nick),
        showBackground,
        backgroundStyle,
        sizeKey: {},
    };

    if (bridgedNick) {
        backgroundStyle.fill = TextFormatting.createNickColour(bridgedNick);
    } else if (props.user) {
        backgroundStyle.fill = props.user.getColour();
    } else {
        backgroundStyle.fill = TextFormatting.createNickColour(nick);
    }

    if (overrideUrl) {
        avatars.small = getOverrideObj();
        avatars.sizeKey.small = 'small';
        avatars.large = getOverrideObj();
        avatars.sizeKey.large = 'large';
        return avatars;
    }

    if (!props.user) {
        return avatars;
    }

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

    return avatars;
});

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
    font-size: 0;
    line-height: 0;
    user-select: none;
}

.kiwi-avatar-status {
    transition: fill 0.5s ease;
}

.kiwi-avatar-status--toggle {
    cursor: pointer;
}

.kiwi-avatar-fallback-shape {
    fill: var(--brand-default-bg);
    opacity: 0.92;
}
</style>
