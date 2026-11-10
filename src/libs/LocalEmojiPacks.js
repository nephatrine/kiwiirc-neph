'kiwi public';

import Vue from 'vue';
import getState from '@/libs/state';
import desktop from '@/libs/desktop';

export const LOCAL_EMOJI_PACK_SCHEME = 'kiwi-emoji';

export const localEmojiPackState = Vue.observable({
    packages: [],
    packs: [],
});

function normalizeUrl(value, allowLocalScheme) {
    if (typeof value !== 'string' || !value) {
        return '';
    }

    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:' &&
            !(allowLocalScheme && url.protocol === `${LOCAL_EMOJI_PACK_SCHEME}:`)
        ) {
            return '';
        }
        if (url.username || url.password) {
            return '';
        }
        return url.href;
    } catch (err) {
        return '';
    }
}

function packFingerprint(supported, emoji) {
    const tokens = Object.keys(emoji).sort();
    return JSON.stringify([
        supported,
        tokens.map((token) => [token, emoji[token].url, emoji[token].alt]),
    ]);
}

function normalizePack(pack, pkg) {
    if (!pack || typeof pack !== 'object' ||
        typeof pack.id !== 'string' || !pack.id ||
        typeof pack.name !== 'string' || !pack.name
    ) {
        return null;
    }

    const emoji = {};
    if (pack.emoji && typeof pack.emoji === 'object' && !Array.isArray(pack.emoji)) {
        Object.keys(pack.emoji).forEach((token) => {
            const entry = pack.emoji[token];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const url = normalizeUrl(entry.url, true);
            if (!url) {
                return;
            }
            emoji[token] = {
                url,
                alt: typeof entry.alt === 'string' ? entry.alt : '',
            };
        });
    }

    if (Object.keys(emoji).length === 0) {
        return null;
    }

    const supported = pack.supported !== false;

    return {
        id: pack.id,
        name: pack.name,
        description: typeof pack.description === 'string' ? pack.description : '',
        authors: Array.isArray(pack.authors) ?
            pack.authors.filter((author) => typeof author === 'string') :
            [],
        homepage: normalizeUrl(pack.homepage, false),
        documentUrl: `${LOCAL_EMOJI_PACK_SCHEME}://${pkg.id}/emoji.json`,
        fingerprint: pack.fingerprint || packFingerprint(supported, emoji),
        supported,
        installed: true,
        desktopEmojiPackId: pkg.id,
        installedAt: Number(pkg.installedAt) || 0,
        emoji,
    };
}

/**
 * Replace the installed local emoji pack list.
 *
 * The main process returns packages containing one or more packs. The renderer
 * flattens them so pack lookup can use the same shape as remote packs.
 *
 * @param {Array} packages
 * @returns {{packages: Array, packs: Array}}
 */
export function setLocalEmojiPacks(packages) {
    const normalizedPackages = [];
    const packs = [];

    (Array.isArray(packages) ? packages : []).forEach((pkg) => {
        if (!pkg || typeof pkg.id !== 'string' || !pkg.id) {
            return;
        }

        const normalizedPacks = [];
        (Array.isArray(pkg.packs) ? pkg.packs : []).forEach((pack) => {
            const normalized = normalizePack(pack, pkg);
            if (normalized) {
                normalizedPacks.push(normalized);
                packs.push(normalized);
            }
        });

        if (normalizedPacks.length === 0) {
            return;
        }

        normalizedPackages.push({
            id: pkg.id,
            name: typeof pkg.name === 'string' && pkg.name ? pkg.name : pkg.id,
            installedAt: Number(pkg.installedAt) || 0,
            packs: normalizedPacks,
        });
    });

    normalizedPackages.sort((left, right) => (
        left.installedAt - right.installedAt ||
        left.id.localeCompare(right.id)
    ));
    packs.sort((left, right) => (
        left.installedAt - right.installedAt ||
        left.desktopEmojiPackId.localeCompare(right.desktopEmojiPackId) ||
        left.id.localeCompare(right.id)
    ));

    localEmojiPackState.packages = normalizedPackages;
    localEmojiPackState.packs = packs;
    getState().$emit('emoji.local-packs');

    return {
        packages: normalizedPackages,
        packs,
    };
}

/**
 * Reload installed emoji packages from the desktop shell.
 *
 * @returns {Promise<Array>}
 */
export async function refreshLocalEmojiPacks() {
    let packages = [];
    if (desktop.isDesktop() && desktop.emojiPacks.isAvailable()) {
        packages = await desktop.emojiPacks.list();
    }
    setLocalEmojiPacks(packages);
    return packages;
}

export function getLocalEmojiPacks() {
    return localEmojiPackState.packs;
}

export function getInstalledEmojiPackages() {
    return localEmojiPackState.packages;
}
