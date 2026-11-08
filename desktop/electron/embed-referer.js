const EMBED_REFERER = 'https://localhost/';

function addEmbedReferer(headers) {
    const result = { ...(headers || {}) };
    const hasReferer = Object.keys(result).some((key) => (
        key.toLowerCase() === 'referer' && result[key]
    ));
    if (!hasReferer) {
        result.Referer = EMBED_REFERER;
    }
    return result;
}

module.exports = {
    EMBED_REFERER,
    addEmbedReferer,
};
