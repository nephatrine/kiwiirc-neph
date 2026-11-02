'kiwi public';

import getState from '@/libs/state';
import { shortcodeToChar } from '@/res/emojiLookup';
import { escapeHtml } from '@/helpers/Utils';

const emojiByChar = new Map();
Object.keys(shortcodeToChar).forEach((shortcode) => {
    const char = shortcodeToChar[shortcode];
    if (!emojiByChar.has(char)) {
        emojiByChar.set(char, { char, shortcode });
    }
});

const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter ?
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }) :
    null;

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
            shortcode,
        },
    }];
}

export function blockToHtml(block, isSingle, showEmoticons) {
    if (block.meta.emoji) {
        return emojiSpan(block.meta.emoji, block.meta.shortcode);
    }
    return escapeHtml(block.content);
}

/**
 * Wrap only emoji that exactly match an entry in our database.
 * Unknown emoji, skin-tone variants, and unqualified forms are left as text.
 * @param {string} text
 * @returns {string}
 */
export function wrapEmojiText(text) {
    const source = String(text || '');
    if (!graphemeSegmenter) {
        return escapeHtml(source);
    }

    let html = '';
    Array.from(graphemeSegmenter.segment(source)).forEach(({ segment }) => {
        const emoji = emojiByChar.get(segment);
        html += emoji ? emojiSpan(segment, emoji.shortcode) : escapeHtml(segment);
    });
    return html;
}

function emojiSpan(char, shortcode) {
    const title = shortcode ? ` title=":${escapeHtml(shortcode)}:"` : '';
    return `<span class="kiwi-emoji"${title}>${escapeHtml(char)}</span>`;
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
    const match = word.match(/:([\p{L}\p{N}_+-]+):/u);
    return match ? match[1] : null;
}
