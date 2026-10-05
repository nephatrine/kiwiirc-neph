'kiwi public';

import getState from '@/libs/state';
import { shortcodeToChar } from '@/res/emojis';

export function matchEmoji(word) {
    if (!getState().setting('buffers.emoji_convert_incoming')) {
        return false;
    }

    const shortcode = extractShortcode(word);
    if (!shortcode || !shortcodeToChar[shortcode]) {
        return false;
    }

    return [{
        index: word.indexOf(':' + shortcode + ':'),
        match: ':' + shortcode + ':',
        type: 'emoji',
        meta: {
            emoji: shortcodeToChar[shortcode],
        },
    }];
}

export function blockToHtml(block, isSingle, showEmoticons) {
    // Native unicode emojis are just text
    return block.meta.emoji || block.content;
}

export function getEmojis(word) {
    const shortcode = extractShortcode(word);
    if (!shortcode || !shortcodeToChar[shortcode]) {
        return [];
    }

    return [{
        shortcode: shortcode,
        char: shortcodeToChar[shortcode],
    }];
}

function extractShortcode(word) {
    const match = word.match(/:([a-z0-9_+-]+):/);
    return match ? match[1] : null;
}
