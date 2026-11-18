const fs = require('node:fs/promises');
const path = require('node:path');
const { ensureDirectory } = require('./file-utils');

const ICON_SCHEME = 'kiwi-icon';
const ICON_HOST = 'network-icon';
const MAX_ICON_BYTES = 10 * 1024 * 1024;

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));
const ALLOWED_EXTENSION_LIST = Array.from(ALLOWED_EXTENSIONS)
    .map((extension) => extension.slice(1));

function networkIconsRoot(userDataDir) {
    return path.join(userDataDir, 'network-icons');
}

function safeNetworkName(networkName) {
    const safeName = String(networkName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return safeName || 'network';
}

function iconUrl(filename) {
    return `${ICON_SCHEME}://${ICON_HOST}/${encodeURIComponent(filename)}`;
}

async function installNetworkIcon(userDataDir, networkName, sourcePath) {
    const extension = path.extname(sourcePath || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error('Unsupported image type');
    }

    const stat = await fs.stat(sourcePath);
    if (!stat.isFile()) {
        throw new Error('Selected image is not a file');
    }
    if (stat.size > MAX_ICON_BYTES) {
        throw new Error('Selected image is too large');
    }

    const filename = `${safeNetworkName(networkName)}${extension}`;
    const root = networkIconsRoot(userDataDir);
    await ensureDirectory(root);

    const target = path.join(root, filename);
    if (path.resolve(sourcePath) !== path.resolve(target)) {
        await fs.copyFile(sourcePath, target);
    }

    return {
        canceled: false,
        filename,
        url: iconUrl(filename),
    };
}

async function resolveNetworkIconFile(userDataDir, requestUrl) {
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch (err) {
        return null;
    }

    if (parsed.protocol !== `${ICON_SCHEME}:` || parsed.host !== ICON_HOST) {
        return null;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(parsed.pathname);
    } catch (err) {
        return null;
    }
    if (!pathname || pathname === '/' || pathname.indexOf('\0') !== -1) {
        return null;
    }

    const root = path.resolve(networkIconsRoot(userDataDir));
    const target = path.resolve(root, pathname.replace(/^\/+/, ''));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        return null;
    }

    const extension = path.extname(target).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return null;
    }

    try {
        const realRoot = await fs.realpath(root);
        const realTarget = await fs.realpath(target);
        const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
        if (!realTarget.startsWith(realPrefix)) {
            return null;
        }
        const stat = await fs.stat(realTarget);
        if (!stat.isFile()) {
            return null;
        }
        return {
            filePath: realTarget,
            mimeType: MIME_TYPES[extension],
        };
    } catch (err) {
        return null;
    }
}

module.exports = {
    ALLOWED_EXTENSION_LIST,
    ICON_HOST,
    ICON_SCHEME,
    MAX_ICON_BYTES,
    MIME_TYPES,
    installNetworkIcon,
    networkIconsRoot,
    resolveNetworkIconFile,
};
