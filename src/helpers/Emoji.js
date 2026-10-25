'kiwi public';

import { shortcodeToChar } from '@/res/emojis';

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
 * Replace :shortcode: with native unicode emojis
 * @param {string} text
 * @returns {string}
 */
export function replaceShortcodes(text) {
    return text.replace(/:([\p{L}\p{N}_+-]+):/gu, (match, shortcode) => (
        shortcodeToChar[shortcode] || match
    ));
}
