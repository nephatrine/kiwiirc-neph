import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Vue from 'vue';
import { createProfileStore, fileNameForKey } from '../../desktop/electron/profile-store';
import {
    applyPendingImport,
    isProfileArchive,
    prepareProfileArchive,
    writeProfileArchive
} from '../../desktop/electron/profile-archive';
import state from '@/libs/state';
import StatePersistence from '@/libs/StatePersistence';
import ProfileSettings from '@/components/ProfileSettings';
import * as MetadataCache from '@/libs/MetadataCache';
import { migrateLegacyProfile } from '@/libs/storage/DesktopMigration';
import {
    applyProfileBundle,
    buildProfileBundle,
    collectProfileSecrets,
    parseProfileBundleText,
    validateProfileBundle
} from '@/libs/ProfileTransfer';

jest.mock('@/libs/WebpushUtils', () => ({
    ...jest.requireActual('@/libs/WebpushUtils'),
    unsubscribeStateBrowserSubscriptions: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/libs/MetadataCache', () => ({
    ...jest.requireActual('@/libs/MetadataCache'),
    clear: jest.fn(() => Promise.resolve()),
    flush: jest.fn(() => Promise.resolve()),
}));

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

describe('Desktop password persistence', () => {
    function makeSecretStore() {
        return {
            load: jest.fn(async() => null),
            save: jest.fn(async() => ({})),
            clear: jest.fn(async() => {}),
        };
    }

    function makePersistence(options = {}) {
        const appState = state.create();
        appState.settings.startupOptions = {};
        const network = appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.password = 'sasl-secret';
        network.connection.password = 'server-secret';
        network.connection.account = 'TestAccount';

        const storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        const secretStore = makeSecretStore();
        const persistence = new StatePersistence(
            'test-key',
            appState,
            storage,
            null,
            secretStore
        );
        persistence.includePasswords = options.includePasswords !== false;
        return {
            appState,
            network,
            persistence,
            secretStore,
            storage,
        };
    }

    it('stores sanitized state and restores both password kinds', async() => {
        const { persistence, secretStore, storage } = makePersistence();

        const result = await persistence.saveStateNow();

        expect(result.secretsSaved).toBe(true);
        const storedState = storage.set.mock.calls[0][1];
        const saved = JSON.parse(storedState);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        expect(secretStore.save).toHaveBeenCalledWith('test-key', {
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });

        const restored = state.create();
        restored.settings.startupOptions = {};
        const restoredSecrets = makeSecretStore();
        restoredSecrets.load.mockResolvedValue(secretStore.save.mock.calls[0][1]);
        const restoredPersistence = new StatePersistence(
            'test-key',
            restored,
            {
                get: jest.fn(async() => storedState),
                set: jest.fn(async() => {}),
            },
            null,
            restoredSecrets
        );

        await restoredPersistence.loadStateIfExists();

        expect(restored.networks).toHaveLength(1);
        expect(restored.networks[0].connection.account).toBe('TestAccount');
        expect(restored.networks[0].connection.password).toBe('server-secret');
        expect(restored.networks[0].password).toBe('sasl-secret');
    });

    it('stores and restores the WebDAV password separately', async() => {
        const { appState, persistence, secretStore, storage } = makePersistence();
        appState.setting('fileupload.webdav.password', 'webdav-secret');

        await persistence.saveStateNow();

        expect(secretStore.save).toHaveBeenCalledWith('test-key', {
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
            fileupload: {
                webdavPassword: 'webdav-secret',
            },
        });

        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.user_settings.fileupload.webdav.password).toBeUndefined();

        const restored = state.create();
        restored.settings.startupOptions = {};
        const restoredSecrets = makeSecretStore();
        restoredSecrets.load.mockResolvedValue(secretStore.save.mock.calls[0][1]);
        const restoredPersistence = new StatePersistence(
            'test-key',
            restored,
            { get: jest.fn(), set: jest.fn(async() => {}) },
            null,
            restoredSecrets
        );

        await restoredPersistence.loadStateIfExists();

        expect(restored.setting('fileupload.webdav.password'))
            .toBe('webdav-secret');
    });

    it('omits or clears passwords when disabled', async() => {
        let { network, persistence, secretStore, storage } = makePersistence();
        network.setting('rememberPassword', false);

        await persistence.saveStateNow();

        let saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        expect(secretStore.clear).toHaveBeenCalledWith('test-key');
        expect(secretStore.save).not.toHaveBeenCalled();

        let ctx = makePersistence({ includePasswords: false });
        await ctx.persistence.saveStateNow();

        saved = JSON.parse(ctx.storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(ctx.secretStore.clear).toHaveBeenCalledWith('test-key');
        expect(ctx.storage.set).toHaveBeenCalled();

        ({ persistence, secretStore } = makePersistence());
        await persistence.clearStoredState();

        expect(secretStore.clear).toHaveBeenCalledWith('test-key');
    });

    it('still saves sanitized state when secret storage fails', async() => {
        const { persistence, secretStore, storage } = makePersistence();
        secretStore.save.mockRejectedValue(new Error('keyring unavailable'));

        const result = await persistence.saveStateNow();

        expect(result.secretsSaved).toBe(false);
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
    });
});

describe('Desktop profile store', () => {
    const fs = fsSync;
    let userDataDir;
    let store;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-profile-'));
        store = createProfileStore(userDataDir);
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('stores files, rotates the previous version, and falls back to it', async() => {
        await store.set('kiwi-state', '{"networks":[]}');
        await store.set('kiwi-metadata-cache', '{"networks":{}}');

        expect(await store.get('kiwi-state')).toBe('{"networks":[]}');
        expect(await store.get('kiwi-metadata-cache')).toBe('{"networks":{}}');
        expect(
            fs.existsSync(path.join(userDataDir, 'profiles', 'default', 'state.json'))
        ).toBe(true);
        expect(
            fs.existsSync(
                path.join(userDataDir, 'profiles', 'default', 'metadata-cache.json')
            )
        ).toBe(true);

        await store.set('kiwi-state', '{"version":2}');
        expect(await store.get('kiwi-state')).toBe('{"version":2}');
        expect(fs.readFileSync(
            `${store.filePathFor('kiwi-state')}.bak`,
            'utf8'
        )).toBe('{"networks":[]}');

        fs.writeFileSync(store.filePathFor('kiwi-state'), '{broken');
        expect(await store.get('kiwi-state')).toBe('{"networks":[]}');
    });

    it('deletes both the primary file and backup for a null value', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-state', '{"version":2}');
        await store.set('kiwi-state', null);

        expect(await store.get('kiwi-state')).toBe(null);
        expect(fs.existsSync(store.filePathFor('kiwi-state'))).toBe(false);
        expect(fs.existsSync(`${store.filePathFor('kiwi-state')}.bak`)).toBe(false);
    });

    it('rejects invalid values and path-like keys', async() => {
        await expect(store.set('kiwi-state', '{broken')).rejects.toThrow();
        await expect(store.set('kiwi-state', 123)).rejects.toThrow();
        expect(() => fileNameForKey('../state')).toThrow();
        expect(() => fileNameForKey('bad/key')).toThrow();
        expect(fileNameForKey('custom-state')).toBe('state-custom-state.json');
    });

    it('backs up the current profile files', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-metadata-cache', '{"networks":{}}');
        fs.writeFileSync(
            path.join(store.profileDirectory(), 'secrets.json'),
            '{"version":1}'
        );

        const backupDir = await store.backup();
        const backupFiles = fs.readdirSync(backupDir).sort();

        expect(backupFiles).toEqual([
            'metadata-cache.json',
            'secrets.json',
            'state.json',
        ]);
        expect(fs.readFileSync(path.join(backupDir, 'state.json'), 'utf8'))
            .toBe('{"version":1}');
    });
});

describe('profile archive', () => {
    const fs = fsp;
    const ICON_URL = 'kiwi-icon://network-icon/example.png';
    let root;
    let userData;

    function profileBundle(url = ICON_URL) {
        return {
            format: 'kiwi-profile',
            version: 1,
            source: 'desktop',
            exportedAt: '2026-11-19T00:00:00.000Z',
            state: {
                networks: [{
                    name: 'Example',
                    settings: { network_icon_url: url },
                }],
            },
        };
    }

    async function populate(dir) {
        await fs.mkdir(path.join(dir, 'network-icons'), { recursive: true });
        await fs.mkdir(path.join(dir, 'themes', 'custom'), { recursive: true });
        await fs.mkdir(path.join(dir, 'emoji-packs', 'testpack'), { recursive: true });
        await fs.mkdir(path.join(dir, 'plugins', 'testplugin'), { recursive: true });

        await fs.writeFile(
            path.join(dir, 'network-icons', 'example.png'),
            Buffer.from('fake-icon')
        );
        await fs.writeFile(
            path.join(dir, 'themes', 'custom', 'theme.css'),
            '.kiwi-wrap { color: red; }'
        );
        await fs.writeFile(
            path.join(dir, 'themes', 'custom', 'theme.json'),
            JSON.stringify({ name: 'Custom Theme' })
        );
        await fs.writeFile(
            path.join(dir, 'themes', 'custom', 'font.woff2'),
            Buffer.from('fake-font')
        );
        await fs.writeFile(
            path.join(dir, 'emoji-packs', 'testpack', 'emoji.json'),
            JSON.stringify([{
                id: 'testpack',
                name: 'Test Pack',
                emoji: { kiwi: { url: 'kiwi.png' } },
            }])
        );
        await fs.writeFile(
            path.join(dir, 'emoji-packs', 'testpack', 'kiwi.png'),
            Buffer.from('fake-emoji')
        );
        await fs.writeFile(
            path.join(dir, 'plugins', 'testplugin', 'plugin.json'),
            JSON.stringify({ name: 'Test Plugin', entry: 'plugin.js' })
        );
        await fs.writeFile(
            path.join(dir, 'plugins', 'testplugin', 'plugin.js'),
            'window.kiwi.plugin();'
        );
    }

    beforeEach(async() => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-profile-archive-'));
        userData = path.join(root, 'userdata');
        await populate(userData);
    });

    afterEach(async() => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it('round-trips icons, themes, emoji packs, and plugins', async() => {
        const archive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: true,
        });
        expect(isProfileArchive(archive)).toBe(true);

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        expect(JSON.parse(prepared.text).format).toBe('kiwi-profile');
        expect(prepared.hasPlugins).toBe(true);

        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary).toEqual({
            themes: 1,
            emojiPacks: 1,
            plugins: 1,
            icons: 1,
            skipped: 0,
        });
        expect(await fs.readFile(
            path.join(destination, 'network-icons', 'example.png'),
            'utf8'
        )).toBe('fake-icon');
        expect(await fs.readFile(
            path.join(destination, 'themes', 'custom', 'theme.css'),
            'utf8'
        )).toContain('color: red');
        expect(await fs.readFile(
            path.join(destination, 'themes', 'custom', 'font.woff2'),
            'utf8'
        )).toBe('fake-font');
        expect(await fs.readFile(
            path.join(destination, 'emoji-packs', 'testpack', 'kiwi.png'),
            'utf8'
        )).toBe('fake-emoji');
        expect(await fs.readFile(
            path.join(destination, 'plugins', 'testplugin', 'plugin.js'),
            'utf8'
        )).toBe('window.kiwi.plugin();');
    });

    it('omits local assets when excluded and skips installed ones', async() => {
        const archive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: false,
        });

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        expect(prepared.hasPlugins).toBe(false);
        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary).toEqual({
            themes: 0,
            emojiPacks: 0,
            plugins: 0,
            icons: 0,
            skipped: 0,
        });
        expect(await fs.readdir(destination)).toEqual([]);

        const fullArchive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: true,
        });
        const existing = path.join(root, 'existing');
        await fs.mkdir(path.join(existing, 'themes', 'custom'), {
            recursive: true,
        });
        await fs.mkdir(path.join(existing, 'emoji-packs', 'testpack'), {
            recursive: true,
        });
        await fs.mkdir(path.join(existing, 'plugins', 'testplugin'), {
            recursive: true,
        });
        await fs.writeFile(
            path.join(existing, 'themes', 'custom', 'theme.css'),
            'local theme'
        );

        const preparedExisting = await prepareProfileArchive(fullArchive, existing);
        const existingSummary = await applyPendingImport(
            preparedExisting.pendingDir,
            existing
        );

        expect(existingSummary.themes).toBe(0);
        expect(existingSummary.emojiPacks).toBe(0);
        expect(existingSummary.plugins).toBe(0);
        expect(existingSummary.skipped).toBe(3);
        expect(await fs.readFile(
            path.join(existing, 'themes', 'custom', 'theme.css'),
            'utf8'
        )).toBe('local theme');
    });

    it('does not embed an icon symlink that points outside the icon directory', async() => {
        const outside = path.join(root, 'secret.txt');
        await fs.writeFile(outside, 'do not export');

        try {
            await fs.symlink(
                outside,
                path.join(userData, 'network-icons', 'linked.png')
            );
        } catch (err) {
            if (err.code === 'EPERM' || err.code === 'EACCES') {
                return;
            }
            throw err;
        }

        const archive = await writeProfileArchive(
            userData,
            profileBundle('kiwi-icon://network-icon/linked.png'),
            { includeAssets: true }
        );

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary.icons).toBe(0);
    });

    it('rejects files that are not profile archives', async() => {
        expect(isProfileArchive(Buffer.from('{"format":"kiwi-profile"}'))).toBe(false);

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        await expect(prepareProfileArchive(
            Buffer.from('not a zip file'),
            destination
        )).rejects.toBeDefined();
    });
});

describe('Profile transfer', () => {
    function makeState() {
        const s = state.create();
        s.settings.startupOptions = {};
        const network = s.addNetwork('ProfileNet', 'ProfileNick', {
            server: 'irc.example.com',
        });
        network.password = 'sasl-secret';
        network.connection.password = 'server-secret';
        network.connection.account = 'ProfileAccount';
        return { s, network };
    }

    it('exports state without secrets unless requested', () => {
        const { s, network } = makeState();
        const plain = buildProfileBundle(s);

        expect(plain.format).toBe('kiwi-profile');
        expect(plain.version).toBe(1);
        expect(plain.state.networks[0].password).toBe('');
        expect(plain.state.networks[0].connection.password).toBe('');
        expect(plain.secrets).toBeUndefined();

        const withPasswords = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
            source: 'desktop',
        });
        expect(withPasswords.source).toBe('desktop');
        expect(withPasswords.state.networks[0].password).toBe('');
        expect(withPasswords.state.networks[0].connection.password).toBe('');
        expect(withPasswords.secrets).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });

        network.setting('rememberPassword', false);
        expect(collectProfileSecrets(s)).toEqual({});
    });

    it('strips legacy passwords and rejects invalid profile data', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s);
        bundle.state.networks[0].password = 'legacy-sasl';
        bundle.state.networks[0].connection.password = 'legacy-server';

        const validated = validateProfileBundle(bundle);
        expect(validated.state.networks[0].password).toBe('');
        expect(validated.state.networks[0].connection.password).toBe('');

        expect(() => parseProfileBundleText('not json')).toThrow('invalid profile JSON');
        expect(() => validateProfileBundle({
            format: 'kiwi-profile',
            version: 2,
            state: { networks: [] },
        })).toThrow('unsupported profile version');
        expect(() => validateProfileBundle({
            format: 'other',
            version: 1,
            state: { networks: [] },
        })).toThrow('invalid profile format');
    });

    it('imports state and applies matching secrets unless the network opted out', () => {
        let ctx = makeState();
        let bundle = buildProfileBundle(ctx.s, {
            includePasswords: true,
            secrets: collectProfileSecrets(ctx.s),
        });

        let imported = state.create();
        imported.settings.startupOptions = {};
        let result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(1);
        expect(imported.networks[0].name).toBe('ProfileNet');
        expect(imported.networks[0].connection.password).toBe('server-secret');
        expect(imported.networks[0].password).toBe('sasl-secret');
        expect(imported.networks[0].connection.account).toBe('ProfileAccount');

        ctx = makeState();
        ctx.network.setting('rememberPassword', false);
        bundle = buildProfileBundle(ctx.s, {
            includePasswords: true,
            secrets: {
                1: {
                    connection: 'server-secret',
                    sasl: 'sasl-secret',
                },
            },
        });
        bundle.state.networks[0].settings.rememberPassword = false;

        imported = state.create();
        imported.settings.startupOptions = {};
        result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(0);
        expect(imported.networks[0].connection.password).toBe('');
        expect(imported.networks[0].password).toBe('');
    });

    it('protects the WebDAV password in profile exports', () => {
        const { s } = makeState();
        s.setting('fileupload.webdav.password', 'webdav-secret');

        const plain = buildProfileBundle(s);
        expect(plain.state.user_settings.fileupload.webdav.password).toBeUndefined();
        expect(plain.secrets).toBeUndefined();

        const withPasswords = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
        });
        expect(withPasswords.state.user_settings.fileupload.webdav.password)
            .toBeUndefined();
        expect(withPasswords.secrets.fileupload).toEqual({
            webdavPassword: 'webdav-secret',
        });

        const imported = state.create();
        imported.settings.startupOptions = {};
        applyProfileBundle(imported, withPasswords);
        expect(imported.setting('fileupload.webdav.password'))
            .toBe('webdav-secret');
        expect(JSON.parse(imported.exportState(true)).user_settings
            .fileupload.webdav.password).toBeUndefined();
    });
});

describe('Legacy desktop profile migration', () => {
    function makeStorage(initial = {}) {
        const values = new Map(Object.entries(initial));
        return {
            values,
            get: jest.fn(async(key) => (values.has(key) ? values.get(key) : null)),
            set: jest.fn(async(key, value) => {
                if (value === null) {
                    values.delete(key);
                } else {
                    values.set(key, value);
                }
            }),
        };
    }

    function makeLocalStorage(initial = {}) {
        const values = new Map(Object.entries(initial));
        return {
            values,
            getItem: jest.fn((key) => (values.has(key) ? values.get(key) : null)),
            removeItem: jest.fn((key) => values.delete(key)),
        };
    }

    it('migrates state and metadata, but keeps local copies on failure', async() => {
        let storage = makeStorage();
        let localStorageImpl = makeLocalStorage({
            'kiwi-state': '{"networks":[]}',
            'kiwi-metadata-cache': '{"networks":{}}',
        });
        let appState = { importState: jest.fn() };
        let persistence = {
            saveStateNow: jest.fn(async() => {
                await storage.set('kiwi-state', '{"networks":[]}');
                return {
                    secretsSaved: true,
                    stateSaved: true,
                };
            }),
        };

        await migrateLegacyProfile({
            storage,
            persistence,
            state: appState,
            storageKey: 'kiwi-state',
            localStorageImpl,
        });

        expect(appState.importState).toHaveBeenCalledWith('{"networks":[]}');
        expect(storage.set).toHaveBeenCalledWith('kiwi-state', '{"networks":[]}');
        expect(storage.set).toHaveBeenCalledWith(
            'kiwi-metadata-cache',
            '{"networks":{}}'
        );
        expect(localStorageImpl.values.has('kiwi-state')).toBe(false);
        expect(localStorageImpl.values.has('kiwi-metadata-cache')).toBe(false);

        storage = makeStorage();
        localStorageImpl = makeLocalStorage({
            'kiwi-state': '{"networks":[]}',
        });
        appState = { importState: jest.fn() };
        persistence = {
            saveStateNow: jest.fn(async() => ({
                secretsSaved: false,
                stateSaved: true,
            })),
        };

        await expect(migrateLegacyProfile({
            storage,
            persistence,
            state: appState,
            storageKey: 'kiwi-state',
            localStorageImpl,
        })).rejects.toThrow('password migration failed');

        expect(storage.set).toHaveBeenCalledWith('kiwi-state', null);
        expect(localStorageImpl.values.has('kiwi-state')).toBe(true);
    });

    it('does not overwrite an existing desktop state', async() => {
        const storage = makeStorage({
            'kiwi-state': '{"networks":[{"id":1}]}',
        });
        const localStorageImpl = makeLocalStorage({
            'kiwi-state': '{"networks":[{"id":2}]}',
        });
        const appState = { importState: jest.fn() };
        const persistence = { saveStateNow: jest.fn() };

        await migrateLegacyProfile({
            storage,
            persistence,
            state: appState,
            storageKey: 'kiwi-state',
            localStorageImpl,
        });

        expect(appState.importState).not.toHaveBeenCalled();
        expect(persistence.saveStateNow).not.toHaveBeenCalled();
    });
});

describe('StatePersistence cleanup', () => {
    function makePersistence() {
        const appState = state.create();
        appState.settings.startupOptions = {};
        appState.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        const storage = {
            get: jest.fn(),
            set: jest.fn(() => Promise.resolve()),
        };
        return {
            appState,
            storage,
            persistence: new StatePersistence('test-key', appState, storage),
        };
    }

    test('clears stored state, and resets live state only when forgetting', async() => {
        let ctx = makePersistence();

        await ctx.persistence.clearStoredState();

        expect(ctx.appState.networks).toHaveLength(1);
        expect(ctx.storage.set).toHaveBeenCalledWith('test-key', null);

        ctx = makePersistence();

        await ctx.persistence.forgetState();

        expect(ctx.appState.networks).toHaveLength(0);
        expect(ctx.storage.set).toHaveBeenCalledWith('test-key', null);
    });
});

describe('Profile settings', () => {
    let s;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
        const network = s.addNetwork('ProfileNet', 'ProfileNick', {
            server: 'irc.example.com',
        });
        network.password = 'sasl-secret';
        network.connection.password = 'server-secret';
        network.connection.account = 'ProfileAccount';
        s.persistence = {
            saveStateNow: jest.fn(async() => ({
                secretsSaved: true,
                stateSaved: true,
            })),
        };
        Vue.prototype.$state = s;
        window.kiwiDesktop = {
            profile: {
                export: jest.fn(async() => ({ saved: true })),
                import: jest.fn(),
                backup: jest.fn(async() => '/tmp/backup'),
                openFolder: jest.fn(),
            },
        };
        window.confirm = jest.fn(() => true);
        MetadataCache.flush.mockResolvedValue();
    });

    afterEach(() => {
        destroyMount();
        delete Vue.prototype.$state;
        delete window.kiwiDesktop;
        delete window.confirm;
    });

    function destroyMount() {
        if (!vm) {
            return;
        }
        vm.$destroy();
        if (vm.$el.parentNode) {
            vm.$el.parentNode.removeChild(vm.$el);
        }
        vm = null;
    }

    function mount() {
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(ProfileSettings),
        });
        return vm.$children[0];
    }

    it('hides import outside Personal mode and shows it in Personal mode', async() => {
        s.settings.startupScreen = 'customServer';
        let comp = mount();

        expect(comp.$el.querySelector('.kiwi-profile-export')).not.toBeNull();
        expect(comp.$el.querySelector('.kiwi-profile-import')).toBeNull();

        await comp.chooseImport();

        expect(window.kiwiDesktop.profile.import).not.toHaveBeenCalled();
        expect(comp.statusMessage).toBe('profile_import_personal_only');

        destroyMount();

        s.settings.startupScreen = 'personal';
        comp = mount();
        await Vue.nextTick();

        expect(comp.$el.querySelector('.kiwi-profile-import')).not.toBeNull();
    });

    it('exports without passwords by default and with secrets when requested', async() => {
        let comp = mount();

        await comp.exportProfile();

        let text = window.kiwiDesktop.profile.export.mock.calls[0][0];
        let bundle = JSON.parse(text);
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toBeUndefined();
        expect(s.persistence.saveStateNow).toHaveBeenCalled();

        destroyMount();

        comp = mount();
        comp.includePasswords = true;

        await comp.exportProfile();

        text = window.kiwiDesktop.profile.export.mock.calls[1][0];
        bundle = JSON.parse(text);
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
        expect(window.confirm).toHaveBeenCalled();
    });
});
