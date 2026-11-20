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

function withoutHeaders(headers, names) {
    const blocked = new Set(names.map((name) => String(name).toLowerCase()));
    const result = {};

    Object.keys(headers || {}).forEach((key) => {
        if (!blocked.has(key.toLowerCase())) {
            result[key] = headers[key];
        }
    });

    return result;
}

const REDIRECT_SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'proxy-authorization',
    'host',
];

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
        const fieldName = escapeMultipart(file.fieldName || 'fileToUpload');
        chunks.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${name}"\r\n` +
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

function contentTypeMatches(contentType, acceptedTypes) {
    if (!Array.isArray(acceptedTypes) || !acceptedTypes.length) {
        return true;
    }

    const actual = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (!actual) {
        return false;
    }

    return acceptedTypes.some((type) => {
        const expected = String(type || '').trim().toLowerCase();
        if (!expected) {
            return false;
        }
        if (expected === actual) {
            return true;
        }
        if (expected.endsWith('/*')) {
            return actual.startsWith(expected.slice(0, -1));
        }

        const suffixIndex = expected.indexOf('/*+');
        if (suffixIndex !== -1) {
            const prefix = expected.slice(0, suffixIndex + 1);
            const suffix = expected.slice(suffixIndex + 3);
            return actual.startsWith(prefix) && actual.endsWith('+' + suffix);
        }

        return false;
    });
}

function requestOnce(target, options, policy) {
    return new Promise((resolve, reject) => {
        const isHttps = target.url.protocol === 'https:';
        const transport = isHttps ? https : http;
        const headers = withoutHeaders(normalizeHeaders(options.headers), ['host']);
        const body = options.body || null;
        const maxResponseBytes = toInteger(options.maxResponseBytes, policy.maxResponseBytes);
        const timeoutMs = toInteger(options.timeoutMs, policy.timeoutMs);

        if (body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
            headers['Content-Length'] = String(body.length);
        }
        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent')) {
            headers['User-Agent'] = 'KiwiIRC-Desktop';
        }
        if (options.closeConnection) {
            headers.Connection = 'close';
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

        if (options.insecureHTTPParser === true) {
            requestOptions.insecureHTTPParser = true;
        }

        if (timeoutMs > 0) {
            requestOptions.timeout = timeoutMs;
        }
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

        const fail = (err, response) => {
            finish(reject, err);
            if (response && typeof response.destroy === 'function') {
                response.destroy();
            }
            clientRequest.destroy();
        };

        const clientRequest = transport.request(requestOptions, (response) => {
            const status = response.statusCode || 0;

            response.on('aborted', () => {
                const err = new Error('response aborted');
                err.code = 'ERR_RESPONSE_ABORTED';
                finish(reject, err);
            });
            response.on('close', () => {
                if (!settled) {
                    const err = new Error('response closed before completion');
                    err.code = 'ERR_RESPONSE_CLOSED';
                    finish(reject, err);
                }
            });
            response.on('error', (err) => finish(reject, err));

            if (options.failOnHttpError && status >= 400) {
                const err = new Error(`request failed (${status})`);
                err.statusCode = status;
                fail(err, response);
                return;
            }

            const chunks = [];
            let total = 0;
            let truncated = false;

            response.on('data', (chunk) => {
                if (truncated) {
                    return;
                }

                const remaining = maxResponseBytes - total;
                if (chunk.length > remaining) {
                    if (options.truncateAtMaxBytes !== true) {
                        const err = new Error('response is too large');
                        err.code = 'ERR_RESPONSE_TOO_LARGE';
                        fail(err, response);
                        return;
                    }

                    if (remaining > 0) {
                        chunks.push(chunk.subarray(0, remaining));
                    }
                    total = maxResponseBytes;
                    truncated = true;
                    finish(resolve, {
                        status,
                        statusText: response.statusMessage || '',
                        headers: responseHeaders(response.headers),
                        body: Buffer.concat(chunks),
                        truncated: true,
                    });
                    response.destroy();
                    return;
                }

                total += chunk.length;
                chunks.push(chunk);
            });

            response.on('end', () => {
                finish(resolve, {
                    status,
                    statusText: response.statusMessage || '',
                    headers: responseHeaders(response.headers),
                    body: Buffer.concat(chunks),
                    truncated,
                });
            });
        });

        if (timeoutMs > 0) {
            clientRequest.setTimeout(timeoutMs, () => {
                const err = new Error('request timed out');
                err.code = 'ERR_REQUEST_TIMEOUT';
                fail(err);
            });
        }

        clientRequest.on('error', (err) => finish(reject, err));
        clientRequest.on('close', () => {
            if (!settled) {
                const err = new Error('request closed before completion');
                err.code = 'ERR_REQUEST_CLOSED';
                finish(reject, err);
            }
        });

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

    async function follow(
        target,
        currentMethod,
        currentBody,
        currentHeaders,
        redirects,
        insecureParser
    ) {
        const response = await requestOnce(target, {
            method: currentMethod,
            headers: currentHeaders,
            body: currentBody,
            timeoutMs: options.timeoutMs,
            maxResponseBytes: options.maxResponseBytes,
            failOnHttpError: options.failOnHttpError,
            truncateAtMaxBytes: options.truncateAtMaxBytes,
            insecureHTTPParser: insecureParser,
            closeConnection: options.closeConnection,
        }, policy);
        response.url = target.url.href;

        if (!REDIRECT_CODES.has(response.status) || !response.headers.location) {
            // Content types describe the final resource, not redirect hops.
            // Many servers omit or mislabel the type on 301/302/308 responses.
            if (options.acceptContentTypes &&
                !contentTypeMatches(response.headers['content-type'], options.acceptContentTypes)
            ) {
                const err = new Error('unexpected response content type');
                err.code = 'ERR_UNEXPECTED_CONTENT_TYPE';
                err.contentType = String(response.headers['content-type'] || '');
                throw err;
            }

            return response;
        }

        if (redirects >= maxRedirects) {
            throw new Error('too many redirects');
        }

        const nextUrl = new URL(response.headers.location, target.url);
        if (target.url.protocol === 'https:' && nextUrl.protocol === 'http:') {
            throw new Error('refusing HTTPS to HTTP redirect');
        }

        const nextTarget = await resolveTarget(nextUrl.href, policy.allowPrivateNetworks);
        const sameOrigin = nextTarget.url.origin === target.url.origin;
        let nextMethod = currentMethod;
        let nextBody = currentBody;
        let nextHeaders = currentHeaders;

        if (!sameOrigin) {
            nextHeaders = withoutHeaders(
                currentHeaders,
                REDIRECT_SENSITIVE_HEADERS
            );
            if (nextMethod !== 'GET' && nextMethod !== 'HEAD') {
                nextMethod = 'GET';
                nextBody = null;
            }
        }

        if (response.status === 303 ||
            ((response.status === 301 || response.status === 302) &&
                currentMethod !== 'GET' && currentMethod !== 'HEAD')) {
            nextMethod = 'GET';
            nextBody = null;
        }

        if (nextMethod === 'GET' || nextMethod === 'HEAD') {
            nextBody = null;
            nextHeaders = withoutHeaders(
                nextHeaders,
                ['content-length', 'content-type']
            );
        }

        return follow(
            nextTarget,
            nextMethod,
            nextBody,
            nextHeaders,
            redirects + 1,
            insecureParser
        );
    }

    const headers = normalizeHeaders(options.headers);
    const target = await resolveTarget(options.url, policy.allowPrivateNetworks);

    try {
        return await follow(target, method, body, headers, 0, false);
    } catch (err) {
        // Legacy servers occasionally emit invalid framing (for example both
        // Content-Length and Transfer-Encoding). Retry once with Node's lenient
        // parser, but only when the caller opted in for an inert page preview.
        if (options.allowInsecureHttpParser !== true ||
            !/^HPE_/.test(String(err.code || ''))
        ) {
            throw err;
        }

        const retryTarget = await resolveTarget(options.url, policy.allowPrivateNetworks);
        return follow(retryTarget, method, body, headers, 0, true);
    }
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

    const uploadPolicy = {
        ...policy,
        maxRequestBytes: toInteger(
            options.maxUploadBytes,
            policy.maxUploadBytes || policy.maxRequestBytes
        ),
    };

    return request({
        url: options.url,
        method: options.method || 'POST',
        headers,
        body,
        timeoutMs: options.timeoutMs,
        maxResponseBytes: options.maxResponseBytes,
    }, uploadPolicy);
}

module.exports = {
    buildMultipart,
    request,
    upload,
};
