import { desktopUploadFile } from '@/libs/desktop/Http';
import { basicAuthorization } from './filehost';
import { acceptUploadUrl } from './url';

export function generateUniqueFilename(originalFilename) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const basename = String(originalFilename || '').split(/[\\/]/).pop() || '';
    const extension = basename.includes('.') ?
        basename
            .split('.')
            .pop()
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 10) :
        '';

    return `${timestamp}-${random}${extension ? `.${extension}` : ''}`;
}

function targetUrl(base, filename) {
    const url = new URL(base);
    const prefix = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    url.pathname = prefix + filename;
    return url.href;
}

export async function uploadWebdav(file, options = {}) {
    const uploadBase = acceptUploadUrl(options.uploadUrl);
    if (!uploadBase) {
        throw new Error('invalid upload url');
    }

    const accessBase = acceptUploadUrl(options.accessUrl) || uploadBase;
    const filename = generateUniqueFilename(file && file.name);
    const uploadTarget = targetUrl(uploadBase, filename);
    const accessTarget = targetUrl(accessBase, filename);

    const headers = {
        'Content-Type': (file && file.type) || 'application/octet-stream',
    };
    if (options.username) {
        headers.Authorization = basicAuthorization(
            options.username,
            options.password || ''
        );
    }

    const response = await desktopUploadFile(uploadTarget, file, {
        method: 'PUT',
        headers,
    });
    if (!response || response.status < 200 || response.status >= 300) {
        throw new Error('upload failed');
    }

    const url = acceptUploadUrl(accessTarget);
    if (!url) {
        throw new Error('invalid upload url');
    }
    return url;
}
