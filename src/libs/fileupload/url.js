export function acceptUploadUrl(raw) {
    if (!raw || typeof raw !== 'string') {
        return '';
    }

    let clean = raw.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    let parsed;
    try {
        parsed = new URL(clean);
    } catch (err) {
        return '';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
    }
    if (parsed.username || parsed.password || !parsed.hostname) {
        return '';
    }

    return parsed.href;
}
