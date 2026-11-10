/* eslint-disable no-restricted-syntax, no-await-in-loop */

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractZipArchive } = require('./theme-archive');

const THEME_SCHEME = 'kiwi-theme';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_THEME_CSS_BYTES = 5 * 1024 * 1024;
const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
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

function themesRoot(userDataDir) {
    return path.join(userDataDir, 'themes');
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
    return slug || 'theme';
}

function validThemeId(id) {
    return typeof id === 'string' && THEME_ID_PATTERN.test(id);
}

function normalizeManifest(value) {
    if (!isPlainObject(value)) {
        throw new Error('theme.json must contain an object');
    }

    const manifest = {};

    if (typeof value.name !== 'undefined') {
        if (typeof value.name !== 'string') {
            throw new Error('theme.json name must be a string');
        }
        const name = value.name.trim();
        if (!name || name.length > 80) {
            throw new Error('theme.json name must be between 1 and 80 characters');
        }
        manifest.name = name;
    }

    if (typeof value.mode !== 'undefined') {
        const mode = String(value.mode || '').toLowerCase();
        if (mode !== 'light' && mode !== 'dark') {
            throw new Error('theme.json mode must be "light" or "dark"');
        }
        manifest.mode = mode;
    }

    if (typeof value.google_fonts !== 'undefined') {
        if (!Array.isArray(value.google_fonts) || value.google_fonts.length > 10) {
            throw new Error('theme.json google_fonts must be an array');
        }

        const fonts = [];
        for (const font of value.google_fonts) {
            if (typeof font !== 'string') {
                throw new Error('theme.json google_fonts must contain strings');
            }
            const entry = font.trim();
            if (!entry || entry.length > 160) {
                throw new Error('theme.json google_fonts contains an invalid entry');
            }
            fonts.push(entry);
        }
        manifest.google_fonts = fonts;
    }

    return manifest;
}

async function readManifest(themeDir) {
    const manifestPath = path.join(themeDir, 'theme.json');
    let stat;
    try {
        stat = await fs.lstat(manifestPath);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }

    if (!stat.isFile() || stat.size > MAX_MANIFEST_BYTES) {
        throw new Error('theme.json is invalid or too large');
    }

    let parsed;
    try {
        parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (err) {
        throw new Error('theme.json is not valid JSON');
    }

    return normalizeManifest(parsed);
}

async function isFile(filePath) {
    try {
        const stat = await fs.lstat(filePath);
        return stat.isFile();
    } catch (err) {
        return false;
    }
}

async function findThemeRoot(tempDir) {
    if (await isFile(path.join(tempDir, 'theme.css'))) {
        return tempDir;
    }

    const ignored = new Set(['__macosx', '.ds_store', 'thumbs.db']);
    const entries = (await fs.readdir(tempDir, { withFileTypes: true }))
        .filter((entry) => !ignored.has(entry.name.toLowerCase()));

    if (entries.length === 1 && entries[0].isDirectory()) {
        const candidate = path.join(tempDir, entries[0].name);
        if (await isFile(path.join(candidate, 'theme.css'))) {
            return candidate;
        }
    }

    throw new Error(
        'Theme archive must contain theme.css at its root or in one top-level folder'
    );
}

async function readThemeDescriptor(themeDir, id) {
    let manifest = null;
    try {
        manifest = await readManifest(themeDir);
    } catch (err) {
        manifest = null;
    }

    return {
        id,
        name: (manifest && manifest.name) || id,
        mode: (manifest && manifest.mode) || '',
        google_fonts: (manifest && manifest.google_fonts) || [],
        url: `${THEME_SCHEME}://${id}`,
    };
}

async function listThemes(userDataDir) {
    const root = themesRoot(userDataDir);
    let entries;
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }

    const themes = [];
    for (const entry of entries) {
        if (!entry.isDirectory() ||
            entry.name.startsWith('.') ||
            !validThemeId(entry.name)
        ) {
            continue;
        }

        const themeDir = path.join(root, entry.name);
        if (!await isFile(path.join(themeDir, 'theme.css'))) {
            continue;
        }

        themes.push(await readThemeDescriptor(themeDir, entry.name));
    }

    return themes.sort((a, b) => a.name.localeCompare(b.name));
}

async function installTheme(userDataDir, archivePath) {
    const archiveStat = await fs.stat(archivePath);
    if (!archiveStat.isFile() ||
        archiveStat.size <= 0 ||
        archiveStat.size > MAX_ARCHIVE_BYTES
    ) {
        throw new Error('Theme archive is empty or too large');
    }

    const root = themesRoot(userDataDir);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const tempDir = path.join(root, `.install-${crypto.randomUUID()}`);
    let finalPath = null;

    await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });

    try {
        const archive = await fs.readFile(archivePath);
        if (archive.length > MAX_ARCHIVE_BYTES) {
            throw new Error('Theme archive is too large');
        }
        await extractZipArchive(archive, tempDir);

        const packageRoot = await findThemeRoot(tempDir);
        const cssPath = path.join(packageRoot, 'theme.css');
        const cssStat = await fs.lstat(cssPath);
        if (!cssStat.isFile() ||
            cssStat.size <= 0 ||
            cssStat.size > MAX_THEME_CSS_BYTES
        ) {
            throw new Error('theme.css is empty or too large');
        }

        const manifest = await readManifest(packageRoot);
        const archiveName = path.basename(archivePath, path.extname(archivePath));
        const fallbackName = packageRoot === tempDir ?
            archiveName :
            path.basename(packageRoot);
        const displayName = (manifest && manifest.name) || fallbackName;
        const normalizedManifest = {
            ...(manifest || {}),
            name: displayName,
        };

        await fs.writeFile(
            path.join(packageRoot, 'theme.json'),
            JSON.stringify(normalizedManifest, null, 2) + '\n',
            { mode: 0o600 }
        );

        const id = `${slugify(displayName)}-${crypto.randomUUID().slice(0, 8)}`;
        const targetPath = path.join(root, id);
        await fs.rename(packageRoot, targetPath);
        finalPath = targetPath;

        return await readThemeDescriptor(finalPath, id);
    } catch (err) {
        if (finalPath) {
            await fs.rm(finalPath, { recursive: true, force: true });
        }
        throw err;
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function uninstallTheme(userDataDir, id) {
    if (!validThemeId(id)) {
        throw new Error('Invalid theme id');
    }

    const root = path.resolve(themesRoot(userDataDir));
    const target = path.resolve(root, id);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        throw new Error('Invalid theme path');
    }

    const stat = await fs.lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Theme is not a directory');
    }

    await fs.rm(target, { recursive: true, force: false });
    return { id, removed: true };
}

async function resolveThemeFile(userDataDir, requestUrl) {
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch (err) {
        return null;
    }

    if (parsed.protocol !== `${THEME_SCHEME}:` || !validThemeId(parsed.host)) {
        return null;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(parsed.pathname);
    } catch (err) {
        return null;
    }
    if (!pathname || pathname === '/') {
        pathname = '/theme.css';
    }
    if (pathname.indexOf('\0') !== -1) {
        return null;
    }

    const root = path.resolve(themesRoot(userDataDir), parsed.host);
    const target = path.resolve(root, pathname.replace(/^\/+/, ''));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        return null;
    }

    let realRoot;
    let realThemesRoot;
    let realTarget;
    try {
        realRoot = await fs.realpath(root);
        realThemesRoot = await fs.realpath(themesRoot(userDataDir));
        realTarget = await fs.realpath(target);
    } catch (err) {
        return null;
    }
    if (realRoot !== realThemesRoot &&
        !realRoot.startsWith(realThemesRoot + path.sep)
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
    MAX_ARCHIVE_BYTES,
    THEME_SCHEME,
    installTheme,
    listThemes,
    normalizeManifest,
    readThemeDescriptor,
    resolveThemeFile,
    themesRoot,
    uninstallTheme,
    validThemeId,
};
