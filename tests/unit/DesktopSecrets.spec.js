import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    createSecretStore,
    sanitizeSecrets
} from '../../desktop/electron/secrets';

function makeSafeStorage({
    available = true,
    backend = 'gnome_libsecret',
    failEncrypt = false,
    failDecrypt = false,
} = {}) {
    return {
        isAsyncEncryptionAvailable: jest.fn(async() => available),
        getSelectedStorageBackend: jest.fn(() => backend),
        encryptStringAsync: jest.fn(async(value) => {
            if (failEncrypt) {
                throw new Error('encryption failed');
            }
            return Buffer.from(`enc:${value}`, 'utf8');
        }),
        decryptStringAsync: jest.fn(async(value) => {
            if (failDecrypt) {
                throw new Error('Error while decrypting the ciphertext');
            }
            const text = value.toString('utf8');
            if (!text.startsWith('enc:')) {
                throw new Error('Error while decrypting the ciphertext');
            }
            return {
                result: text.slice('enc:'.length),
                shouldReEncrypt: false,
            };
        }),
    };
}

describe('Desktop secret store', () => {
    let userDataDir;
    let safeStorage;
    let store;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-secrets-'));
        safeStorage = makeSafeStorage();
        store = createSecretStore({ userDataDir, safeStorage });
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('reports secure and basic_text storage status', async() => {
        let status = await store.status();
        expect(status).toMatchObject({
            available: true,
            secure: true,
            protection: 'safeStorage',
            backend: 'gnome_libsecret',
        });

        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ backend: 'basic_text' }),
        });
        status = await store.status();
        expect(status).toMatchObject({
            available: true,
            secure: false,
            protection: 'safeStorage',
        });
    });

    it('encrypts network and WebDAV secrets and restores them', async() => {
        await store.save('kiwi-state', {
            1: { connection: 'server-secret', sasl: 'sasl-secret' },
            fileupload: { webdavPassword: 'webdav-secret' },
        });

        const file = fs.readFileSync(store.filePath(), 'utf8');
        expect(file).not.toContain('server-secret');
        expect(file).not.toContain('sasl-secret');
        expect(file).not.toContain('webdav-secret');
        expect(await store.load('kiwi-state')).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
            fileupload: { webdavPassword: 'webdav-secret' },
        });
    });

    it('handles unavailable and failing encryption', async() => {
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ available: false }),
        });
        let status = await store.status();
        await store.save('kiwi-state', {
            1: { connection: 'server-secret' },
        });
        expect(status.protection).toBe('plaintext');
        expect(status.secure).toBe(false);
        expect(fs.readFileSync(store.filePath(), 'utf8')).toContain('server-secret');
        expect(await store.load('kiwi-state')).toEqual({
            1: { connection: 'server-secret' },
        });

        const encryptedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-secrets-enc-'));
        try {
            const encryptedStore = createSecretStore({
                userDataDir: encryptedDir,
                safeStorage: makeSafeStorage(),
            });
            await encryptedStore.save('kiwi-state', {
                1: { sasl: 'sasl-secret' },
            });
            const encryptedFile = fs.readFileSync(encryptedStore.filePath(), 'utf8');

            const unavailableStore = createSecretStore({
                userDataDir: encryptedDir,
                safeStorage: makeSafeStorage({ available: false }),
            });
            await expect(unavailableStore.save('kiwi-state', {
                1: { sasl: 'new-secret' },
            })).rejects.toThrow('secure password storage is unavailable');
            expect(fs.readFileSync(encryptedStore.filePath(), 'utf8'))
                .toBe(encryptedFile);
        } finally {
            fs.rmSync(encryptedDir, { recursive: true, force: true });
        }

        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ failEncrypt: true }),
        });
        status = await store.save('kiwi-state', {
            1: { sasl: 'sasl-secret' },
        });
        expect(status.protection).toBe('plaintext');
        expect(await store.load('kiwi-state')).toEqual({
            1: { sasl: 'sasl-secret' },
        });
    });

    it('clears the secret file', async() => {
        await store.save('kiwi-state', {
            1: { connection: 'server-secret' },
        });
        await store.clear('kiwi-state');

        expect(fs.existsSync(store.filePath())).toBe(false);
        expect(await store.load('kiwi-state')).toBe(null);
    });

    it('filters invalid and oversized secret entries', () => {
        const secrets = sanitizeSecrets({
            bad: { connection: 'nope' },
            1: {
                connection: 'ok',
                sasl: 'x'.repeat(64 * 1024 + 1),
                extra: 'ignored',
            },
        });

        expect(secrets).toEqual({ 1: { connection: 'ok' } });
    });

    it('preserves only a valid WebDAV password', () => {
        expect(sanitizeSecrets({
            fileupload: { webdavPassword: 'webdav-secret' },
        })).toEqual({
            fileupload: { webdavPassword: 'webdav-secret' },
        });

        expect(sanitizeSecrets({
            fileupload: { webdavPassword: '' },
        })).toEqual({});
        expect(sanitizeSecrets({
            fileupload: { webdavPassword: 'x'.repeat(64 * 1024 + 1) },
        })).toEqual({});
    });

    it('keeps the WebDAV password when the network limit is reached', () => {
        const value = {
            fileupload: { webdavPassword: 'webdav-secret' },
        };
        for (let id = 1; id <= 200; id += 1) {
            value[id] = { connection: 'network-secret' };
        }

        const secrets = sanitizeSecrets(value);
        expect(secrets.fileupload).toEqual({
            webdavPassword: 'webdav-secret',
        });
        expect(Object.keys(secrets)).toHaveLength(201);
    });

    it('ignores a secret file belonging to another state key', async() => {
        await store.save('other-state', {
            1: { connection: 'secret' },
        });

        expect(await store.load('kiwi-state')).toBe(null);
    });

    it('quarantines undecryptable secrets and allows saving again', async() => {
        await store.save('kiwi-state', {
            1: { sasl: 'old-secret' },
        });
        const file = store.filePath();
        const document = JSON.parse(fs.readFileSync(file, 'utf8'));
        document.data = Buffer.from('not-encrypted').toString('base64');
        fs.writeFileSync(file, JSON.stringify(document));

        const warn = jest.fn();
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage(),
            log: { warn },
        });

        expect(await store.load('kiwi-state')).toBe(null);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(/could not be decrypted/);
        expect(warn.mock.calls[0][1]).toMatchObject({
            stateKey: 'kiwi-state',
            backend: 'gnome_libsecret',
        });
        expect(JSON.stringify(warn.mock.calls[0][1])).not.toContain('not-encrypted');

        expect(fs.existsSync(file)).toBe(false);
        const quarantined = fs.readdirSync(path.dirname(file))
            .filter((name) => name.startsWith('secrets.json.undecryptable-'));
        expect(quarantined).toHaveLength(1);
        expect(await store.status()).toMatchObject({
            lastLoadError: 'decrypt-failed',
        });

        await store.save('kiwi-state', {
            1: { sasl: 'new-secret' },
        });
        expect(await store.load('kiwi-state')).toEqual({
            1: { sasl: 'new-secret' },
        });
        expect((await store.status()).lastLoadError).toBe('');
    });

    it('falls back to the backup when the primary cannot be decrypted', async() => {
        await store.save('kiwi-state', {
            1: { connection: 'backup-secret' },
        });
        const file = store.filePath();
        fs.copyFileSync(file, `${file}.bak`);

        const document = JSON.parse(fs.readFileSync(file, 'utf8'));
        document.data = Buffer.from('corrupt').toString('base64');
        fs.writeFileSync(file, JSON.stringify(document));

        const warn = jest.fn();
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage(),
            log: { warn },
        });

        expect(await store.load('kiwi-state')).toEqual({
            1: { connection: 'backup-secret' },
        });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(fs.existsSync(file)).toBe(false);
        expect(fs.existsSync(`${file}.bak`)).toBe(true);
    });

    it('loads plaintext secrets without decrypting or warning', async() => {
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ available: false }),
            log: { warn: jest.fn() },
        });
        await store.save('kiwi-state', {
            1: { connection: 'plain-secret' },
        });

        const warn = jest.fn();
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage(),
            log: { warn },
        });

        expect(await store.load('kiwi-state')).toEqual({
            1: { connection: 'plain-secret' },
        });
        expect(warn).not.toHaveBeenCalled();
        expect(await store.status()).toMatchObject({ lastLoadError: '' });
    });

    it('still throws when secure storage is unavailable for encrypted files', async() => {
        await store.save('kiwi-state', {
            1: { sasl: 'sasl-secret' },
        });

        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ available: false }),
        });

        await expect(store.load('kiwi-state'))
            .rejects.toThrow('secure password storage is unavailable');
        expect(fs.existsSync(store.filePath())).toBe(true);
    });
});
