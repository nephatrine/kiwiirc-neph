import { desktopUploadFile } from '@/libs/desktop/Http';
import { acceptUploadUrl, safeUploadFilename } from './url';

const ENDPOINT = 'https://filebin.net';

function randomBin() {
    const bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function fileUrl(bin, filename) {
    return `${ENDPOINT}/${encodeURIComponent(bin)}/${encodeURIComponent(filename)}`;
}

export async function uploadFilebin(file) {
    const bin = randomBin();
    const filename = safeUploadFilename(file && file.name);
    const target = fileUrl(bin, filename);
    const response = await desktopUploadFile(target, file, {
        method: 'POST',
        headers: {
            'Content-Type': (file && file.type) || 'application/octet-stream',
        },
    });

    if (!response || response.status < 200 || response.status >= 300) {
        throw new Error('upload failed');
    }

    let returnedFilename = filename;
    try {
        const data = await response.json();
        if (data && data.file && typeof data.file.filename === 'string') {
            returnedFilename = safeUploadFilename(data.file.filename);
        }
    } catch (err) {
        // Some responses may not include JSON; the constructed URL is still valid.
    }

    const url = acceptUploadUrl(fileUrl(bin, returnedFilename));
    if (!url) {
        throw new Error('invalid upload url');
    }
    return url;
}
