const fs = require('node:fs/promises');
const path = require('node:path');
const { MAX_ICON_BYTES, MIME_TYPES, networkIconsRoot } = require('./network-icons');

const ICON_URL_PREFIX = 'kiwi-icon://network-icon/';
const MAX_TOTAL_ASSET_BYTES = 32 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/;
const BASE64 = /^[A-Za-z0-9+/=\s]+$/;

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

// Embeds the local icon files a profile references so an imported profile does
// not point at kiwi-icon:// URLs that only exist on the source machine.
async function collectProfileAssets(userDataDir, bundle) {
    const names = collectIconNames(bundle, new Set());
    if (!names.size) {
        return null;
    }

    const root = path.resolve(networkIconsRoot(userDataDir));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;

    const candidates = await Promise.all(
        Array.from(names).map(async(name) => {
            const mimeType = MIME_TYPES[path.extname(name).toLowerCase()];
            const target = path.resolve(root, name);
            if (!mimeType || !target.startsWith(prefix)) {
                return null;
            }

            let data;
            try {
                data = await fs.readFile(target);
            } catch (err) {
                return null;
            }

            if (!data.length || data.length > MAX_ICON_BYTES) {
                return null;
            }

            return { name, mime: mimeType, data };
        })
    );

    const assets = {};
    let total = 0;

    candidates.filter(Boolean).forEach((entry) => {
        if (total + entry.data.length > MAX_TOTAL_ASSET_BYTES) {
            return;
        }
        total += entry.data.length;
        assets[entry.name] = {
            mime: entry.mime,
            data: entry.data.toString('base64'),
        };
    });

    return Object.keys(assets).length ? assets : null;
}

// Writes embedded icons back into the local icon directory. Existing files are
// kept so importing a profile cannot overwrite icons already in use.
async function installProfileAssets(userDataDir, bundle) {
    const assets = bundle && bundle.assets;
    if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
        return 0;
    }

    const root = path.resolve(networkIconsRoot(userDataDir));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    await fs.mkdir(root, { recursive: true });

    const prepared = [];
    Object.keys(assets).forEach((name) => {
        const asset = assets[name];
        const mimeType = MIME_TYPES[path.extname(name).toLowerCase()];
        const target = path.resolve(root, name);
        if (!SAFE_NAME.test(name) || !mimeType || !target.startsWith(prefix)) {
            return;
        }
        if (!asset || typeof asset.data !== 'string' || !BASE64.test(asset.data)) {
            return;
        }
        if (asset.mime && asset.mime !== mimeType) {
            return;
        }

        const data = Buffer.from(asset.data, 'base64');
        if (!data.length || data.length > MAX_ICON_BYTES) {
            return;
        }

        prepared.push({ target, data });
    });

    let total = 0;
    const selected = prepared.filter((entry) => {
        if (total + entry.data.length > MAX_TOTAL_ASSET_BYTES) {
            return false;
        }
        total += entry.data.length;
        return true;
    });

    const results = await Promise.all(selected.map(async(entry) => {
        try {
            await fs.access(entry.target);
            return 0;
        } catch (err) {
            // Missing, so install it below.
        }

        await fs.writeFile(entry.target, entry.data, { mode: 0o600 });
        return 1;
    }));

    return results.reduce((sum, value) => sum + value, 0);
}

module.exports = {
    ICON_URL_PREFIX,
    MAX_TOTAL_ASSET_BYTES,
    collectProfileAssets,
    installProfileAssets,
};
