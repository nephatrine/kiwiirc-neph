'kiwi public';

import { getCustomEmojiPickerItems, resolveCustomEmoji } from '@/libs/EmojiPackStore';
import { shortcodeToChar } from '@/res/emojiLookup';

export const curatedEmojis = [
    { char: '👍', shortcode: 'thumbsup' },
    { char: '❤️', shortcode: 'heart' },
    { char: '😂', shortcode: 'joy' },
    { char: '🔥', shortcode: 'fire' },
    { char: '🎉', shortcode: 'tada' },
    { char: '😮', shortcode: 'open_mouth' },
    { char: '😢', shortcode: 'cry' },
];

export const quickEmojis = curatedEmojis.slice(0, 3);

/**
 * Check whether an emoji is within a maximum Unicode version.
 * @param {Object} emoji
 * @param {number} maxVersion 0 means all versions
 * @returns {boolean}
 */
export function emojiWithinVersion(emoji, maxVersion) {
    const limit = Number(maxVersion);
    if (!limit) {
        return true;
    }
    return !emoji.version || Number(emoji.version) <= limit;
}

/**
 * Filter emoji groups by maximum Unicode version.
 * @param {Object} data
 * @param {number} maxVersion 0 means all versions
 * @returns {Object}
 */
export function filterEmojiData(data, maxVersion) {
    const limit = Number(maxVersion);
    if (!limit) {
        return data;
    }

    const filtered = {};
    Object.entries(data).forEach(([category, list]) => {
        filtered[category] = list.filter((emoji) => emojiWithinVersion(emoji, limit));
    });
    return filtered;
}

/**
 * List the Unicode versions present in the emoji data, newest first.
 * @param {Object} data
 * @returns {number[]}
 */
export function getEmojiVersions(data) {
    const versions = new Set();
    Object.values(data).forEach((list) => {
        list.forEach((emoji) => {
            if (emoji.version) {
                versions.add(Number(emoji.version));
            }
        });
    });
    return Array.from(versions).sort((a, b) => b - a);
}

/**
 * Check an emoji entry against a picker search term.
 * @param {Object} emoji
 * @param {string} filter
 * @returns {boolean}
 */
export function emojiMatches(emoji, filter) {
    const searchable = [emoji.shortcode, emoji.name, ...(emoji.aliases || [])]
        .join(' ')
        .toLowerCase();
    return searchable.includes(filter.toLowerCase());
}

/**
 * Resolve a reaction payload for display.
 *
 * Shortname reactions use custom emoji first, then the Unicode shortcode map.
 * Unicode emoji and arbitrary text pass through unchanged.
 *
 * @param {string} reaction
 * @returns {{text: string, label: string, url?: string}}
 */
export function reactionDisplay(reaction, buffer) {
    const text = String(reaction || '');
    const match = /^:([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+)(?:\/([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+))?:$/u.exec(text);
    if (!match) {
        return { text, label: text };
    }

    const token = match[1];
    const packId = match[2] || '';
    const custom = resolveCustomEmoji(token, buffer, packId);
    if (custom) {
        return {
            text,
            label: text,
            url: custom.url,
            alt: custom.alt,
        };
    }

    if (!packId && shortcodeToChar[token]) {
        return { text: shortcodeToChar[token], label: text };
    }

    return { text, label: text };
}

/**
 * Replace :shortcode: with native unicode emojis
 * @param {string} text
 * @returns {string}
 */
export function replaceShortcodes(text, buffer) {
    return text.replace(
        /:([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+)(?:\/([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+))?:/gu,
        (match, shortcode, packId) => {
            if (packId || resolveCustomEmoji(shortcode, buffer)) {
                return match;
            }
            return shortcodeToChar[shortcode] || match;
        }
    );
}

/**
 * Build autocomplete items for a partially typed emoji shortname.
 *
 * @param {string} prefix Current token, including the leading colon.
 * @param {Object} buffer Current buffer, used for custom pack lookup.
 * @returns {Array}
 */
export function getEmojiAutocompleteItems(prefix, buffer) {
    const query = String(prefix || '').replace(/^:/, '').toLowerCase();
    if (!query) {
        return [];
    }

    const custom = getCustomEmojiPickerItems(buffer);
    const seen = new Set();
    const items = [];

    custom.forEach((item) => {
        const token = item.shortcode.toLowerCase();
        const searchText = item.label || item.insertText;
        const matches = token.startsWith(query) ||
            searchText.toLowerCase().startsWith(':' + query);
        if (!matches) {
            return;
        }

        seen.add(token);
        items.push({
            text: item.insertText,
            filterText: item.label || item.insertText,
            insertText: item.insertText,
            name: ':' + item.shortcode + ':',
            alias: [item.shortcode, item.packId].filter(Boolean),
            type: 'emoji',
            sourceType: item.sourceType,
            packName: item.packName,
            channelName: item.channelName,
            packId: item.packId || '',
            packKey: item.packKey || '',
            url: item.url,
            alt: item.alt,
            char: '',
            token: item.shortcode,
        });
    });

    Object.keys(shortcodeToChar).forEach((token) => {
        const lower = token.toLowerCase();
        if (seen.has(lower) || !lower.startsWith(query)) {
            return;
        }

        items.push({
            text: `:${token}:`,
            filterText: `:${token}:`,
            insertText: `:${token}:`,
            name: `:${token}:`,
            alias: [token],
            type: 'emoji',
            sourceType: 'unicode',
            packId: '',
            packKey: '',
            url: '',
            alt: '',
            char: shortcodeToChar[token],
            token,
        });
    });

    return items;
}
