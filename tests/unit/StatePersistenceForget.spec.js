jest.mock('@/libs/WebpushUtils', () => ({
    ...jest.requireActual('@/libs/WebpushUtils'),
    unsubscribeStateBrowserSubscriptions: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/libs/MetadataCache', () => ({
    ...jest.requireActual('@/libs/MetadataCache'),
    clear: jest.fn(() => Promise.resolve()),
}));

import state from '@/libs/state';
import StatePersistence from '@/libs/StatePersistence';

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

describe('StatePersistence cleanup', () => {
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
