'kiwi public';

export const LIMNORIA_AUTOCOMPLETE_REQUEST = '+draft/autocomplete-request';
export const LIMNORIA_AUTOCOMPLETE_RESPONSE = '+draft/autocomplete-response';
export const LIMNORIA_AUTOCOMPLETE_TIMEOUT = 3000;
export const LIMNORIA_DEFAULT_PLUGINS = 'Admin, Channel, Config, Misc, Owner, User';

export function parseLimnoriaPlugins(value) {
    const source = Array.isArray(value) ? value.join(',') : String(value || '');
    const seen = new Set();
    return source
        .split(/[\s,]+/)
        .map((plugin) => plugin.trim().toLowerCase())
        .filter((plugin) => {
            if (!plugin || seen.has(plugin)) {
                return false;
            }
            seen.add(plugin);
            return true;
        });
}

export function limnoriaSettings(network) {
    const get = (name, fallback) => {
        const value = network && typeof network.setting === 'function' ?
            network.setting(name) :
            undefined;
        return typeof value === 'undefined' ? fallback : value;
    };

    return {
        suggestions: !!get('limnoriaSuggestions', false),
        prefix: String(get('limnoriaPrefix', '!') || '').trim(),
        name: String(get('limnoriaName', 'SupyBot') || '').trim(),
        plugins: parseLimnoriaPlugins(
            get('limnoriaPlugins', LIMNORIA_DEFAULT_PLUGINS)
        ),
    };
}

// Apply one Limnoria response item to the text the user typed. Leading
// backspaces remove characters from the base text, then the rest is appended.
export function applyLimnoriaResponse(base, response) {
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
export function parseLimnoriaResponses(base, value) {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }

    const seen = new Set();
    const responses = [];
    value.split('\t').forEach((item) => {
        if (!item) {
            return;
        }
        const completed = applyLimnoriaResponse(base, item);
        if (completed && !seen.has(completed)) {
            seen.add(completed);
            responses.push(completed);
        }
    });
    return responses;
}
