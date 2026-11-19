/* eslint-disable no-bitwise -- ZIP headers are little-endian bit fields. */

const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { crc32, extractZipArchive, safeArchivePath } = require('./theme-archive');
const {
    MAX_ICON_BYTES,
    MIME_TYPES,
    networkIconsRoot,
} = require('./network-icons');
const { listThemes, themesRoot, validThemeId } = require('./themes');
const { emojiPacksRoot, listEmojiPacks, validPackageId } = require('./emoji-packs');

const BUNDLE_ENTRY = 'profile.json';
const ICON_URL_PREFIX = 'kiwi-icon://network-icon/';
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/;
const TOP_LEVEL = new Set([BUNDLE_ENTRY, 'icons', 'themes', 'emoji-packs']);

function isProfileArchive(buffer) {
    return Buffer.isBuffer(buffer) &&
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04;
}

function dosDateTime(date) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

function buildZip(entries) {
    const { time, day } = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach((entry) => {
        const name = Buffer.from(entry.name, 'utf8');
        const data = entry.data;
        const checksum = crc32(data);
        const deflated = zlib.deflateRawSync(data);
        const useDeflate = deflated.length < data.length;
        const payload = useDeflate ? deflated : data;
        const method = useDeflate ? 8 : 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(day, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(day, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += local.length + name.length + payload.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

function iconFilenameFromUrl(value) {
    if (typeof value !== 'string' || value.indexOf(ICON_URL_PREFIX) !== 0) {
        return '';
    }

    let name;
    try {
        name = decodeURIComponent(value.slice(ICON_URL_PREFIX.length));
    } catch (err) {
        return '';
    }

    return SAFE_NAME.test(name) ? name : '';
}

function collectIconNames(value, names) {
    if (typeof value === 'string') {
        const name = iconFilenameFromUrl(value);
        if (name) {
            names.add(name);
        }
        return names;
    }

    if (Array.isArray(value)) {
        value.forEach((entry) => collectIconNames(entry, names));
        return names;
    }

    if (value && typeof value === 'object') {
        Object.keys(value).forEach((key) => collectIconNames(value[key], names));
    }

    return names;
}

async function collectIcons(userDataDir, bundle) {
    const names = collectIconNames(bundle, new Set());
    if (!names.size) {
        return [];
    }

    const root = path.resolve(networkIconsRoot(userDataDir));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    let realRoot;
    try {
        realRoot = await fs.realpath(root);
    } catch (err) {
        return [];
    }
    const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;

    const results = await Promise.all(
        Array.from(names).map(async(name) => {
            const mimeType = MIME_TYPES[path.extname(name).toLowerCase()];
            const target = path.resolve(root, name);
            if (!mimeType || !target.startsWith(prefix)) {
                return null;
            }

            let data;
            try {
                // Resolve symlinks so an exported archive can only ever contain
                // icon files that live inside the icon directory.
                const realTarget = await fs.realpath(target);
                if (!realTarget.startsWith(realPrefix)) {
                    return null;
                }
                data = await fs.readFile(realTarget);
            } catch (err) {
                return null;
            }

            if (!data.length || data.length > MAX_ICON_BYTES) {
                return null;
            }

            return { name, data };
        })
    );

    return results.filter(Boolean);
}

async function collectDirectoryFiles(rootDir, relative = '') {
    const directory = relative ? path.join(rootDir, relative) : rootDir;
    let entries;
    try {
        entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (err) {
        return [];
    }

    const lists = await Promise.all(entries.map(async(entry) => {
        if (entry.name.startsWith('.')) {
            return [];
        }

        const next = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            return collectDirectoryFiles(rootDir, next);
        }
        if (!entry.isFile()) {
            return [];
        }

        try {
            return [{ path: next, data: await fs.readFile(path.join(rootDir, next)) }];
        } catch (err) {
            return [];
        }
    }));

    return lists.reduce((all, list) => all.concat(list), []);
}

async function collectThemeEntries(userDataDir, themes) {
    const root = themesRoot(userDataDir);
    const lists = await Promise.all(themes.map(async(theme) => {
        if (!validThemeId(theme.id)) {
            return [];
        }
        const files = await collectDirectoryFiles(path.join(root, theme.id));
        return files.map((file) => ({
            name: `themes/${theme.id}/${file.path}`,
            data: file.data,
        }));
    }));

    return lists.reduce((all, list) => all.concat(list), []);
}

async function collectEmojiPackEntries(userDataDir, packs) {
    const root = emojiPacksRoot(userDataDir);
    const lists = await Promise.all(packs.map(async(pack) => {
        if (!validPackageId(pack.id)) {
            return [];
        }
        const files = await collectDirectoryFiles(path.join(root, pack.id));
        return files.map((file) => ({
            name: `emoji-packs/${pack.id}/${file.path}`,
            data: file.data,
        }));
    }));

    return lists.reduce((all, list) => all.concat(list), []);
}

async function writeProfileArchive(userDataDir, bundle, options = {}) {
    const cleanBundle = { ...bundle };
    delete cleanBundle.assets;

    const entries = [{
        name: BUNDLE_ENTRY,
        data: Buffer.from(JSON.stringify(cleanBundle, null, 2), 'utf8'),
    }];

    if (options.includeAssets !== false) {
        const icons = await collectIcons(userDataDir, cleanBundle);
        icons.forEach((icon) => {
            entries.push({ name: `icons/${icon.name}`, data: icon.data });
        });

        const themes = await listThemes(userDataDir);
        const emojiPacks = await listEmojiPacks(userDataDir);
        entries.push(...await collectThemeEntries(userDataDir, themes));
        entries.push(...await collectEmojiPackEntries(userDataDir, emojiPacks));
    }

    const total = entries.reduce((sum, entry) => sum + entry.data.length, 0);
    if (total > MAX_ARCHIVE_BYTES) {
        throw new Error('profile assets are too large');
    }
    if (entries.length > 2000) {
        throw new Error('profile has too many files');
    }

    const unsafe = entries.find((entry) => !safeArchivePath(entry.name));
    if (unsafe) {
        throw new Error('profile contains an unsafe path');
    }

    return buildZip(entries);
}

async function existingPath(target) {
    try {
        await fs.access(target);
        return true;
    } catch (err) {
        return false;
    }
}

async function installIconFiles(sourceDir, userDataDir, summary) {
    let entries;
    try {
        entries = await fs.readdir(sourceDir, { withFileTypes: true });
    } catch (err) {
        return;
    }

    const root = networkIconsRoot(userDataDir);
    await fs.mkdir(root, { recursive: true });

    await Promise.all(entries.map(async(entry) => {
        if (!entry.isFile() || !SAFE_NAME.test(entry.name)) {
            return;
        }
        if (!MIME_TYPES[path.extname(entry.name).toLowerCase()]) {
            return;
        }

        const source = path.join(sourceDir, entry.name);
        const stat = await fs.stat(source);
        if (!stat.isFile() || stat.size > MAX_ICON_BYTES) {
            return;
        }

        const data = await fs.readFile(source);
        let handle = null;
        try {
            // O_EXCL refuses to follow or replace an existing path, including a
            // symlink, so an imported archive cannot write outside the icon
            // directory.
            handle = await fs.open(path.join(root, entry.name), 'wx', 0o600);
            await handle.writeFile(data);
            await handle.sync();
            summary.icons += 1;
        } catch (err) {
            // Already installed or not creatable.
        } finally {
            if (handle) {
                await handle.close().catch(() => {});
            }
        }
    }));
}

async function installThemeDirs(sourceDir, userDataDir, summary) {
    let entries;
    try {
        entries = await fs.readdir(sourceDir, { withFileTypes: true });
    } catch (err) {
        return;
    }

    const root = themesRoot(userDataDir);
    await fs.mkdir(root, { recursive: true });

    await Promise.all(entries.map(async(entry) => {
        if (!entry.isDirectory() || !validThemeId(entry.name)) {
            return;
        }

        const source = path.join(sourceDir, entry.name);
        if (!await existingPath(path.join(source, 'theme.css'))) {
            return;
        }

        const target = path.join(root, entry.name);
        if (await existingPath(target)) {
            summary.skipped += 1;
            return;
        }

        await fs.rename(source, target);
        summary.themes += 1;
    }));
}

async function installEmojiPackDirs(sourceDir, userDataDir, summary) {
    let entries;
    try {
        entries = await fs.readdir(sourceDir, { withFileTypes: true });
    } catch (err) {
        return;
    }

    const root = emojiPacksRoot(userDataDir);
    await fs.mkdir(root, { recursive: true });

    await Promise.all(entries.map(async(entry) => {
        if (!entry.isDirectory() || !validPackageId(entry.name)) {
            return;
        }

        const source = path.join(sourceDir, entry.name);
        if (!await existingPath(path.join(source, 'emoji.json'))) {
            return;
        }

        const target = path.join(root, entry.name);
        if (await existingPath(target)) {
            summary.skipped += 1;
            return;
        }

        await fs.rename(source, target);
        summary.emojiPacks += 1;
    }));
}

async function prepareProfileArchive(buffer, userDataDir) {
    if (!isProfileArchive(buffer)) {
        throw new Error('not a profile archive');
    }
    if (buffer.length > MAX_ARCHIVE_BYTES) {
        throw new Error('profile archive is too large');
    }

    const pendingDir = await fs.mkdtemp(path.join(userDataDir, 'profile-import-'));

    try {
        await extractZipArchive(buffer, pendingDir, {
            maxTotalUncompressedBytes: MAX_ARCHIVE_BYTES,
        });

        const top = await fs.readdir(pendingDir, { withFileTypes: true });
        top.forEach((entry) => {
            if (!TOP_LEVEL.has(entry.name)) {
                throw new Error('profile archive contains an unexpected entry');
            }
        });

        const bundlePath = path.join(pendingDir, BUNDLE_ENTRY);
        const stat = await fs.stat(bundlePath);
        if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_BUNDLE_BYTES) {
            throw new Error('profile archive is missing its profile data');
        }

        const text = await fs.readFile(bundlePath, 'utf8');
        JSON.parse(text);

        return { text, pendingDir };
    } catch (err) {
        await fs.rm(pendingDir, { recursive: true, force: true });
        throw err;
    }
}

async function applyPendingImport(pendingDir, userDataDir) {
    const root = path.resolve(userDataDir);
    const target = path.resolve(pendingDir);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (!target.startsWith(prefix) ||
        !path.basename(target).startsWith('profile-import-')
    ) {
        throw new Error('invalid pending profile import');
    }

    const summary = { themes: 0, emojiPacks: 0, icons: 0, skipped: 0 };
    try {
        await installIconFiles(path.join(target, 'icons'), userDataDir, summary);
        await installThemeDirs(path.join(target, 'themes'), userDataDir, summary);
        await installEmojiPackDirs(
            path.join(target, 'emoji-packs'),
            userDataDir,
            summary
        );
    } finally {
        await fs.rm(target, { recursive: true, force: true });
    }

    return summary;
}

module.exports = {
    BUNDLE_ENTRY,
    MAX_ARCHIVE_BYTES,
    applyPendingImport,
    isProfileArchive,
    prepareProfileArchive,
    writeProfileArchive,
};
