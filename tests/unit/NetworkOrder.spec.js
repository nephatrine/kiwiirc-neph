import Vue from 'vue';
import state from '@/libs/state';
import StatePersistence from '@/libs/StatePersistence';

function makeNetworks() {
    const s = state.create();
    s.settings.startupOptions = {};
    const first = s.addNetwork('First', 'FirstNick', {});
    const second = s.addNetwork('Second', 'SecondNick', {});
    const third = s.addNetwork('Third', 'ThirdNick', {});
    return { s, first, second, third };
}

describe('Network ordering', () => {
    it('moves a network up without changing its active buffer', () => {
        const { s, first, third } = makeNetworks();
        s.setActiveBuffer(third.id, '*');

        expect(s.moveNetworkUp(third.id)).toBe(true);

        expect(s.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);
        expect(s.ui.active_network).toBe(third.id);
        expect(s.moveNetworkUp(first.id)).toBe(false);
    });

    it('supports moving down and rejects out-of-range moves', () => {
        const { s, first, second, third } = makeNetworks();

        expect(s.moveNetwork(first.id, 1)).toBe(true);
        expect(s.networks.map((network) => network.name)).toEqual([
            'Second',
            'First',
            'Third',
        ]);
        expect(s.moveNetwork(third.id, 1)).toBe(false);
        expect(s.moveNetwork(second.id, -1)).toBe(false);
    });

    it('persists the reordered network list', async() => {
        const { s, third } = makeNetworks();
        s.moveNetworkUp(third.id);
        const storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        const persistence = new StatePersistence('test-key', s, storage);

        await persistence.saveStateNow();

        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);
    });

    it('saves a reordered network list when the state watcher runs', async() => {
        jest.useFakeTimers();
        const { s, third } = makeNetworks();
        const storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        const persistence = new StatePersistence('test-key', s, storage);
        persistence.watchStateForChanges();

        s.moveNetworkUp(third.id);
        await Vue.nextTick();
        jest.advanceTimersByTime(1000);

        expect(storage.set).toHaveBeenCalledTimes(1);
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);

        persistence.stopWatchingState();
        jest.useRealTimers();
    });
});
