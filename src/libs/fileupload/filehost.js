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

// The upload host is advertised as an ISUPPORT token. draft/FILEHOST is the
// upstream server's own service; soju.im/FILEHOST is the bouncer's. Both can
// appear on a bound connection, in which case the bouncer's wins: uploads go
// through the bouncer session either way.
export function filehostToken(network) {
    if (!network || typeof network.supports !== 'function') {
        return null;
    }
    let tls = !!(network.connection && network.connection.tls);
    let names = ['draft/FILEHOST', 'soju.im/FILEHOST'];

    if (typeof network.bouncerSupports === 'function') {
        for (let i = 0; i < names.length; i++) {
            let url = usableFilehostToken(network.bouncerSupports(names[i]), tls);
            if (url) {
                return { name: names[i], url, plane: 'bouncer' };
            }
        }
    }

    for (let i = 0; i < names.length; i++) {
        let url = usableFilehostToken(network.supports(names[i]), tls);
        if (url) {
            return { name: names[i], url, plane: 'upstream' };
        }
    }

    return null;
}

export function filehostUploadUrl(network) {
    let token = filehostToken(network);
    return token ? token.url : '';
}

// Credentials belong to whoever advertised the token. On a bouncer connection
// the upstream login is performed by the bouncer, so the upstream account and
// password stay empty until we can learn them.
export function filehostCredentials(network) {
    let token = filehostToken(network);
    if (!network || !token) {
        return { account: '', password: '' };
    }

    let account = '';
    let password = '';
    if (token.plane === 'bouncer') {
        account = typeof network.bouncerAccount === 'function' ? network.bouncerAccount() : '';
        password = typeof network.bouncerPassword === 'function' ? network.bouncerPassword() : '';
    } else {
        account = typeof network.upstreamAccount === 'function' ?
            network.upstreamAccount() :
            (network.sasl_account || '');
        password = typeof network.upstreamPassword === 'function' ?
            network.upstreamPassword() :
            (network.password || '');
    }

    return { account: account || '', password: password || '' };
}

export function filehostAvailable(network) {
    let creds = filehostCredentials(network);
    if (!creds.account || !creds.password) {
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
    let creds = filehostCredentials(network);
    if (!uploadUrl || !creds.account || !creds.password) {
        throw new Error('upload failed');
    }

    let filename = contentDispositionFilename(file && file.name);
    let type = (file && file.type) || 'application/octet-stream';
    let response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': basicAuthorization(creds.account, creds.password),
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
