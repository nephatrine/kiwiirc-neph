const httpService = require('./http');
const { validateHttpUrl } = require('./http-policy');
const { decodeMediaUrl } = require('./media-url');

const MEDIA_TYPES = ['image/', 'audio/', 'video/'];
const MEDIA_CONTENT_TYPES = ['image/*', 'audio/*', 'video/*', 'application/octet-stream'];
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

function detectImageContentType(body) {
    if (!body || !body.length) {
        return '';
    }

    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a) {
        return 'image/png';
    }

    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (bytes.length >= 6) {
        const gif = bytes.toString('ascii', 0, 6);
        if (gif === 'GIF87a' || gif === 'GIF89a') {
            return 'image/gif';
        }
    }

    if (bytes.length >= 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }

    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return 'image/bmp';
    }

    return '';
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
            acceptContentTypes: MEDIA_CONTENT_TYPES,
            failOnHttpError: true,
        }, policy);

        if (response.status !== 200 && response.status !== 206) {
            return new Response('Media unavailable', { status: 502 });
        }

        let contentType = String(response.headers['content-type'] || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        if (!isMediaContentType(contentType) && contentType === 'application/octet-stream') {
            contentType = detectImageContentType(response.body) || contentType;
        }
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
    detectImageContentType,
    handleMediaRequest,
    isMediaContentType,
    mediaHeaders,
};
