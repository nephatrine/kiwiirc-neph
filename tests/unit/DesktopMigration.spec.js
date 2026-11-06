import { migrateLegacyProfile } from '@/libs/storage/DesktopMigration';

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

describe('Legacy desktop profile migration', () => {
    it('migrates state and metadata, then removes the local copies', async() => {
        const storage = makeStorage();
        const localStorageImpl = makeLocalStorage({
            'kiwi-state': '{"networks":[]}',
            'kiwi-metadata-cache': '{"networks":{}}',
        });
        const state = { importState: jest.fn() };
        const persistence = {
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
            state,
            storageKey: 'kiwi-state',
            localStorageImpl,
        });

        expect(state.importState).toHaveBeenCalledWith('{"networks":[]}');
        expect(storage.set).toHaveBeenCalledWith('kiwi-state', '{"networks":[]}');
        expect(storage.set).toHaveBeenCalledWith(
            'kiwi-metadata-cache',
            '{"networks":{}}'
        );
        expect(localStorageImpl.values.has('kiwi-state')).toBe(false);
        expect(localStorageImpl.values.has('kiwi-metadata-cache')).toBe(false);
    });

    it('keeps the local state when password migration fails', async() => {
        const storage = makeStorage();
        const localStorageImpl = makeLocalStorage({
            'kiwi-state': '{"networks":[]}',
        });
        const state = { importState: jest.fn() };
        const persistence = {
            saveStateNow: jest.fn(async() => ({
                secretsSaved: false,
                stateSaved: true,
            })),
        };

        await expect(migrateLegacyProfile({
            storage,
            persistence,
            state,
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
        const state = { importState: jest.fn() };
        const persistence = { saveStateNow: jest.fn() };

        await migrateLegacyProfile({
            storage,
            persistence,
            state,
            storageKey: 'kiwi-state',
            localStorageImpl,
        });

        expect(state.importState).not.toHaveBeenCalled();
        expect(persistence.saveStateNow).not.toHaveBeenCalled();
    });
});
