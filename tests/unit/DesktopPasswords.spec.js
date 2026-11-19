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
