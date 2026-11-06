const MEDIA_SCHEME = 'kiwi-media';
const MEDIA_HOST = 'media';

function encodeMediaUrl(url) {
    return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encodeURIComponent(url)}`;
}

function decodeMediaUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.host !== MEDIA_HOST) {
        throw new Error('invalid media URL');
    }

    const encoded = parsed.pathname.replace(/^\/+/, '');
    if (!encoded) {
        throw new Error('missing media URL');
    }

    return decodeURIComponent(encoded);
}

module.exports = {
    MEDIA_HOST,
    MEDIA_SCHEME,
    decodeMediaUrl,
    encodeMediaUrl,
};
