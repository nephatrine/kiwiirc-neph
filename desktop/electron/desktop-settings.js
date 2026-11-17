const path = require('node:path');
const { atomicWriteFile, readTextFile } = require('./file-utils');

const SETTINGS_FILE = 'desktop-settings.json';
const SETTINGS_VERSION = 1;
const DEFAULT_SETTINGS = Object.freeze({
    version: SETTINGS_VERSION,
    closeToTray: true,
    autoLaunch: false,
    spellcheck: true,
    checkForUpdates: true,
    lastNotifiedUpdate: '',
});

function normalizeVersion(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, 64);
}

function normalizeSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        version: SETTINGS_VERSION,
        closeToTray: typeof source.closeToTray === 'boolean' ?
            source.closeToTray :
            DEFAULT_SETTINGS.closeToTray,
        autoLaunch: typeof source.autoLaunch === 'boolean' ?
            source.autoLaunch :
            DEFAULT_SETTINGS.autoLaunch,
        spellcheck: typeof source.spellcheck === 'boolean' ?
            source.spellcheck :
            DEFAULT_SETTINGS.spellcheck,
        checkForUpdates: typeof source.checkForUpdates === 'boolean' ?
            source.checkForUpdates :
            DEFAULT_SETTINGS.checkForUpdates,
        lastNotifiedUpdate: normalizeVersion(source.lastNotifiedUpdate),
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
