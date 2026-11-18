<template>
    <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style="position: fixed; width: 0; height: 0;"
    >
        <clipPath id="kiwi-avatar-clip">
            <circle r="50" cx="50" cy="50" />
        </clipPath>
        <clipPath id="kiwi-avatar-clip-square">
            <rect width="100" height="100" />
        </clipPath>
        <!-- Explicit user-space geometry keeps animated avatar images from
            forcing a layout pass every frame; the objectBoundingBox default
            depends on the masked element's bounding box.
        -->
        <mask
            id="kiwi-avatar-mask"
            maskUnits="userSpaceOnUse"
            x="-10"
            y="-10"
            width="120"
            height="120"
        >
            <rect width="100" height="100" fill="#fff" />
            <circle r="14" cx="50" cy="0" :transform="awayStatusTransform" />
        </mask>
    </svg>
</template>

<script>
'kiwi public';

import getState from '@/libs/state';

const avatarPositions = [45, 135, 225, 315];

function avatarAngle() {
    const position = getState().setting('avatars.away_status_position');
    return avatarPositions[position - 1] || 135;
}

export function getAvatarTransform() {
    return `rotate(${avatarAngle()} 50 50)`;
}

// Same point the SVG status circle is rotated to, as a percentage of the
// avatar box. Used to position the HTML status dot and its mask cut-out.
export function getAvatarStatusPoint() {
    const angle = (avatarAngle() * Math.PI) / 180;

    return {
        x: 50 + (50 * Math.sin(angle)),
        y: 50 - (50 * Math.cos(angle)),
    };
}

export default {
    computed: {
        awayStatusTransform: getAvatarTransform,
    },
};
</script>
