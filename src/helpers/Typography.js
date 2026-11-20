'kiwi public';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const CODE_SPAN_PATTERN = /`[^`]*`/g;
const IRC_MONOSPACE_PATTERN = /\x11[^\x11]*\x11/g;
const IRC_CONTROL_PATTERN = /\x03(?:\d{1,2}(?:,\d{1,2})?)?|\x04(?:[0-9a-fA-F]{6}(?:,[0-9a-fA-F]{6})?)?|[\x02\x0F\x11\x16\x1D\x1E\x1F]/g;
const PROTECTED_PATTERN = /\uE000(\d+)\uE001/g;
const CONTROL_SENTINEL = '\uE100';

function protectMatches(text, pattern, store) {
    return text.replace(pattern, (match) => {
        const token = `\uE000${store.length}\uE001`;
        store.push(match);
        return token;
    });
}

function restoreMatches(text, store) {
    return text.replace(PROTECTED_PATTERN, (match, index) => (
        store[Number(index)]
    ));
}

function maskControlCodes(text, store) {
    return text.replace(IRC_CONTROL_PATTERN, (match) => {
        store.push(match);
        return CONTROL_SENTINEL;
    });
}

function restoreControlCodes(text, store) {
    let index = 0;
    return text.replace(new RegExp(CONTROL_SENTINEL, 'g'), () => (
        store[index++] || ''
    ));
}

function replaceRuns(text, pattern, replacements) {
    return text.replace(pattern, (run) => (
        replacements[run.length] || run
    ));
}

function educateQuotes(text) {
    let result = text;

    // Decade abbreviations before the opening-quote pass.
    result = result.replace(/'(?=\d)/g, '\u2019');

    result = result.replace(
        /(^|[\s\u00A0\uE100([{\u2013\u2014-])'(?=\w)/g,
        '$1\u2018'
    );
    result = result.replace(/([^\s\uE100[({-])'/g, '$1\u2019');
    result = result.replace(/([ \t\r\n\uE100[({-]?)'(?=\s|s\b)/gi, '$1\u2019');
    result = result.replace(/'/g, '\u2018');

    result = result.replace(
        /(^|[\s\u00A0\uE100([{\u2013\u2014-])"(?=\w)/g,
        '$1\u201c'
    );
    result = result.replace(/([^\s\uE100[({-])"/g, '$1\u201d');
    result = result.replace(/([ \t\r\n\uE100[({-]?)"(?=\s)/g, '$1\u201d');
    result = result.replace(/"/g, '\u201c');

    return result;
}

/**
 * Convert ASCII punctuation to typographic characters.
 *
 * `protectCode` protects backtick spans and IRC monospace regions, and
 * `protectUrls` protects URL-like text. Protected regions are restored
 * unchanged.
 */
export function applyTypography(text, options = {}) {
    if (typeof text !== 'string' || !text) {
        return text;
    }

    const protectedSpans = [];
    const controlCodes = [];
    let output = text;

    if (options.protectCode) {
        output = protectMatches(output, IRC_MONOSPACE_PATTERN, protectedSpans);
        output = protectMatches(output, CODE_SPAN_PATTERN, protectedSpans);
    }
    if (options.protectUrls) {
        output = protectMatches(output, URL_PATTERN, protectedSpans);
    }
    if (options.protectCode) {
        output = maskControlCodes(output, controlCodes);
    }

    output = replaceRuns(output, /-+/g, {
        2: '\u2013',
        3: '\u2014',
    });
    output = replaceRuns(output, /\.+/g, {
        3: '\u2026',
    });
    output = output.replace(/\((c|tm)\)/gi, (match, symbol) => (
        symbol.toLowerCase() === 'c' ? '\u00a9' : '\u2122'
    ));
    output = educateQuotes(output);

    output = restoreControlCodes(output, controlCodes);
    return restoreMatches(output, protectedSpans);
}

/**
 * Apply typography to plain text blocks only. Non-text, monospace, and code
 * blocks are returned untouched so URLs, nicks, channels, emoji, and code are
 * not altered.
 */
export function applyTypographyToBlocks(blocks) {
    return blocks.map((block) => {
        if (!block || block.type !== 'text') {
            return block;
        }
        if (block.styles && (block.styles.monospace || block.styles.block)) {
            return block;
        }

        const content = applyTypography(block.content, {
            protectCode: true,
            protectUrls: true,
        });
        if (content === block.content) {
            return block;
        }

        return {
            ...block,
            content,
        };
    });
}
