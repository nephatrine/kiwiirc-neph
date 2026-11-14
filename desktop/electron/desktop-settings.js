const path = require('node:path');
const { atomicWriteFile, readTextFile } = require('./file-utils');

const SETTINGS_FILE = 'desktop-settings.json';
const SETTINGS_VERSION = 1;
const DEFAULT_SETTINGS = Object.freeze({
    version: SETTINGS_VERSION,
    closeToTray: true,
});

function normalizeSettings(value) {
    return {
        version: SETTINGS_VERSION,
        closeToTray: value && typeof value.closeToTray === 'boolean' ?
            value.closeToTray :
            DEFAULT_SETTINGS.closeToTray,
    };
}

function createDesktopSettingsStore(userDataDir) {
    if (typeof userDataDir !== 'string' || !userDataDir) {
        throw new Error('invalid desktop settings directory');
    }

    let current = { ...DEFAULT_SETTINGS };

    function settingsPath() {
        return path.join(userDataDir, SETTINGS_FILE);
    }

    function get() {
        return { ...current };
    }

    async function load() {
        try {
            const text = await readTextFile(settingsPath());
            if (text !== null) {
                current = normalizeSettings(JSON.parse(text));
            }
        } catch (err) {
            current = { ...DEFAULT_SETTINGS };
        }

        return get();
    }

    async function set(patch) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new Error('invalid desktop settings');
        }

        const previous = current;
        const next = normalizeSettings({
            ...current,
            ...patch,
        });
        current = next;
        try {
            await atomicWriteFile(settingsPath(), JSON.stringify(next, null, 2));
        } catch (err) {
            current = previous;
            throw err;
        }
        return get();
    }

    return {
        load,
        get,
        set,
    };
}

module.exports = {
    DEFAULT_SETTINGS,
    createDesktopSettingsStore,
    normalizeSettings,
};
