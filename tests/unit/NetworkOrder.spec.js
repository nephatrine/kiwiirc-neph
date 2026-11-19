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
    it('moves networks up and down and rejects out-of-range moves', () => {
        let {
            s, first, second, third,
        } = makeNetworks();
        s.setActiveBuffer(third.id, '*');

        expect(s.moveNetworkUp(third.id)).toBe(true);

        expect(s.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);
        expect(s.ui.active_network).toBe(third.id);
        expect(s.moveNetworkUp(first.id)).toBe(false);

        ({ s, first, second, third } = makeNetworks());

        expect(s.moveNetwork(first.id, 1)).toBe(true);
        expect(s.networks.map((network) => network.name)).toEqual([
            'Second',
            'First',
            'Third',
        ]);
        expect(s.moveNetwork(third.id, 1)).toBe(false);
        expect(s.moveNetwork(second.id, -1)).toBe(false);
    });

    it('persists the reordered list directly and through the watcher', async() => {
        let { s, third } = makeNetworks();
        s.moveNetworkUp(third.id);
        let storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        let persistence = new StatePersistence('test-key', s, storage);

        await persistence.saveStateNow();

        let saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);

        jest.useFakeTimers();
        ({ s, third } = makeNetworks());
        storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        persistence = new StatePersistence('test-key', s, storage);
        persistence.watchStateForChanges();

        s.moveNetworkUp(third.id);
        await Vue.nextTick();
        jest.advanceTimersByTime(1000);

        expect(storage.set).toHaveBeenCalledTimes(1);
        saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);

        persistence.stopWatchingState();
        jest.useRealTimers();
    });
});
