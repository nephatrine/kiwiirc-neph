'kiwi public';

/** @module */

import parseMessage from '@/libs/MessageParser';
import toHtml from '@/libs/renderers/Html';

/**
 * Render IRC formatted text as HTML, matching the user box realname output.
 *
 * @param {String} text IRC formatted text
 * @returns {String} HTML with escaped text, formatting, links, and emoji
 */
export function ircToHtml(text) {
    const blocks = parseMessage(String(text || ''), { extras: false });
    return toHtml(blocks, false);
}
