/* eslint-disable no-restricted-syntax, no-await-in-loop */

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractZipArchive, safeArchivePath } = require('./theme-archive');

const EMOJI_PACK_SCHEME = 'kiwi-emoji';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 512 * 1024;
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PACK_ID_RE = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+$/u;
const SHORTCODE_RE = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+$/u;

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

function emojiPacksRoot(userDataDir) {
    return path.join(userDataDir, 'emoji-packs');
}

function isPlainObject(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

function slugify(value) {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return slug || 'emoji-pack';
}

function validPackageId(id) {
    return typeof id === 'string' && PACKAGE_ID_PATTERN.test(id);
}

function fingerprint(emoji) {
    const tokens = Object.keys(emoji).sort();
    return JSON.stringify([
        true,
        tokens.map((token) => [token, emoji[token].url, emoji[token].alt]),
    ]);
}

function normalizeWebUrl(value) {
    if (typeof value !== 'string' || !value) {
        return '';
    }

    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        if (url.username || url.password) {
            return '';
        }
        return url.href;
    } catch (err) {
        return '';
    }
}

async function isFile(filePath) {
    try {
        const stat = await fs.lstat(filePath);
        return stat.isFile();
    } catch (err) {
        return false;
    }
}

async function readManifest(packageRoot) {
    const manifestPath = path.join(packageRoot, 'emoji.json');
    let stat;
    try {
        stat = await fs.lstat(manifestPath);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }

    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_MANIFEST_BYTES) {
        throw new Error('emoji.json is invalid or too large');
    }

    let parsed;
    try {
        parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (err) {
        throw new Error('emoji.json is not valid JSON');
    }

    return parsed;
}

async function normalizeImageUrl(value, packageRoot, packageId) {
    if (typeof value !== 'string' || !value) {
        return null;
    }

    let url;
    try {
        url = new URL(value, `${EMOJI_PACK_SCHEME}://${packageId}/`);
    } catch (err) {
        return null;
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (url.username || url.password) {
            return null;
        }
        return { url: url.href };
    }

    if (url.protocol !== `${EMOJI_PACK_SCHEME}:` ||
        url.host !== packageId ||
        url.search ||
        url.hash
    ) {
        return null;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch (err) {
        return null;
    }

    const relative = safeArchivePath(pathname.replace(/^\/+/, ''));
    if (!relative) {
        return null;
    }

    const extension = path.extname(relative).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return null;
    }

    const filePath = path.join(packageRoot, relative);
    if (!await isFile(filePath)) {
        return null;
    }

    return {
        url: `${EMOJI_PACK_SCHEME}://${packageId}/` +
            relative.split('/').map(encodeURIComponent).join('/'),
    };
}

async function normalizePackDocument(document, packageRoot, packageId) {
    if (!Array.isArray(document)) {
        throw new Error('emoji.json must contain an array of packs');
    }

    const packs = [];
    const seenIds = new Set();

    for (const pack of document) {
        if (!isPlainObject(pack)) {
            throw new Error('emoji.json contains an invalid pack');
        }
        if (typeof pack.id !== 'string' || !PACK_ID_RE.test(pack.id)) {
            throw new Error('emoji.json contains an invalid pack id');
        }
        if (seenIds.has(pack.id)) {
            throw new Error(`Emoji pack "${pack.id}" is duplicated`);
        }
        if (typeof pack.name !== 'string' || !pack.name.trim() ||
            pack.name.trim().length > 80
        ) {
            throw new Error(`Emoji pack "${pack.id}" has an invalid name`);
        }
        if (!isPlainObject(pack.emoji) || Object.keys(pack.emoji).length === 0) {
            throw new Error(`Emoji pack "${pack.id}" has no emoji`);
        }

        if (typeof pack.required !== 'undefined') {
            if (!Array.isArray(pack.required)) {
                throw new Error(`Emoji pack "${pack.id}" has invalid requirements`);
            }
            if (pack.required.length > 0) {
                throw new Error(`Emoji pack "${pack.id}" requires unsupported extensions`);
            }
        }

        const emoji = {};
        for (const shortcode of Object.keys(pack.emoji)) {
            if (!SHORTCODE_RE.test(shortcode)) {
                throw new Error(`Emoji pack "${pack.id}" has an invalid shortcode`);
            }

            const entry = pack.emoji[shortcode];
            if (!isPlainObject(entry)) {
                throw new Error(`Emoji pack "${pack.id}" has an invalid emoji entry`);
            }

            const image = await normalizeImageUrl(entry.url, packageRoot, packageId);
            if (!image) {
                throw new Error(`Emoji pack "${pack.id}" has an invalid image for "${shortcode}"`);
            }

            emoji[shortcode] = {
                url: image.url,
                alt: typeof entry.alt === 'string' ? entry.alt : '',
            };
        }

        seenIds.add(pack.id);
        packs.push({
            id: pack.id,
            name: pack.name.trim(),
            description: typeof pack.description === 'string' ? pack.description : '',
            authors: Array.isArray(pack.authors) ?
                pack.authors.filter((author) => typeof author === 'string') :
                [],
            homepage: normalizeWebUrl(pack.homepage),
            documentUrl: `${EMOJI_PACK_SCHEME}://${packageId}/emoji.json`,
            fingerprint: fingerprint(emoji),
            supported: true,
            emoji,
        });
    }

    if (packs.length === 0) {
        throw new Error('emoji.json does not contain any usable packs');
    }

    return packs;
}

async function findEmojiPackRoot(tempDir) {
    if (await isFile(path.join(tempDir, 'emoji.json'))) {
        return tempDir;
    }

    const ignored = new Set(['__macosx', '.ds_store', 'thumbs.db']);
    const entries = (await fs.readdir(tempDir, { withFileTypes: true }))
        .filter((entry) => !ignored.has(entry.name.toLowerCase()));

    if (entries.length === 1 && entries[0].isDirectory()) {
        const candidate = path.join(tempDir, entries[0].name);
        if (await isFile(path.join(candidate, 'emoji.json'))) {
            return candidate;
        }
    }

    throw new Error(
        'Emoji pack archive must contain emoji.json at its root or in one top-level folder'
    );
}

async function readPackage(packageRoot, id, installedAt) {
    const manifest = await readManifest(packageRoot);
    if (!manifest) {
        throw new Error('emoji.json is missing');
    }

    const packs = await normalizePackDocument(manifest, packageRoot, id);
    return {
        id,
        name: packs[0].name || id,
        installedAt,
        packs,
    };
}

async function listEmojiPacks(userDataDir) {
    const root = emojiPacksRoot(userDataDir);
    let entries;
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }

    const packages = [];
    for (const entry of entries) {
        if (!entry.isDirectory() ||
            entry.name.startsWith('.') ||
            !validPackageId(entry.name)
        ) {
            continue;
        }

        const packageRoot = path.join(root, entry.name);
        try {
            const stat = await fs.stat(packageRoot);
            packages.push(await readPackage(packageRoot, entry.name, stat.mtimeMs));
        } catch (err) {
            // Ignore packages that no longer validate.
        }
    }

    return packages.sort((left, right) => (
        left.installedAt - right.installedAt ||
        left.id.localeCompare(right.id)
    ));
}

async function installEmojiPack(userDataDir, archivePath) {
    const archiveStat = await fs.stat(archivePath);
    if (!archiveStat.isFile() ||
        archiveStat.size <= 0 ||
        archiveStat.size > MAX_ARCHIVE_BYTES
    ) {
        throw new Error('Emoji pack archive is empty or too large');
    }

    const root = emojiPacksRoot(userDataDir);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const tempDir = path.join(root, `.install-${crypto.randomUUID()}`);
    let finalPath = null;

    await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });

    try {
        const archive = await fs.readFile(archivePath);
        if (archive.length > MAX_ARCHIVE_BYTES) {
            throw new Error('Emoji pack archive is too large');
        }
        await extractZipArchive(archive, tempDir);

        const packageRoot = await findEmojiPackRoot(tempDir);
        const manifest = await readManifest(packageRoot);
        if (!manifest) {
            throw new Error('emoji.json is missing');
        }

        const archiveName = path.basename(archivePath, path.extname(archivePath));
        const fallbackName = packageRoot === tempDir ?
            archiveName :
            path.basename(packageRoot);
        const firstPack = Array.isArray(manifest) ? manifest[0] : null;
        const displayName = firstPack &&
            typeof firstPack.name === 'string' &&
            firstPack.name.trim() ?
            firstPack.name.trim() :
            fallbackName;

        const id = `${slugify(displayName)}-${crypto.randomUUID().slice(0, 8)}`;
        const packs = await normalizePackDocument(manifest, packageRoot, id);

        const targetPath = path.join(root, id);
        await fs.rename(packageRoot, targetPath);
        finalPath = targetPath;

        return {
            id,
            name: packs[0].name || displayName,
            installedAt: Date.now(),
            packs,
        };
    } catch (err) {
        if (finalPath) {
            await fs.rm(finalPath, { recursive: true, force: true });
        }
        throw err;
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function uninstallEmojiPack(userDataDir, id) {
    if (!validPackageId(id)) {
        throw new Error('Invalid emoji pack id');
    }

    const root = path.resolve(emojiPacksRoot(userDataDir));
    const target = path.resolve(root, id);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        throw new Error('Invalid emoji pack path');
    }

    const stat = await fs.lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Emoji pack is not a directory');
    }

    await fs.rm(target, { recursive: true, force: false });
    return { id, removed: true };
}

async function resolveEmojiPackFile(userDataDir, requestUrl) {
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch (err) {
        return null;
    }

    if (parsed.protocol !== `${EMOJI_PACK_SCHEME}:` || !validPackageId(parsed.host)) {
        return null;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(parsed.pathname);
    } catch (err) {
        return null;
    }
    if (!pathname || pathname === '/') {
        return null;
    }
    if (pathname.indexOf('\0') !== -1) {
        return null;
    }

    const root = path.resolve(emojiPacksRoot(userDataDir), parsed.host);
    const target = path.resolve(root, pathname.replace(/^\/+/, ''));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        return null;
    }

    let realRoot;
    let realEmojiPacksRoot;
    let realTarget;
    try {
        realRoot = await fs.realpath(root);
        realEmojiPacksRoot = await fs.realpath(emojiPacksRoot(userDataDir));
        realTarget = await fs.realpath(target);
    } catch (err) {
        return null;
    }
    if (realRoot !== realEmojiPacksRoot &&
        !realRoot.startsWith(realEmojiPacksRoot + path.sep)
    ) {
        return null;
    }
    if (!realTarget.startsWith(realRoot + path.sep)) {
        return null;
    }

    const stat = await fs.lstat(realTarget);
    if (!stat.isFile()) {
        return null;
    }

    const extension = path.extname(realTarget).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return null;
    }

    return {
        filePath: realTarget,
        mimeType: MIME_TYPES[extension],
    };
}

module.exports = {
    ALLOWED_EXTENSIONS,
    EMOJI_PACK_SCHEME,
    MAX_ARCHIVE_BYTES,
    emojiPacksRoot,
    installEmojiPack,
    listEmojiPacks,
    normalizeImageUrl,
    normalizePackDocument,
    resolveEmojiPackFile,
    uninstallEmojiPack,
    validPackageId,
};
