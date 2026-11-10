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

    const request = {
        url,
        method: options.method || 'GET',
        headers: headersToObject(options.headers),
        body: options.body,
    };
    if (options.maxResponseBytes) {
        request.maxResponseBytes = options.maxResponseBytes;
    }

    const result = await bridge.request(request);
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
        file: {
            name: file.name || 'file',
            type: file.type || 'application/octet-stream',
            fieldName: options.fileField || 'fileToUpload',
            data,
        },
    });
    return responseFromResult(result);
}
