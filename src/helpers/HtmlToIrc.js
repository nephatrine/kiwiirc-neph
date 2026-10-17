'kiwi public';

/** @module */

import { stripStyles } from '@/helpers/Misc';

/**
 * Convert rich HTML (as produced by the contenteditable message input) into IRC
 * formatted text.
 *
 * The DOM is walked directly instead of using an HTML SAX parser, so the only
 * parser involved is the platform's own DOMParser.
 *
 * @param {String} html The HTML to convert into IRC formatted text
 * @param {Function} resolveColour Maps a CSS colour string to an IRC colour code
 * @returns {String} The IRC formatted text
 */
export function htmlToIrc(html, resolveColour) {
    let textValue = '';
    let pendingStyles = '';

    // Stack of style states for nested tags
    let styleStack = [{
        fg: '',
        bg: '',
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        mono: false,
        fancy: false,
    }];

    const getActive = () => styleStack[styleStack.length - 1];

    const pad = (code) => {
        if (!code || code[0] === '#') return code;
        return code.length === 1 ? '0' + code : code;
    };

    const flushStyles = (nextText) => {
        if (!pendingStyles) return;

        // Check for \x03 followed by a digit or comma.
        // If it is, we must make the \x03 reset explicit (\x0399) to avoid
        // it being misparsed as a color code for the following text.
        if (nextText && pendingStyles.endsWith('\x03')) {
            if ('0123456789,'.includes(nextText[0])) {
                pendingStyles += '99';
            }
        }

        textValue += pendingStyles;
        pendingStyles = '';
    };

    const parseStyle = (styleAttr) => {
        let styles = Object.create(null);
        if (!styleAttr) return styles;
        styleAttr.split(';').forEach((s) => {
            let parts = s.split(':');
            if (parts.length >= 2) {
                styles[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
            }
        });
        return styles;
    };

    const emitStyleChanges = (next, current) => {
        let out = '';

        // Optimization: if we are moving to a completely plain state,
        // just use the global reset character.
        const isPlain = !next.fg && !next.bg && !next.bold && !next.italic &&
            !next.underline && !next.strike && !next.mono && !next.fancy;

        if (isPlain && (current.fg || current.bg || current.bold || current.italic ||
            current.underline || current.strike || current.mono || current.fancy)) {
            return '\x0f';
        }

        // Handle Colors
        if (next.fg !== current.fg || next.bg !== current.bg) {
            let isNextHex = (next.fg && next.fg[0] === '#') || (next.bg && next.bg[0] === '#');
            if (isNextHex) {
                // Protocol \x04 requires a foreground if background is present.
                // We strictly only emit if a hex foreground is present.
                if (next.fg && next.fg[0] === '#') {
                    let fgHex = next.fg.substr(1);
                    let bgHex = next.bg && next.bg[0] === '#' ?
                        next.bg.substr(1) :
                        '';

                    out += '\x04' + fgHex;
                    if (bgHex) {
                        out += ',' + bgHex;
                    }
                } else if (!next.fg && !next.bg) {
                    // If both are cleared, emit hex reset
                    out += '\x04';
                }
            } else if (!next.fg && !next.bg) {
                // Standard IRC color reset
                out += '\x03';
            } else {
                // Standard IRC colors
                out += '\x03' + (pad(next.fg) || '99');
                if (next.bg || current.bg) {
                    out += ',' + (pad(next.bg) || '99');
                }
            }
        }

        if (next.bold !== current.bold) out += '\x02';
        if (next.italic !== current.italic) out += '\x1d';
        if (next.underline !== current.underline) out += '\x1f';
        if (next.strike !== current.strike) out += '\x1e';
        if (next.mono !== current.mono) out += '\x11';
        if (next.fancy !== current.fancy) out += '\x16';

        return out;
    };

    const styleForElement = (element, current) => {
        let next = Object.assign({}, current);
        let styleAttr = element.getAttribute('style');

        if (styleAttr) {
            let styles = parseStyle(styleAttr);
            if (styles.color) {
                next.fg = resolveColour(styles.color);
            }
            if (styles['background-color']) {
                next.bg = resolveColour(styles['background-color']);
            }
            if (styleAttr.indexOf('bold') > -1) {
                next.bold = !next.bold;
            }
            if (styleAttr.indexOf('italic') > -1) {
                next.italic = !next.italic;
            }
            if (styleAttr.indexOf('underline') > -1) {
                next.underline = !next.underline;
            }
            if (styleAttr.indexOf('line-through') > -1) {
                next.strike = !next.strike;
            }
            if (styleAttr.indexOf('monospace') > -1) {
                next.mono = !next.mono;
            }
            if (styleAttr.indexOf('kiwi-reverse') > -1) {
                next.fancy = !next.fancy;
            }
        }

        let name = element.tagName.toLowerCase();
        if (name === 'strong' || name === 'b') next.bold = !next.bold;
        if (name === 'em' || name === 'i') next.italic = !next.italic;
        if (name === 'u') next.underline = !next.underline;
        if (name === 'strike' || name === 's' || name === 'del') next.strike = !next.strike;
        if (name === 'code' || name === 'tt' || name === 'kbd') next.mono = !next.mono;

        return next;
    };

    const walk = (node) => {
        // Text node
        if (node.nodeType === 3) {
            flushStyles(node.nodeValue);
            textValue += node.nodeValue;
            return;
        }

        // Ignore anything that isn't an element (comments, etc)
        if (node.nodeType !== 1) {
            return;
        }

        let name = node.tagName.toLowerCase();

        // Line breaks and images do not open a style frame
        if (name === 'br') {
            flushStyles('\n');
            textValue += '\n';
            return;
        }

        if (name === 'img') {
            let alt = node.getAttribute('alt');
            if (alt) {
                flushStyles(alt);
                textValue += alt;
            }
            return;
        }

        if (name === 'div') {
            flushStyles('\n');
            textValue += '\n';
            node.childNodes.forEach(walk);
            return;
        }

        let current = getActive();
        let next = styleForElement(node, current);
        pendingStyles += emitStyleChanges(next, current);
        styleStack.push(next);

        node.childNodes.forEach(walk);

        styleStack.pop();
        let after = getActive();
        pendingStyles += emitStyleChanges(after, next);
    };

    let doc = new DOMParser().parseFromString(html || '', 'text/html');
    doc.body.childNodes.forEach(walk);

    // Final reset of any lingering styles
    let currentState = getActive();
    let hasStyles = currentState.fg || currentState.bg || currentState.bold ||
        currentState.italic || currentState.underline || currentState.strike ||
        currentState.mono || currentState.fancy;

    if (hasStyles) {
        pendingStyles += '\x0f';
    }
    flushStyles();

    // Firefox likes to add <br/> at the end (some times inside the span)
    // fix by filtering out any lines that contain no content
    return textValue.split(/\r?\n/).filter((line) => !!stripStyles(line)).join('\n');
}
