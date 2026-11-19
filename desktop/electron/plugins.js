/* eslint-disable no-restricted-syntax, no-await-in-loop */

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractZipArchive } = require('./theme-archive');

const PLUGIN_SCHEME = 'kiwi-plugin';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

const MIME_TYPES = {
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
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
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));
const ENTRY_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.htm']);

function pluginsRoot(userDataDir) {
    return path.join(userDataDir, 'plugins');
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
    return slug || 'plugin';
}

function validPluginId(id) {
    return typeof id === 'string' && PLUGIN_ID_PATTERN.test(id);
}

function safeRelativePath(value) {
    if (typeof value !== 'string' || !value || value.length > 200) {
        return '';
    }
    if (value.indexOf('\0') !== -1 || value.indexOf('\\') !== -1) {
        return '';
    }
    if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
        return '';
    }

    const segments = value.split('/');
    const cleaned = segments.filter((segment) => segment && segment !== '.');
    if (!cleaned.length || cleaned.some((segment) => segment === '..')) {
        return '';
    }

    return cleaned.join('/');
}

function normalizeManifest(value) {
    if (!isPlainObject(value)) {
        throw new Error('plugin.json must contain an object');
    }

    const name = typeof value.name === 'string' ? value.name.trim() : '';
    if (!name || name.length > 80) {
        throw new Error('plugin.json name must be between 1 and 80 characters');
    }

    const entry = safeRelativePath(
        typeof value.entry === 'string' && value.entry ? value.entry : 'plugin.js'
    );
    if (!entry || !ENTRY_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
        throw new Error('plugin.json entry must be a .js or .html file');
    }

    const description = typeof value.description === 'string' ?
        value.description.trim().slice(0, 500) :
        '';
    const version = typeof value.version === 'string' ?
        value.version.trim().slice(0, 40) :
        '';

    return { name, entry, description, version };
}

async function isFile(filePath) {
    try {
        const stat = await fs.lstat(filePath);
        return stat.isFile();
    } catch (err) {
        return false;
    }
}

async function readManifest(pluginDir) {
    const manifestPath = path.join(pluginDir, 'plugin.json');
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
        throw new Error('plugin.json is invalid or too large');
    }

    let parsed;
    try {
        parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (err) {
        throw new Error('plugin.json is not valid JSON');
    }

    return normalizeManifest(parsed);
}

async function findPluginRoot(tempDir) {
    if (await isFile(path.join(tempDir, 'plugin.json'))) {
        return tempDir;
    }

    const ignored = new Set(['__macosx', '.ds_store', 'thumbs.db']);
    const entries = (await fs.readdir(tempDir, { withFileTypes: true }))
        .filter((entry) => !ignored.has(entry.name.toLowerCase()));

    if (entries.length === 1 && entries[0].isDirectory()) {
        const candidate = path.join(tempDir, entries[0].name);
        if (await isFile(path.join(candidate, 'plugin.json'))) {
            return candidate;
        }
    }

    throw new Error(
        'Plugin archive must contain plugin.json at its root or in one top-level folder'
    );
}

async function readPluginDescriptor(pluginDir, id) {
    const manifest = await readManifest(pluginDir);
    if (!manifest) {
        return null;
    }

    const entryPath = path.join(pluginDir, manifest.entry);
    if (!await isFile(entryPath)) {
        return null;
    }

    return {
        id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        entry: manifest.entry,
        url: `${PLUGIN_SCHEME}://${id}/${manifest.entry
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
    };
}

async function listPlugins(userDataDir) {
    const root = pluginsRoot(userDataDir);
    let entries;
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }

    const plugins = [];
    for (const entry of entries) {
        if (!entry.isDirectory() ||
            entry.name.startsWith('.') ||
            !validPluginId(entry.name)
        ) {
            continue;
        }

        try {
            const descriptor = await readPluginDescriptor(
                path.join(root, entry.name),
                entry.name
            );
            if (descriptor) {
                plugins.push(descriptor);
            }
        } catch (err) {
            // Ignore plugins that no longer validate.
        }
    }

    return plugins.sort((left, right) => left.name.localeCompare(right.name));
}

async function installPlugin(userDataDir, archivePath) {
    const archiveStat = await fs.stat(archivePath);
    if (!archiveStat.isFile() ||
        archiveStat.size <= 0 ||
        archiveStat.size > MAX_ARCHIVE_BYTES
    ) {
        throw new Error('Plugin archive is empty or too large');
    }

    const root = pluginsRoot(userDataDir);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const tempDir = path.join(root, `.install-${crypto.randomUUID()}`);
    let finalPath = null;

    await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });

    try {
        const archive = await fs.readFile(archivePath);
        if (archive.length > MAX_ARCHIVE_BYTES) {
            throw new Error('Plugin archive is too large');
        }
        await extractZipArchive(archive, tempDir);

        const packageRoot = await findPluginRoot(tempDir);
        const manifest = await readManifest(packageRoot);
        if (!manifest) {
            throw new Error('Plugin archive is missing plugin.json');
        }

        const entryPath = path.join(packageRoot, manifest.entry);
        const entryStat = await fs.lstat(entryPath);
        if (!entryStat.isFile() || entryStat.size > MAX_ENTRY_BYTES) {
            throw new Error('Plugin entry file is missing or too large');
        }

        const id = `${slugify(manifest.name)}-${crypto.randomUUID().slice(0, 8)}`;
        const targetPath = path.join(root, id);
        await fs.rename(packageRoot, targetPath);
        finalPath = targetPath;

        return await readPluginDescriptor(finalPath, id);
    } catch (err) {
        if (finalPath) {
            await fs.rm(finalPath, { recursive: true, force: true });
        }
        throw err;
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function uninstallPlugin(userDataDir, id) {
    if (!validPluginId(id)) {
        throw new Error('Invalid plugin id');
    }

    const root = path.resolve(pluginsRoot(userDataDir));
    const target = path.resolve(root, id);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        throw new Error('Invalid plugin path');
    }

    const stat = await fs.lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Plugin is not a directory');
    }

    await fs.rm(target, { recursive: true, force: false });
    return { id, removed: true };
}

async function resolvePluginFile(userDataDir, requestUrl) {
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch (err) {
        return null;
    }

    if (parsed.protocol !== `${PLUGIN_SCHEME}:` || !validPluginId(parsed.host)) {
        return null;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(parsed.pathname);
    } catch (err) {
        return null;
    }
    if (!pathname || pathname === '/') {
        pathname = '/plugin.js';
    }
    if (pathname.indexOf('\0') !== -1) {
        return null;
    }

    const root = path.resolve(pluginsRoot(userDataDir), parsed.host);
    const target = path.resolve(root, pathname.replace(/^\/+/, ''));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix)) {
        return null;
    }

    let realRoot;
    let realPluginsRoot;
    let realTarget;
    try {
        realRoot = await fs.realpath(root);
        realPluginsRoot = await fs.realpath(pluginsRoot(userDataDir));
        realTarget = await fs.realpath(target);
    } catch (err) {
        return null;
    }
    if (realRoot !== realPluginsRoot &&
        !realRoot.startsWith(realPluginsRoot + path.sep)
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
    PLUGIN_SCHEME,
    installPlugin,
    listPlugins,
    normalizeManifest,
    pluginsRoot,
    readManifest,
    readPluginDescriptor,
    resolvePluginFile,
    uninstallPlugin,
    validPluginId,
};
