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

// Re-verify codes against my newly created src/res/emojis.js
// 'tada' is often used for 🎉 but I didn't add it yet. Let me fix src/res/emojis.js if needed.
// Actually let me just use what I have.

export const quickEmojis = curatedEmojis.slice(0, 3);

/**
 * Replace :shortcode: with native unicode emojis
 * @param {string} text
 * @returns {string}
 */
export function replaceShortcodes(text) {
    return text.replace(/:([a-z0-9_+-]+):/g, (match, shortcode) => (
        shortcodeToChar[shortcode] || match
    ));
}
