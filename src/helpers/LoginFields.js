'kiwi public';

import { escapeRegExp } from './Utils';

// Account names and authcids may carry a client or network suffix. The nick
// suggested from them is everything before the first suffix marker.
export function stripAccountSuffix(name) {
    const value = name || '';
    const at = value.indexOf('@');
    const slash = value.indexOf('/');
    let idx = -1;
    if (at !== -1 && slash !== -1) {
        idx = Math.min(at, slash);
    } else {
        idx = at !== -1 ? at : slash;
    }
    return idx === -1 ?
        value :
        value.substr(0, idx);
}

// A server password is a single space-delimited IRC parameter, so anything
// containing whitespace or a control character cannot be sent as-is.
export function isValidServerPassword(value) {
    return !/[\s\u0000-\u001f\u007f]/.test(value || '');
}

// IRC lengths are byte counts, so a multi-byte character can be shorter than
// the field limit while still exceeding it on the wire.
export function byteLength(value) {
    return new TextEncoder().encode(value || '').length;
}

export function withinLimit(value, limit) {
    return !limit || byteLength(value) <= limit;
}

// Build the nick matcher from startupOptions.nick_format. A leading slash is
// a custom /pattern/flags expression; anything else is an escaped literal.
// Returns null when the configured expression is invalid.
export function compileNickPattern(nickPatternStr) {
    if (!nickPatternStr) {
        // Nicks cannot start with [0-9- ]. ? is not valid either, but it is
        // replaced with a random number before connecting.
        return /^[a-z_[\]{}^`|][a-z0-9_\-[\]{}^`|]*$/i;
    }

    let pattern = '';
    let flags = '';
    if (nickPatternStr[0] === '/') {
        const pos = nickPatternStr.lastIndexOf('/');
        pattern = nickPatternStr.substring(1, pos);
        flags = nickPatternStr.substr(pos + 1);
    } else {
        pattern = escapeRegExp(nickPatternStr);
        flags = 'i';
    }

    try {
        return new RegExp(pattern, flags);
    } catch (err) {
        return null;
    }
}
