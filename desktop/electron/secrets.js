const fsp = require('node:fs/promises');
const path = require('node:path');
const {
    atomicWriteFile,
    readTextFile,
    removeFile,
} = require('./file-utils');
const { profileDirectory } = require('./profile-store');

const SECRETS_FILE = 'secrets.json';
const SECRETS_VERSION = 1;
const MAX_SECRET_BYTES = 64 * 1024;
const MAX_NETWORKS = 200;

function assertStateKey(stateKey) {
    if (typeof stateKey !== 'string' || !stateKey || stateKey.length > 128) {
        throw new Error('invalid state key');
    }
}

function validSecret(value) {
    return typeof value === 'string' &&
        value &&
        Buffer.byteLength(value, 'utf8') <= MAX_SECRET_BYTES;
}

function sanitizeSecrets(value) {
    const result = {};

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return result;
    }

    const fileupload = value.fileupload;
    if (fileupload && typeof fileupload === 'object' && !Array.isArray(fileupload) &&
        validSecret(fileupload.webdavPassword)
    ) {
        result.fileupload = {
            webdavPassword: fileupload.webdavPassword,
        };
    }

    Object.keys(value)
        .filter((networkId) => /^\d{1,12}$/.test(networkId))
        .slice(0, MAX_NETWORKS)
        .forEach((networkId) => {
            const source = value[networkId];
            if (!source || typeof source !== 'object' || Array.isArray(source)) {
                return;
            }

            const entry = {};
            ['connection', 'sasl'].forEach((field) => {
                if (validSecret(source[field])) {
                    entry[field] = source[field];
                }
            });

            if (Object.keys(entry).length) {
                result[networkId] = entry;
            }
        });

    return result;
}

function secretsFilePath(userDataDir) {
    return path.join(profileDirectory(userDataDir), SECRETS_FILE);
}

function parseDocument(text) {
    try {
        const document = JSON.parse(text);
        if (!document ||
            document.version !== SECRETS_VERSION ||
            (document.protection !== 'safeStorage' &&
                document.protection !== 'plaintext') ||
            typeof document.stateKey !== 'string'
        ) {
            return null;
        }
        return document;
    } catch (err) {
        return null;
    }
}

async function readDocument(filePath) {
    const primary = await readTextFile(filePath);
    if (primary !== null) {
        const document = parseDocument(primary);
        if (document) {
            return document;
        }
    }

    const backup = await readTextFile(`${filePath}.bak`);
    return backup === null ? null : parseDocument(backup);
}

function createSecretStore({ userDataDir, safeStorage, log = null }) {
    if (typeof userDataDir !== 'string' || !userDataDir) {
        throw new Error('invalid profile directory');
    }

    const filePath = secretsFilePath(userDataDir);
    let lastLoadError = '';

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

    async function quarantine(file) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const target = `${file}.undecryptable-${stamp}`;
        try {
            await fsp.rename(file, target);
            return target;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                warn('Failed to quarantine undecryptable secrets file', {
                    file,
                    reason: err && err.message ? err.message : String(err),
                });
            }
            return null;
        }
    }

    async function status() {
        let available = false;
        let backend = 'unknown';

        if (safeStorage) {
            try {
                if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
                    available = await safeStorage.isAsyncEncryptionAvailable();
                } else if (typeof safeStorage.isEncryptionAvailable === 'function') {
                    available = safeStorage.isEncryptionAvailable();
                }
            } catch (err) {
                available = false;
            }

            if (process.platform === 'linux' &&
                typeof safeStorage.getSelectedStorageBackend === 'function'
            ) {
                try {
                    backend = safeStorage.getSelectedStorageBackend();
                } catch (err) {
                    backend = 'unknown';
                }
            } else if (process.platform === 'win32') {
                backend = 'dpapi';
            } else if (process.platform === 'darwin') {
                backend = 'keychain';
            }
        }

        const secure = available &&
            backend !== 'basic_text' &&
            backend !== 'unknown';

        return {
            available,
            secure,
            backend,
            protection: available ? 'safeStorage' : 'plaintext',
            lastLoadError,
        };
    }

    async function writeDocument(document) {
        await atomicWriteFile(filePath, JSON.stringify(document));
    }

    async function writePlain(stateKey, secrets) {
        await writeDocument({
            version: SECRETS_VERSION,
            stateKey,
            protection: 'plaintext',
            data: secrets,
        });
    }

    async function writeEncrypted(stateKey, secrets, currentStatus) {
        const encrypted = await safeStorage.encryptStringAsync(
            JSON.stringify(secrets)
        );
        await writeDocument({
            version: SECRETS_VERSION,
            stateKey,
            protection: 'safeStorage',
            backend: currentStatus.backend,
            data: Buffer.from(encrypted).toString('base64'),
        });
    }

    async function loadCandidate(candidate, stateKey, currentStatus) {
        const text = await readTextFile(candidate);
        if (text === null) {
            return { status: 'missing' };
        }

        const document = parseDocument(text);
        if (!document || document.stateKey !== stateKey) {
            return { status: 'missing' };
        }

        if (document.protection === 'plaintext') {
            lastLoadError = '';
            return {
                status: 'loaded',
                secrets: sanitizeSecrets(document.data),
            };
        }

        if (!currentStatus.available || !safeStorage ||
            typeof safeStorage.decryptStringAsync !== 'function'
        ) {
            lastLoadError = 'unavailable';
            throw new Error('secure password storage is unavailable');
        }

        try {
            const decrypted = await safeStorage.decryptStringAsync(
                Buffer.from(String(document.data || ''), 'base64')
            );
            const secrets = sanitizeSecrets(JSON.parse(decrypted.result));
            lastLoadError = '';

            if (decrypted.shouldReEncrypt) {
                try {
                    await writeEncrypted(stateKey, secrets, currentStatus);
                } catch (err) {
                    // The decrypted values are still usable for this session.
                }
            }

            return { status: 'loaded', secrets };
        } catch (err) {
            lastLoadError = 'decrypt-failed';
            await quarantine(candidate);
            warn('Stored passwords could not be decrypted; quarantined file', {
                stateKey,
                backend: currentStatus.backend,
                file: candidate,
                reason: err && err.message ? err.message : String(err),
            });
            return { status: 'quarantined' };
        }
    }

    async function load(stateKey) {
        assertStateKey(stateKey);
        const currentStatus = await status();

        const primary = await loadCandidate(filePath, stateKey, currentStatus);
        if (primary.status === 'loaded') {
            return primary.secrets;
        }

        const backup = await loadCandidate(
            `${filePath}.bak`,
            stateKey,
            currentStatus
        );
        if (backup.status === 'loaded') {
            return backup.secrets;
        }

        return null;
    }

    async function save(stateKey, value) {
        assertStateKey(stateKey);
        const secrets = sanitizeSecrets(value);
        lastLoadError = '';

        if (!Object.keys(secrets).length) {
            await clear(stateKey);
            return status();
        }

        const existing = await readDocument(filePath);
        const currentStatus = await status();

        if (currentStatus.available && safeStorage &&
            typeof safeStorage.encryptStringAsync === 'function'
        ) {
            try {
                await writeEncrypted(stateKey, secrets, currentStatus);
                return currentStatus;
            } catch (err) {
                if (existing && existing.protection === 'safeStorage') {
                    throw err;
                }
            }
        }

        if (existing && existing.protection === 'safeStorage') {
            throw new Error('secure password storage is unavailable');
        }

        await writePlain(stateKey, secrets);
        return {
            ...currentStatus,
            protection: 'plaintext',
            secure: false,
        };
    }

    async function clear(stateKey) {
        assertStateKey(stateKey);
        lastLoadError = '';
        const document = await readDocument(filePath);
        if (document && document.stateKey !== stateKey) {
            return;
        }
        await removeFile(filePath);
        await removeFile(`${filePath}.bak`);
    }

    return {
        clear,
        filePath: () => filePath,
        load,
        save,
        status,
    };
}

module.exports = {
    SECRETS_FILE,
    SECRETS_VERSION,
    createSecretStore,
    sanitizeSecrets,
    secretsFilePath,
};
