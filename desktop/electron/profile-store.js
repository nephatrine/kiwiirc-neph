const path = require('node:path');
const {
    atomicWriteFile,
    ensureDirectory,
    readTextFile,
    removeFile,
} = require('./file-utils');

const PROFILE_ID = 'default';
const MAX_STORAGE_BYTES = 64 * 1024 * 1024;
const STORAGE_FILES = Object.freeze({
    'kiwi-state': 'state.json',
    'kiwi-metadata-cache': 'metadata-cache.json',
});

function profileDirectory(userDataDir) {
    return path.join(userDataDir, 'profiles', PROFILE_ID);
}

function validStateKey(name) {
    return typeof name === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(name);
}

function fileNameForKey(name) {
    if (isKnownStorageKey(name)) {
        return STORAGE_FILES[name];
    }
    if (!validStateKey(name)) {
        throw new Error('invalid storage key');
    }
    return `state-${name}.json`;
}

function isKnownStorageKey(name) {
    return Object.prototype.hasOwnProperty.call(STORAGE_FILES, name);
}

function filePathFor(userDataDir, name) {
    return path.join(profileDirectory(userDataDir), fileNameForKey(name));
}

function parseStoredJson(text) {
    try {
        JSON.parse(text);
        return text;
    } catch (err) {
        return null;
    }
}

async function readValidFile(filePath) {
    const text = await readTextFile(filePath);
    if (text === null) {
        return null;
    }
    return parseStoredJson(text);
}

async function rotateBackup(filePath) {
    const text = await readTextFile(filePath);
    if (text === null || parseStoredJson(text) === null) {
        return;
    }
    await atomicWriteFile(`${filePath}.bak`, text);
}

function createProfileStore(userDataDir) {
    if (typeof userDataDir !== 'string' || !userDataDir) {
        throw new Error('invalid profile directory');
    }

    const queues = new Map();

    function enqueue(name, task) {
        const previous = queues.get(name) || Promise.resolve();
        const next = previous.catch(() => {}).then(task);
        queues.set(name, next);

        return next.finally(() => {
            if (queues.get(name) === next) {
                queues.delete(name);
            }
        });
    }

    async function get(name) {
        const filePath = filePathFor(userDataDir, name);
        const primary = await readValidFile(filePath);
        if (primary !== null) {
            return primary;
        }

        return readValidFile(`${filePath}.bak`);
    }

    function set(name, value) {
        const filePath = filePathFor(userDataDir, name);

        return enqueue(name, async() => {
            if (value === null || value === undefined) {
                await removeFile(filePath);
                await removeFile(`${filePath}.bak`);
                return;
            }

            if (typeof value !== 'string') {
                throw new Error('storage value must be a string');
            }
            if (Buffer.byteLength(value, 'utf8') > MAX_STORAGE_BYTES) {
                throw new Error('storage value is too large');
            }
            if (parseStoredJson(value) === null) {
                throw new Error('storage value must be valid JSON');
            }

            await ensureDirectory(profileDirectory(userDataDir));
            await rotateBackup(filePath);
            await atomicWriteFile(filePath, value);
        });
    }

    return {
        get,
        set,
        filePathFor: (name) => filePathFor(userDataDir, name),
        profileDirectory: () => profileDirectory(userDataDir),
    };
}

module.exports = {
    MAX_STORAGE_BYTES,
    PROFILE_ID,
    STORAGE_FILES,
    createProfileStore,
    fileNameForKey,
    profileDirectory,
};
