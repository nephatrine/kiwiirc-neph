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
    return new Response(new Uint8Array(result.body || []), {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers || {},
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

    const result = await bridge.request({
        url,
        method: options.method || 'GET',
        headers: headersToObject(options.headers),
        body: options.body,
    });
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
            data,
        },
    });
    return responseFromResult(result);
}
