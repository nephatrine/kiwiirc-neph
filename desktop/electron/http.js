const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { pinnedLookup, resolveTarget } = require('./http-policy');

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function toInteger(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toBuffer(value) {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return Buffer.from(value);
    }
    if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
    if (typeof value === 'string') {
        return Buffer.from(value, 'utf8');
    }
    if (value === undefined || value === null) {
        return null;
    }
    throw new Error('invalid request body');
}

function normalizeHeaders(headers) {
    const result = {};
    if (!headers || typeof headers !== 'object') {
        return result;
    }

    Object.keys(headers).forEach((key) => {
        const value = headers[key];
        if (typeof value === 'string' || typeof value === 'number') {
            result[key] = String(value);
        }
    });

    return result;
}

function multipartBoundary() {
    return `----KiwiDesktop${crypto.randomBytes(12).toString('hex')}`;
}

function escapeMultipart(value) {
    return String(value).replace(/[\r\n"]/g, '_');
}

function buildMultipart(fields, file) {
    const boundary = multipartBoundary();
    const chunks = [];

    Object.keys(fields || {}).forEach((key) => {
        const value = fields[key];
        if (value === undefined || value === null) {
            return;
        }
        chunks.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${escapeMultipart(key)}"\r\n\r\n` +
            `${value}\r\n`,
            'utf8'
        ));
    });

    if (file) {
        const name = escapeMultipart(file.name || 'file');
        const type = escapeMultipart(file.type || 'application/octet-stream');
        chunks.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="fileToUpload"; filename="${name}"\r\n` +
            `Content-Type: ${type}\r\n\r\n`,
            'utf8'
        ));
        chunks.push(toBuffer(file.data) || Buffer.alloc(0));
        chunks.push(Buffer.from('\r\n', 'utf8'));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

function responseHeaders(headers) {
    const result = {};
    Object.keys(headers || {}).forEach((key) => {
        const value = headers[key];
        if (Array.isArray(value)) {
            result[key] = value.join(', ');
        } else if (value !== undefined) {
            result[key] = String(value);
        }
    });
    return result;
}

function requestOnce(target, options, policy) {
    return new Promise((resolve, reject) => {
        const isHttps = target.url.protocol === 'https:';
        const transport = isHttps ? https : http;
        const headers = normalizeHeaders(options.headers);
        const body = options.body || null;
        const maxResponseBytes = toInteger(options.maxResponseBytes, policy.maxResponseBytes);

        if (body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
            headers['Content-Length'] = String(body.length);
        }
        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent')) {
            headers['User-Agent'] = 'KiwiIRC-Desktop';
        }

        const requestOptions = {
            protocol: target.url.protocol,
            hostname: target.hostname,
            port: target.url.port || undefined,
            path: `${target.url.pathname || '/'}${target.url.search || ''}`,
            method: options.method || 'GET',
            headers,
            lookup: pinnedLookup(target.addresses || target.address, target.family),
            agent: false,
        };

        if (isHttps) {
            requestOptions.servername = target.hostname;
        }

        let settled = false;
        const finish = (fn, value) => {
            if (settled) {
                return;
            }
            settled = true;
            fn(value);
        };

        const clientRequest = transport.request(requestOptions, (response) => {
            const chunks = [];
            let total = 0;

            response.on('data', (chunk) => {
                total += chunk.length;
                if (total > maxResponseBytes) {
                    const err = new Error('response is too large');
                    finish(reject, err);
                    clientRequest.destroy(err);
                    return;
                }
                chunks.push(chunk);
            });

            response.on('end', () => {
                finish(resolve, {
                    status: response.statusCode || 0,
                    statusText: response.statusMessage || '',
                    headers: responseHeaders(response.headers),
                    body: Buffer.concat(chunks),
                });
            });

            response.on('error', (err) => finish(reject, err));
        });

        clientRequest.setTimeout(toInteger(options.timeoutMs, policy.timeoutMs), () => {
            clientRequest.destroy(new Error('request timed out'));
        });

        clientRequest.on('error', (err) => finish(reject, err));

        if (body && requestOptions.method !== 'GET' && requestOptions.method !== 'HEAD') {
            clientRequest.write(body);
        }
        clientRequest.end();
    });
}

async function request(options, policy) {
    if (!options || typeof options !== 'object') {
        throw new Error('invalid request options');
    }

    let method = String(options.method || 'GET').toUpperCase();
    let body = toBuffer(options.body);
    if (body && body.length > policy.maxRequestBytes) {
        throw new Error('request body is too large');
    }

    const maxRedirects = Math.min(MAX_REDIRECTS, policy.maxRedirects || MAX_REDIRECTS);

    async function follow(target, currentMethod, currentBody, currentHeaders, redirects) {
        const response = await requestOnce(target, {
            method: currentMethod,
            headers: currentHeaders,
            body: currentBody,
            timeoutMs: options.timeoutMs,
            maxResponseBytes: options.maxResponseBytes,
        }, policy);
        response.url = target.url.href;

        if (!REDIRECT_CODES.has(response.status) || !response.headers.location) {
            return response;
        }

        if (redirects >= maxRedirects) {
            throw new Error('too many redirects');
        }

        const nextUrl = new URL(response.headers.location, target.url).href;
        const nextTarget = await resolveTarget(nextUrl, policy.allowPrivateNetworks);
        let nextMethod = currentMethod;
        let nextBody = currentBody;
        let nextHeaders = currentHeaders;

        if (response.status === 303 ||
            ((response.status === 301 || response.status === 302) &&
                currentMethod !== 'GET' && currentMethod !== 'HEAD')) {
            nextMethod = 'GET';
            nextBody = null;
            nextHeaders = Object.assign({}, currentHeaders);
            Object.keys(nextHeaders).forEach((key) => {
                if (key.toLowerCase() === 'content-length' ||
                    key.toLowerCase() === 'content-type') {
                    delete nextHeaders[key];
                }
            });
        }

        return follow(nextTarget, nextMethod, nextBody, nextHeaders, redirects + 1);
    }

    const target = await resolveTarget(options.url, policy.allowPrivateNetworks);
    return follow(target, method, body, normalizeHeaders(options.headers), 0);
}

async function upload(options, policy) {
    if (!options || typeof options !== 'object') {
        throw new Error('invalid upload options');
    }

    let body = toBuffer(options.body);
    let headers = normalizeHeaders(options.headers);

    if (options.fields && options.file) {
        const multipart = buildMultipart(options.fields, options.file);
        body = multipart.body;
        headers['Content-Type'] = multipart.contentType;
    }

    return request({
        url: options.url,
        method: options.method || 'POST',
        headers,
        body,
        timeoutMs: options.timeoutMs,
        maxResponseBytes: options.maxResponseBytes,
    }, policy);
}

module.exports = {
    buildMultipart,
    request,
    upload,
};
