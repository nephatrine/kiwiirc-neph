const APP_FRAME_SOURCE = 'app:';

function allowAppFrameAncestor(csp) {
    if (typeof csp !== 'string' || !csp.trim()) {
        return csp;
    }

    let found = false;
    const directives = csp.split(';').map((directive) => {
        const trimmed = directive.trim();
        if (!/^frame-ancestors(?:\s|$)/i.test(trimmed)) {
            return trimmed;
        }

        found = true;
        const parts = trimmed.split(/\s+/);
        if (parts.some((part) => part.toLowerCase() === APP_FRAME_SOURCE)) {
            return trimmed;
        }

        parts.push(APP_FRAME_SOURCE);
        return parts.join(' ');
    });

    return found ? directives.join('; ') : csp;
}

function addAppFrameAncestor(headers) {
    const result = { ...(headers || {}) };

    Object.keys(result).forEach((key) => {
        if (key.toLowerCase() !== 'content-security-policy') {
            return;
        }

        const original = result[key];
        const values = Array.isArray(original) ? original : [original];
        const updated = values.map((value) => allowAppFrameAncestor(String(value)));
        result[key] = Array.isArray(original) ? updated : updated[0];
    });

    return result;
}

module.exports = {
    APP_FRAME_SOURCE,
    addAppFrameAncestor,
    allowAppFrameAncestor,
};
