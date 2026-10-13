import { acceptUploadUrl } from './url';

export function usableFilehostToken(value, tls) {
    if (typeof value !== 'string') {
        return '';
    }
    let url = acceptUploadUrl(value);
    if (!url) {
        return '';
    }
    if (tls && url.startsWith('http://')) {
        return '';
    }
    return url;
}

export function filehostUploadUrl(network) {
    if (!network || typeof network.supports !== 'function') {
        return '';
    }
    let tls = !!(network.connection && network.connection.tls);
    let draft = usableFilehostToken(network.supports('draft/FILEHOST'), tls);
    if (draft) {
        return draft;
    }
    return usableFilehostToken(network.supports('soju.im/FILEHOST'), tls);
}

export function filehostAvailable(network) {
    if (!network || !network.sasl_account || !network.password) {
        return false;
    }
    return !!filehostUploadUrl(network);
}

export function contentDispositionFilename(name) {
    let clean = String(name || 'file').replace(/[\x00-\x1F\x7F"\\]/g, '').trim();
    return clean || 'file';
}

export function basicAuthorization(account, password) {
    let raw = `${account}:${password}`;
    let bytes = new TextEncoder().encode(raw);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return `Basic ${btoa(binary)}`;
}

export function resolveUploadLocation(uploadUrl, location) {
    if (!uploadUrl || !location || typeof location !== 'string') {
        return '';
    }
    try {
        return new URL(location, uploadUrl).href;
    } catch (err) {
        return '';
    }
}

export async function uploadFilehost(file, network) {
    let uploadUrl = filehostUploadUrl(network);
    let account = network && network.sasl_account;
    let password = network && network.password;
    if (!uploadUrl || !account || !password) {
        throw new Error('upload failed');
    }

    let filename = contentDispositionFilename(file && file.name);
    let type = (file && file.type) || 'application/octet-stream';
    let response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': basicAuthorization(account, password),
            'Content-Type': type,
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: file,
    });
    if (response.status !== 201) {
        throw new Error('upload failed');
    }

    let resolved = resolveUploadLocation(uploadUrl, response.headers.get('Location'));
    let url = acceptUploadUrl(resolved);
    if (!url) {
        throw new Error('invalid upload url');
    }
    return url;
}
