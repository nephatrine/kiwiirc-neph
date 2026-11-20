function desktopBridge() {
    return typeof window !== 'undefined' && window.kiwiDesktop ?
        window.kiwiDesktop :
        null;
}

function desktopHttp() {
    const bridge = desktopBridge();
    return bridge && bridge.http ? bridge.http : null;
}

function headersToObject(headers) {
    if (!headers) {
        return {};
    }

    if (typeof headers.forEach === 'function') {
        const result = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    return Object.assign({}, headers);
}

function responseFromResult(result) {
    const response = new Response(new Uint8Array(result.body || []), {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers || {},
    });
    if (result.url) {
        Object.defineProperty(response, 'url', {
            configurable: true,
            value: result.url,
        });
    }
    return response;
}

const PREVIEW_CONCURRENCY = 4;
let previewActive = 0;
const previewQueue = [];

function isPreviewPurpose(purpose) {
    return purpose === 'page-preview' || purpose === 'link-preview';
}

function requestFromOptions(url, options) {
    const request = {
        url,
        method: options.method || 'GET',
        headers: headersToObject(options.headers),
        body: options.body,
    };
    if (options.maxResponseBytes) {
        request.maxResponseBytes = options.maxResponseBytes;
    }
    if (options.timeoutMs) {
        request.timeoutMs = options.timeoutMs;
    }
    if (options.purpose) {
        request.purpose = options.purpose;
    }
    if (options.acceptContentTypes) {
        request.acceptContentTypes = options.acceptContentTypes;
    }
    if (options.failOnHttpError) {
        request.failOnHttpError = true;
    }
    if (options.truncateAtMaxBytes) {
        request.truncateAtMaxBytes = true;
    }
    return request;
}

function runPreviewRequest(task) {
    return new Promise((resolve, reject) => {
        const start = () => {
            previewActive += 1;
            Promise.resolve()
                .then(task)
                .then(resolve, reject)
                .finally(() => {
                    previewActive -= 1;
                    const next = previewQueue.shift();
                    if (next) {
                        next();
                    }
                });
        };

        if (previewActive < PREVIEW_CONCURRENCY) {
            start();
        } else {
            previewQueue.push(start);
        }
    });
}

export function isDesktop() {
    return !!desktopBridge();
}

export function isNativeHttpAvailable() {
    return !!desktopHttp();
}

export async function desktopFetch(url, options = {}) {
    const bridge = desktopHttp();
    if (!bridge) {
        return fetch(url, options);
    }

    const request = requestFromOptions(url, options);
    const result = isPreviewPurpose(options.purpose) ?
        await runPreviewRequest(() => bridge.request(request)) :
        await bridge.request(request);
    return responseFromResult(result);
}

export async function desktopUploadFile(url, file, options = {}) {
    const bridge = desktopHttp();
    if (!bridge) {
        return null;
    }

    const data = await file.arrayBuffer();
    const result = await bridge.upload({
        url,
        method: options.method || 'POST',
        headers: headersToObject(options.headers),
        body: data,
        purpose: options.purpose || 'upload',
    });
    return responseFromResult(result);
}

export async function desktopUploadMultipart(url, fields, file, options = {}) {
    const bridge = desktopHttp();
    if (!bridge) {
        return null;
    }

    const data = await file.arrayBuffer();
    const result = await bridge.upload({
        url,
        method: options.method || 'POST',
        headers: headersToObject(options.headers),
        fields,
        purpose: options.purpose || 'upload',
        file: {
            name: file.name || 'file',
            type: file.type || 'application/octet-stream',
            fieldName: options.fileField || 'fileToUpload',
            data,
        },
    });
    return responseFromResult(result);
}
