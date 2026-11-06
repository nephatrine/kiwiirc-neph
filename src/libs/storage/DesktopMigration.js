const METADATA_KEY = 'kiwi-metadata-cache';

export async function migrateLegacyProfile({
    storage,
    persistence,
    state,
    storageKey,
    localStorageImpl,
    logger,
}) {
    if (!storageKey || !storage || !persistence || !state || !localStorageImpl) {
        return;
    }

    const existingState = await storage.get(storageKey);
    if (!existingState) {
        const legacyState = localStorageImpl.getItem(storageKey);
        if (legacyState) {
            try {
                state.importState(legacyState);
                const result = await persistence.saveStateNow();
                if (result && result.secretsSaved === false) {
                    throw new Error('password migration failed');
                }
                localStorageImpl.removeItem(storageKey);
            } catch (err) {
                await storage.set(storageKey, null).catch(() => {});
                if (logger) {
                    logger('Failed to migrate legacy state', err);
                }
                throw err;
            }
        }
    }

    const existingMetadata = await storage.get(METADATA_KEY);
    if (!existingMetadata) {
        const legacyMetadata = localStorageImpl.getItem(METADATA_KEY);
        if (legacyMetadata) {
            try {
                await storage.set(METADATA_KEY, legacyMetadata);
                localStorageImpl.removeItem(METADATA_KEY);
            } catch (err) {
                if (logger) {
                    logger('Failed to migrate legacy metadata cache', err);
                }
            }
        }
    }
}
