'kiwi public';

import getState from '@/libs/state';
import { parseEmojiValues, resolveCustomEmoji } from '@/libs/EmojiPackStore';
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

const EMOJI_SEGMENT_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u;

function emojiOnlyTextState(text) {
    if (!graphemeSegmenter) {
        return 'other';
    }

    let found = false;
    const segments = Array.from(graphemeSegmenter.segment(String(text || '')));

    for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i].segment;
        if (/^\s+$/u.test(segment)) {
            continue;
        }
        if (!emojiByChar.has(segment) && !EMOJI_SEGMENT_RE.test(segment)) {
            return 'other';
        }
        found = true;
    }

    return found ? 'emoji' : 'empty';
}

/**
 * Check whether a plain text value contains only emoji and whitespace.
 * @param {string} text
 * @returns {boolean}
 */
export function isEmojiOnlyText(text) {
    return emojiOnlyTextState(text) === 'emoji';
}

/**
 * Check whether parsed message blocks contain only emoji and whitespace.
 * @param {Array} blocks
 * @returns {boolean}
 */
export function isEmojiOnlyBlocks(blocks) {
    if (!Array.isArray(blocks)) {
        return false;
    }

    let found = false;
    for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (!block) {
            return false;
        }
        if (block.type === 'emoji') {
            found = true;
            continue;
        }
        if (block.type && block.type !== 'text') {
            return false;
        }

        const state = emojiOnlyTextState(block.content);
        if (state === 'other') {
            return false;
        }
        if (state === 'emoji') {
            found = true;
        }
    }

    return found;
}

export function matchEmoji(word, buffer) {
    if (!getState().setting('buffers.emoji_convert_incoming')) {
        return false;
    }

    const tokens = parseEmojiValues(word);
    if (tokens.length === 0) {
        return false;
    }

    const matches = [];
    tokens.forEach((token) => {
        const custom = resolveCustomEmoji(token.shortcode, buffer, token.packId);
        if (custom) {
            matches.push({
                index: token.index,
                match: token.match,
                type: 'emoji',
                meta: {
                    customEmojiUrl: custom.url,
                    customEmojiAlt: custom.alt,
                    packId: token.packId,
                    shortcode: token.shortcode,
                },
            });
            return;
        }

        if (!token.packId && shortcodeToChar[token.shortcode]) {
            matches.push({
                index: token.index,
                match: token.match,
                type: 'emoji',
                meta: {
                    emoji: shortcodeToChar[token.shortcode],
                    shortcode: token.shortcode,
                },
            });
        }
    });

    return matches;
}

export function blockToHtml(block, isSingle, showEmoticons) {
    if (block.meta.customEmojiUrl) {
        return customEmojiImg(
            block.meta.customEmojiUrl,
            block.meta.shortcode,
            block.meta.customEmojiAlt
        );
    }
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

function customEmojiImg(url, shortcode, alt) {
    const label = shortcode ? `:${shortcode}:` : '';
    const altText = typeof alt === 'string' && alt ? alt : label;
    return '<img class="kiwi-emoji kiwi-custom-emoji"' +
        ` src="${escapeHtml(url)}"` +
        ` alt="${escapeHtml(altText)}"` +
        ` title="${escapeHtml(label)}"` +
        ' referrerpolicy="no-referrer">';
}

export function getEmojis(word, buffer) {
    const shortcode = extractShortcode(word);
    if (!shortcode || !shortcodeToChar[shortcode.shortcode]) {
        return [];
    }

    if (resolveCustomEmoji(shortcode.shortcode, buffer)) {
        return [];
    }

    return [{
        shortcode: shortcode.shortcode,
        char: shortcodeToChar[shortcode.shortcode],
        index: shortcode.index,
        match: shortcode.match,
    }];
}

function extractShortcode(word) {
    const match = word.match(/:([\p{L}\p{N}_+-]+):/u);
    if (!match) {
        return null;
    }
    return {
        shortcode: match[1],
        index: match.index,
        match: match[0],
    };
}
