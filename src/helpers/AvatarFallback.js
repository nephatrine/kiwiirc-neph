import { hash32 } from '@/helpers/MurmurHash3';

export const LOCAL_IDENTICON = 'local-identicon';
export const LOCAL_INITIALS = 'local-initials';
export const CUSTOM_AVATAR_STYLE = 'custom';

const DICEBEAR_BASE = 'https://api.dicebear.com/10.x';

export const DICEBEAR_FALLBACK_URLS = {
    'dicebear-identicon': `${DICEBEAR_BASE}/identicon/svg?seed={nickname}`,
    'dicebear-bottts': `${DICEBEAR_BASE}/bottts/svg?seed={nickname}`,
    'dicebear-cameo': `${DICEBEAR_BASE}/cameo/svg?seed={nickname}`,
    'dicebear-gaze': `${DICEBEAR_BASE}/gaze/svg?seed={nickname}&animationVariant=medium`,
};

export const AVATAR_FALLBACK_STYLES = [
    {
        value: LOCAL_INITIALS,
        labelKey: 'settings_avatar_style_local_initials',
    },
    {
        value: LOCAL_IDENTICON,
        labelKey: 'settings_avatar_style_local_identicon',
    },
    {
        value: 'dicebear-identicon',
        labelKey: 'settings_avatar_style_dicebear_identicon',
    },
    {
        value: 'dicebear-bottts',
        labelKey: 'settings_avatar_style_dicebear_bottts',
    },
    {
        value: 'dicebear-cameo',
        labelKey: 'settings_avatar_style_dicebear_cameo',
    },
    {
        value: 'dicebear-gaze',
        labelKey: 'settings_avatar_style_dicebear_gaze',
    },
    {
        value: CUSTOM_AVATAR_STYLE,
        labelKey: 'settings_avatar_style_custom',
    },
];

export function getAvatarFallbackUrl(style) {
    return DICEBEAR_FALLBACK_URLS[style] || '';
}

export function avatarFallbackStyleFromUrl(url) {
    if (!url) {
        return LOCAL_IDENTICON;
    }

    const matchedStyle = Object.keys(DICEBEAR_FALLBACK_URLS)
        .find((style) => DICEBEAR_FALLBACK_URLS[style] === url);

    return matchedStyle || CUSTOM_AVATAR_STYLE;
}

export function isDiceBearFallbackStyle(style) {
    return Object.prototype.hasOwnProperty.call(DICEBEAR_FALLBACK_URLS, style);
}

function hashBit(hash, index) {
    return Math.floor(hash / (2 ** index)) % 2;
}

export function getLocalInitials(nick, length = 1) {
    let count = parseInt(length, 10);
    if (!count || count < 1) {
        count = 1;
    }
    if (count > 2) {
        count = 2;
    }

    const value = String(nick || 'User').trim() || 'User';
    return Array.from(value).slice(0, count).join('').toUpperCase();
}

export function getLocalIdenticon(nick) {
    const hash = hash32((nick || '').toLowerCase());
    const cells = [];
    const gridSize = 5;
    const cellSize = 12;
    const cellGap = 2;
    const step = cellSize + cellGap;
    const margin = (100 - (gridSize * cellSize + (gridSize - 1) * cellGap)) / 2;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
            if (!hashBit(hash, y * 3 + x)) {
                continue;
            }

            const addCell = (column) => {
                cells.push({
                    x: margin + column * step,
                    y: margin + y * step,
                    width: cellSize,
                    height: cellSize,
                    rx: 2.5,
                });
            };

            addCell(x);
            if (x < Math.floor(gridSize / 2)) {
                addCell(gridSize - 1 - x);
            }
        }
    }

    if (!cells.length) {
        cells.push({
            x: margin + 2 * step,
            y: margin + 2 * step,
            width: cellSize,
            height: cellSize,
            rx: 2.5,
        });
    }

    return cells;
}
