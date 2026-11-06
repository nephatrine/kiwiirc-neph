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
        decryptStringAsync: jest.fn(async(value) => ({
            result: value.toString('utf8').replace(/^enc:/, ''),
            shouldReEncrypt: false,
        })),
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

    it('reports an OS-backed store as secure', async() => {
        const status = await store.status();

        expect(status.available).toBe(true);
        expect(status.secure).toBe(true);
        expect(status.protection).toBe('safeStorage');
        expect(status.backend).toBe('gnome_libsecret');
    });

    it('reports basic_text as available but insecure', async() => {
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ backend: 'basic_text' }),
        });

        const status = await store.status();

        expect(status.available).toBe(true);
        expect(status.secure).toBe(false);
        expect(status.protection).toBe('safeStorage');
    });

    it('encrypts secrets and restores them', async() => {
        await store.save('kiwi-state', {
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });

        const file = fs.readFileSync(store.filePath(), 'utf8');
        expect(file).not.toContain('server-secret');
        expect(file).not.toContain('sasl-secret');
        expect(await store.load('kiwi-state')).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
    });

    it('uses plaintext when encryption is unavailable', async() => {
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ available: false }),
        });

        const status = await store.status();
        await store.save('kiwi-state', {
            1: { connection: 'server-secret' },
        });

        expect(status.protection).toBe('plaintext');
        expect(status.secure).toBe(false);
        expect(fs.readFileSync(store.filePath(), 'utf8')).toContain('server-secret');
        expect(await store.load('kiwi-state')).toEqual({
            1: { connection: 'server-secret' },
        });
    });

    it('does not downgrade an encrypted file when storage becomes unavailable', async() => {
        await store.save('kiwi-state', {
            1: { sasl: 'sasl-secret' },
        });
        const encryptedFile = fs.readFileSync(store.filePath(), 'utf8');

        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ available: false }),
        });

        await expect(store.save('kiwi-state', {
            1: { sasl: 'new-secret' },
        })).rejects.toThrow('secure password storage is unavailable');
        expect(fs.readFileSync(store.filePath(), 'utf8')).toBe(encryptedFile);
    });

    it('falls back to plaintext if encryption throws without an existing secret file', async() => {
        store = createSecretStore({
            userDataDir,
            safeStorage: makeSafeStorage({ failEncrypt: true }),
        });

        const status = await store.save('kiwi-state', {
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

    it('ignores a secret file belonging to another state key', async() => {
        await store.save('other-state', {
            1: { connection: 'secret' },
        });

        expect(await store.load('kiwi-state')).toBe(null);
    });
});
