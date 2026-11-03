'kiwi public';

import getState from '@/libs/state';

let cachedSource = null;
let cachedTable = new Map();

function normalizeUrl(value) {
    if (typeof value !== 'string' || !value) {
        return '';
    }

    try {
        const url = value.startsWith('/') && !value.startsWith('//') ?
            new URL(value, window.location.href) :
            new URL(value);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
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

function customEmojiTable() {
    const source = getState().setting('customEmojis');
    if (source === cachedSource) {
        return cachedTable;
    }

    cachedSource = source;
    cachedTable = new Map();

    if (source && typeof source === 'object') {
        Object.keys(source).forEach((token) => {
            const url = normalizeUrl(source[token]);
            if (url) {
                cachedTable.set(token, url);
            }
        });
    }

    return cachedTable;
}

/**
 * Resolve a custom emoji token to its image URL.
 *
 * Local custom emoji values may be absolute http(s) URLs or root-relative
 * paths beginning with a single slash.
 *
 * @param {string} token
 * @returns {string}
 */
export function customEmojiUrl(token) {
    if (typeof token !== 'string' || !token) {
        return '';
    }
    return customEmojiTable().get(token) || '';
}

export function hasCustomEmoji(token) {
    return !!customEmojiUrl(token);
}

export function customEmojiTokens() {
    return Array.from(customEmojiTable().keys());
}
