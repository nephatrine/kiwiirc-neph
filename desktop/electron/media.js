const httpService = require('./http');
const { validateHttpUrl } = require('./http-policy');
const { decodeMediaUrl } = require('./media-url');

const MEDIA_TYPES = ['image/', 'audio/', 'video/'];
const FORWARD_HEADERS = [
    'accept-ranges',
    'cache-control',
    'content-length',
    'content-range',
    'etag',
    'expires',
    'last-modified',
];

function isMediaContentType(value) {
    const type = String(value || '').split(';')[0].trim().toLowerCase();
    return MEDIA_TYPES.some((prefix) => type.startsWith(prefix));
}

function mediaHeaders(upstream, contentType, corsOrigin) {
    const headers = {
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
    };

    if (corsOrigin) {
        headers['Access-Control-Allow-Origin'] = corsOrigin;
        headers.Vary = 'Origin';
    }

    FORWARD_HEADERS.forEach((name) => {
        if (upstream[name] !== undefined) {
            headers[name] = upstream[name];
        }
    });

    headers['Content-Type'] = contentType;
    return headers;
}

async function handleMediaRequest(request, policy, allowedOrigins = []) {
    let targetUrl;
    try {
        targetUrl = decodeMediaUrl(request.url);
        validateHttpUrl(targetUrl);
    } catch (err) {
        return new Response('Bad request', { status: 400 });
    }

    const headers = {};
    const range = request.headers.get('range');
    if (range) {
        headers.Range = range;
    }

    const origin = request.headers.get('origin');
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '';

    try {
        const response = await httpService.request({
            url: targetUrl,
            method: 'GET',
            headers,
            maxResponseBytes: policy.maxMediaBytes || policy.maxDownloadBytes,
        }, policy);

        if (response.status !== 200 && response.status !== 206) {
            return new Response('Media unavailable', { status: 502 });
        }

        const contentType = String(response.headers['content-type'] || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        if (!isMediaContentType(contentType)) {
            return new Response('Not media', { status: 415 });
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: mediaHeaders(response.headers, contentType, corsOrigin),
        });
    } catch (err) {
        return new Response('Media unavailable', { status: 502 });
    }
}

module.exports = {
    handleMediaRequest,
    isMediaContentType,
    mediaHeaders,
};
