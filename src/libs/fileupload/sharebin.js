import { desktopUploadMultipart } from '@/libs/desktop/Http';
import { acceptUploadUrl, safeUploadFilename } from './url';

const ENDPOINT = 'https://sharebin.eu/';
const PART_ENDPOINT = 'https://sharebin.eu/upload_part';
const CHUNK_SIZE = 20 * 1024 * 1024;

function expiryDays(retention) {
    switch (retention) {
    case '1d':
        return 1;
    case '30d':
        return 30;
    case 'never':
        return 0;
    case '7d':
    default:
        return 7;
    }
}

function randomUploadId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `uid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractLink(text) {
    if (typeof text !== 'string' || !text) {
        return '';
    }

    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const input = doc.getElementById('fileLinkText');
        if (input && input.value) {
            return input.value;
        }
    }

    const match = /id="fileLinkText"[^>]*value="([^"]+)"/i.exec(text) ||
        /value="([^"]+)"[^>]*id="fileLinkText"/i.exec(text);
    return match ? match[1] : '';
}

function parseResponse(text) {
    const link = extractLink(text);
    if (link) {
        return link;
    }

    try {
        const data = JSON.parse(text);
        if (data && data.status === 'assembled' && data.link) {
            return data.link;
        }
    } catch (err) {
        // Not JSON and no HTML link.
    }

    return '';
}

export async function uploadSharebin(file, retention) {
    const expiry = expiryDays(retention);
    const filename = safeUploadFilename(file && file.name);
    const size = file && typeof file.size === 'number' ? file.size : 0;

    if (size <= CHUNK_SIZE) {
        const response = await desktopUploadMultipart(
            ENDPOINT,
            { expiry_days: String(expiry) },
            file,
            { fileField: 'file' }
        );
        if (!response || !response.ok) {
            throw new Error('upload failed');
        }

        const url = acceptUploadUrl(parseResponse(await response.text()));
        if (!url) {
            throw new Error('invalid upload url');
        }
        return url;
    }

    const total = Math.ceil(size / CHUNK_SIZE);
    const uploadId = randomUploadId();
    let link = '';

    for (let index = 0; index < total; index++) {
        const start = index * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, size);
        const chunk = new File(
            [file.slice(start, end)],
            filename,
            { type: file.type || 'application/octet-stream' }
        );
        // Chunks must be sent sequentially so the server can assemble them.
        // eslint-disable-next-line no-await-in-loop
        const response = await desktopUploadMultipart(
            PART_ENDPOINT,
            {
                filename,
                index: String(index),
                total: String(total),
                expiry_days: String(expiry),
                upload_id: uploadId,
            },
            chunk,
            { fileField: 'file' }
        );

        if (!response || !response.ok) {
            throw new Error('upload failed');
        }

        // eslint-disable-next-line no-await-in-loop
        link = parseResponse(await response.text());
        if (link) {
            break;
        }
    }

    const url = acceptUploadUrl(link);
    if (!url) {
        throw new Error('invalid upload url');
    }
    return url;
}
