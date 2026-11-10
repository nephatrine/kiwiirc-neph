'kiwi public';

export const AUTOCOMPLETE_REQUEST = '+draft/autocomplete-request';
export const AUTOCOMPLETE_RESPONSE = '+draft/autocomplete-response';
export const AUTOCOMPLETE_TIMEOUT = 3000;

export function canRequestAutocomplete(network) {
    return !!(
        network &&
        network.state === 'connected' &&
        network.hasCap('message-tags') &&
        network.supportsTag('+draft/autocomplete-request') &&
        network.ircClient &&
        typeof network.ircClient.tagmsg === 'function'
    );
}

export function autocompleteCommandContext(inputVal, buffer, alwaysAuto = false) {
    const isChannel = !!buffer && typeof buffer.isChannel === 'function' &&
        buffer.isChannel();
    const isQuery = !!buffer && typeof buffer.isQuery === 'function' &&
        buffer.isQuery();
    if (!isChannel && !isQuery) {
        return null;
    }

    const value = String(inputVal || '');
    const match = /^\/auto(\s+)([\s\S]*)$/i.exec(value);
    if (match) {
        if (!match[2].trim()) {
            return null;
        }
        return {
            target: buffer.name,
            prefix: match[0].slice(0, match[0].length - match[2].length),
            text: match[2],
        };
    }

    // Always-auto mode sends ordinary channel/query text as-is. Slash
    // commands remain local to Kiwi and are never sent to remote bots.
    if (alwaysAuto && value.trim() && !value.trimStart().startsWith('/')) {
        return {
            target: buffer.name,
            prefix: '',
            text: value,
        };
    }

    return null;
}

// Apply one autocomplete response item to the text the user typed. Leading
// backspaces remove characters from the base text, then the rest is appended.
export function applyAutocompleteResponse(base, response) {
    if (typeof base !== 'string' || typeof response !== 'string') {
        return '';
    }

    let backspaces = 0;
    while (backspaces < response.length && response[backspaces] === '\b') {
        backspaces++;
    }

    return base.slice(0, Math.max(0, base.length - backspaces)) +
        response.slice(backspaces);
}

// Convert the tab-separated +draft/autocomplete-response tag value into full
// command strings.
export function parseAutocompleteResponses(base, value) {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }

    const seen = new Set();
    const responses = [];
    value.split('\t').forEach((item) => {
        if (!item) {
            return;
        }
        const completed = applyAutocompleteResponse(base, item);
        if (completed && !seen.has(completed)) {
            seen.add(completed);
            responses.push(completed);
        }
    });
    return responses;
}
