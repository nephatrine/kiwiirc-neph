import { stripAccountSuffix } from '@/helpers/LoginFields';
import { desktopUploadFile } from '@/libs/desktop/Http';
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

// The upload host is advertised as a post-registration ISUPPORT token. Use
// only the current network's own tokens; pre-BIND tokens belong to the
// bouncer/controller.
export function filehostToken(network) {
    if (!network || typeof network.supports !== 'function') {
        return null;
    }
    let tls = !!(network.connection && network.connection.tls);
    let names = ['draft/FILEHOST', 'soju.im/FILEHOST'];

    for (let i = 0; i < names.length; i++) {
        let url = usableFilehostToken(network.supports(names[i]), tls);
        if (url) {
            return { name: names[i], url };
        }
    }

    return null;
}

export function filehostUploadUrl(network) {
    let token = filehostToken(network);
    return token ? token.url : '';
}

// FILEHOST uses the current connection's SASL credentials. Strip any
// network/client suffix from the account so USER/NETWORK@CLIENT becomes USER.
export function filehostCredentials(network) {
    if (!network) {
        return { account: '', password: '' };
    }

    return {
        account: stripAccountSuffix(network.sasl_account || ''),
        password: network.password || '',
    };
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
    let headers = {
        'Authorization': basicAuthorization(creds.account, creds.password),
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${filename}"`,
    };
    let response = await desktopUploadFile(uploadUrl, file, { headers });
    if (!response) {
        response = await fetch(uploadUrl, {
            method: 'POST',
            headers,
            body: file,
        });
    }
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
