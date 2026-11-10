import state from '@/libs/state';
import StatePersistence from '@/libs/StatePersistence';

jest.mock('@/libs/WebpushUtils', () => ({
    ...jest.requireActual('@/libs/WebpushUtils'),
    unsubscribeStateBrowserSubscriptions: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/libs/MetadataCache', () => ({
    ...jest.requireActual('@/libs/MetadataCache'),
    clear: jest.fn(() => Promise.resolve()),
}));

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

describe('Desktop password persistence', () => {
    it('writes sanitized state and stores both password kinds separately', async() => {
        const { persistence, secretStore, storage } = makePersistence();

        const result = await persistence.saveStateNow();

        expect(result.secretsSaved).toBe(true);
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        expect(secretStore.save).toHaveBeenCalledWith('test-key', {
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
    });

    it('restores passwords after importing the sanitized state', async() => {
        const { persistence, storage } = makePersistence();
        await persistence.saveStateNow();
        const storedState = storage.set.mock.calls[0][1];

        const restored = state.create();
        restored.settings.startupOptions = {};
        const restoredStorage = {
            get: jest.fn(async() => storedState),
            set: jest.fn(async() => {}),
        };
        const restoredSecrets = makeSecretStore();
        restoredSecrets.load.mockResolvedValue({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
        const restoredPersistence = new StatePersistence(
            'test-key',
            restored,
            restoredStorage,
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

    it('omits passwords for a network with rememberPassword disabled', async() => {
        const { network, persistence, secretStore, storage } = makePersistence();
        network.setting('rememberPassword', false);

        await persistence.saveStateNow();

        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        expect(secretStore.clear).toHaveBeenCalledWith('test-key');
        expect(secretStore.save).not.toHaveBeenCalled();
    });

    it('clears remembered passwords when the global include flag is off', async() => {
        const { persistence, secretStore, storage } = makePersistence({
            includePasswords: false,
        });

        await persistence.saveStateNow();

        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(secretStore.clear).toHaveBeenCalledWith('test-key');
        expect(storage.set).toHaveBeenCalled();
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

    it('clears stored secrets when the profile is cleared', async() => {
        const { persistence, secretStore } = makePersistence();

        await persistence.clearStoredState();

        expect(secretStore.clear).toHaveBeenCalledWith('test-key');
    });
});
