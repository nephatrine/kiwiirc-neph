/* Generic plugin secret storage for the desktop shell.
 *
 * Plugins keep small secret blobs (keys, tokens) that are not part of the
 * saved profile. They are stored in a single document beside the profile so
 * they survive restarts, and encrypted with safeStorage whenever it is
 * available. Plaintext documents are only written when secure storage is
 * unavailable and no encrypted document already exists.
 *
 * Never log secret values.
 */
const path = require('node:path');
const {
    atomicWriteFile,
    readTextFile,
    removeFile,
} = require('./file-utils');

const PLUGIN_SECRETS_FILE = 'plugin-secrets.json';
const PLUGIN_SECRETS_VERSION = 1;
const MAX_SCOPES = 64;
const MAX_SCOPE_LENGTH = 64;
const MAX_SECRET_BYTES = 256 * 1024;

const SCOPE_PATTERN = /^[A-Za-z0-9._-]+$/;

function validScope(scope) {
    return typeof scope === 'string' &&
        scope.length > 0 &&
        scope.length <= MAX_SCOPE_LENGTH &&
        SCOPE_PATTERN.test(scope);
}

function validSecret(value) {
    return typeof value === 'string' &&
        value.length > 0 &&
        Buffer.byteLength(value, 'utf8') <= MAX_SECRET_BYTES;
}

function sanitizeScopeMap(value) {
    const result = {};

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return result;
    }

    Object.keys(value)
        .filter(validScope)
        .slice(0, MAX_SCOPES)
        .forEach((scope) => {
            if (validSecret(value[scope])) {
                result[scope] = value[scope];
            }
        });

    return result;
}

function parseDocument(text) {
    try {
        const document = JSON.parse(text);
        if (!document ||
            document.version !== PLUGIN_SECRETS_VERSION ||
            (document.protection !== 'safeStorage' &&
                document.protection !== 'plaintext')
        ) {
            return null;
        }
        return document;
    } catch (err) {
        return null;
    }
}

function createPluginSecretStore({ userDataDir, safeStorage, log = null }) {
    if (typeof userDataDir !== 'string' || !userDataDir) {
        throw new Error('invalid profile directory');
    }

    const filePath = path.join(userDataDir, PLUGIN_SECRETS_FILE);

    function warn(message, details) {
        if (!log || typeof log.warn !== 'function') {
            return;
        }
        try {
            log.warn(message, details);
        } catch (err) {
            // Logging must never break secret handling.
        }
    }

    async function encryptionAvailable() {
        if (!safeStorage) {
            return false;
        }
        try {
            if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
                return await safeStorage.isAsyncEncryptionAvailable();
            }
            if (typeof safeStorage.isEncryptionAvailable === 'function') {
                return safeStorage.isEncryptionAvailable();
            }
        } catch (err) {
            return false;
        }
        return false;
    }

    async function readScopeMap() {
        const text = await readTextFile(filePath);
        if (text === null) {
            return { scopes: {}, protection: 'none' };
        }

        const document = parseDocument(text);
        if (!document) {
            warn('Ignoring unreadable plugin secrets file', { file: filePath });
            return { scopes: {}, protection: 'none' };
        }

        if (document.protection === 'plaintext') {
            return {
                scopes: sanitizeScopeMap(document.data),
                protection: 'plaintext',
            };
        }

        if (!safeStorage ||
            typeof safeStorage.decryptStringAsync !== 'function'
        ) {
            throw new Error('secure plugin secret storage is unavailable');
        }

        const decrypted = await safeStorage.decryptStringAsync(
            Buffer.from(String(document.data || ''), 'base64')
        );
        return {
            scopes: sanitizeScopeMap(JSON.parse(decrypted.result)),
            protection: 'safeStorage',
        };
    }

    async function writeScopeMap(scopes, previousProtection) {
        if (!Object.keys(scopes).length) {
            await removeFile(filePath);
            return;
        }

        if (await encryptionAvailable()) {
            const encrypted = await safeStorage.encryptStringAsync(
                JSON.stringify(scopes)
            );
            await atomicWriteFile(filePath, JSON.stringify({
                version: PLUGIN_SECRETS_VERSION,
                protection: 'safeStorage',
                data: Buffer.from(encrypted).toString('base64'),
            }));
            return;
        }

        if (previousProtection === 'safeStorage') {
            throw new Error('secure plugin secret storage is unavailable');
        }

        await atomicWriteFile(filePath, JSON.stringify({
            version: PLUGIN_SECRETS_VERSION,
            protection: 'plaintext',
            data: scopes,
        }));
    }

    async function get(scope) {
        if (!validScope(scope)) {
            return null;
        }
        const { scopes } = await readScopeMap();
        return typeof scopes[scope] === 'string' ? scopes[scope] : null;
    }

    async function set(scope, value) {
        if (!validScope(scope)) {
            throw new Error('invalid plugin secret scope');
        }
        if (!validSecret(value)) {
            throw new Error('invalid plugin secret value');
        }

        const current = await readScopeMap();
        const scopes = Object.assign({}, current.scopes);
        scopes[scope] = value;
        await writeScopeMap(scopes, current.protection);
    }

    async function remove(scope) {
        if (!validScope(scope)) {
            return;
        }

        const current = await readScopeMap();
        if (!Object.prototype.hasOwnProperty.call(current.scopes, scope)) {
            return;
        }

        const scopes = Object.assign({}, current.scopes);
        delete scopes[scope];
        await writeScopeMap(scopes, current.protection);
    }

    return {
        filePath: () => filePath,
        get,
        set,
        remove,
    };
}

module.exports = {
    PLUGIN_SECRETS_FILE,
    PLUGIN_SECRETS_VERSION,
    createPluginSecretStore,
    sanitizeScopeMap,
};
