import state from '@/libs/state';
import persistenceMiddleware from '@/libs/PersistenceMiddleware';

function makeHarness(preference) {
    const s = state.create();
    if (typeof preference !== 'undefined') {
        s.setting('persistencePreference', preference);
    }
    const network = s.addNetwork('TestNetwork', 'TestNick', {});
    const handlers = {};
    const client = {
        raw: jest.fn(),
        on: jest.fn((event, fn) => {
            handlers[event] = handlers[event] || [];
            handlers[event].push(fn);
        }),
    };
    const rawEvents = { use: jest.fn() };
    let parsed = null;
    const parsedEvents = {
        use: jest.fn((fn) => {
            parsed = fn;
        }),
    };
    persistenceMiddleware(network)(client, rawEvents, parsedEvents);
    return {
        s,
        network,
        client,
        emitConnecting() {
            (handlers.connecting || []).forEach((fn) => fn());
        },
        emitStatus(params) {
            parsed('unknown command', {
                command: 'PERSISTENCE',
                params,
                tags: {},
            }, client, () => {});
        },
        sets() {
            return client.raw.mock.calls.filter((call) => (
                call[0] === 'PERSISTENCE' && call[1] === 'SET'
            ));
        },
    };
}

describe('draft/persistence preference', () => {
    it('assumes non-persistent with empty client setting on a fresh network', () => {
        const { network } = makeHarness('on');
        expect(network.persistence_status).toEqual({ client: '', effective: 'OFF' });
        expect(network.persistenceCap()).toBe('');
    });

    it('adopts the server preference instead of sending a SET', () => {
        const h = makeHarness('on');
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.network.persistence_status).toEqual({ client: 'OFF', effective: 'OFF' });
        expect(h.sets()).toHaveLength(0);
        expect(h.s.setting('persistencePreference')).toBe('off');
    });

    it('adopts DEFAULT when the server reports it', () => {
        const h = makeHarness('on');
        h.emitStatus(['STATUS', 'DEFAULT', 'OFF']);
        expect(h.network.persistence_status.client).toBe('DEFAULT');
        expect(h.sets()).toHaveLength(0);
        expect(h.s.setting('persistencePreference')).toBe('default');
    });

    it('never overwrites keep-as-is with the server value', () => {
        const h = makeHarness('keep');
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.network.persistence_status.client).toBe('OFF');
        expect(h.sets()).toHaveLength(0);
        expect(h.s.setting('persistencePreference')).toBe('keep');
    });

    it('sends nothing on keep-as-is or when already converged', () => {
        const keep = makeHarness('keep');
        keep.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(keep.network.persistence_status.client).toBe('OFF');
        expect(keep.sets()).toHaveLength(0);

        const converged = makeHarness('on');
        converged.emitStatus(['STATUS', 'ON', 'ON']);
        expect(converged.sets()).toHaveLength(0);
    });

    it('accepts a leading nick in the STATUS params', () => {
        const h = makeHarness('on');
        h.emitStatus(['STATUS', 'TestNick', 'OFF', 'OFF']);
        expect(h.network.persistence_status).toEqual({ client: 'OFF', effective: 'OFF' });
        expect(h.sets()).toHaveLength(0);
        expect(h.s.setting('persistencePreference')).toBe('off');
    });

    it('ignores malformed STATUS lines', () => {
        const h = makeHarness('on');
        h.emitStatus(['STATUS', 'BOGUS']);
        h.emitStatus(['GET']);
        expect(h.network.persistence_status).toEqual({ client: '', effective: 'OFF' });
        expect(h.sets()).toHaveLength(0);
    });

    it('treats junk preference values as keep-as-is', () => {
        const h = makeHarness('sometimes');
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.network.persistence_status.client).toBe('OFF');
        expect(h.sets()).toHaveLength(0);
    });

    it('sends one SET per dropdown action and ignores a stale STATUS', () => {
        const h = makeHarness('keep');
        h.s.setting('persistencePreference', 'on');
        h.network.setPersistencePreference();
        expect(h.sets()).toEqual([['PERSISTENCE', 'SET', 'ON']]);

        // The server's next STATUS predates our SET: ignore it rather than
        // adopting the old value back over the user's choice.
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.s.setting('persistencePreference')).toBe('on');
        expect(h.sets()).toHaveLength(1);

        // A STATUS reporting the value we asked for is not a change either.
        h.emitStatus(['STATUS', 'ON', 'ON']);
        expect(h.s.setting('persistencePreference')).toBe('on');
        expect(h.sets()).toHaveLength(1);
    });

    it('resets the pending guard and status on a new connection', () => {
        const h = makeHarness('keep');
        h.s.setting('persistencePreference', 'on');
        h.network.setPersistencePreference();
        h.emitConnecting();
        expect(h.network.persistence_status).toEqual({ client: '', effective: 'OFF' });
        // With the guard cleared the next STATUS is adopted again.
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.s.setting('persistencePreference')).toBe('off');
        expect(h.sets()).toHaveLength(1);
    });

    it('applies dropdown changes immediately via setPersistencePreference', () => {
        const h = makeHarness('keep');
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.sets()).toHaveLength(0);
        h.s.setting('persistencePreference', 'on');
        h.network.setPersistencePreference();
        expect(h.sets()).toEqual([['PERSISTENCE', 'SET', 'ON']]);
    });

    it('gates the setting on account login plus the negotiated cap', () => {
        const h = makeHarness('on');
        expect(h.network.persistencePreferenceAvailable()).toBe(false);
        h.network.sasl_account = 'TestAccount';
        expect(h.network.persistencePreferenceAvailable()).toBe(false);
        h.network.enabled_caps = ['draft/persistence'];
        expect(h.network.persistencePreferenceAvailable()).toBe(true);
    });
});

describe('draft/persistence rejoin suppression', () => {
    it('runs parked channel joins when STATUS reports effectively OFF', () => {
        const h = makeHarness('keep');
        const joins = jest.fn();
        h.network.pending_channel_joins = joins;
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(joins).toHaveBeenCalledTimes(1);
        expect(h.network.pending_channel_joins).toBe(null);
        expect(h.network.pending_channel_joins_timer).toBe(null);
    });

    it('suppresses parked channel joins when STATUS reports effectively ON', () => {
        const h = makeHarness('keep');
        const joins = jest.fn();
        h.network.pending_channel_joins = joins;
        h.emitStatus(['STATUS', 'OFF', 'ON']);
        expect(joins).not.toHaveBeenCalled();
        expect(h.network.pending_channel_joins).toBe(null);
        expect(h.network.pending_channel_joins_timer).toBe(null);
    });

    it('clears the backstop timer when STATUS releases the hold', () => {
        const h = makeHarness('keep');
        const joins = jest.fn();
        const clearSpy = jest.spyOn(global, 'clearTimeout');
        // A truthy non-timer is enough: clearTimeout on it is a safe no-op.
        h.network.pending_channel_joins = joins;
        h.network.pending_channel_joins_timer = 123;
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(joins).toHaveBeenCalledTimes(1);
        expect(clearSpy).toHaveBeenCalledWith(123);
        expect(h.network.pending_channel_joins_timer).toBe(null);
        clearSpy.mockRestore();
    });

    it('drops parked joins on a new connection without joining', () => {
        const h = makeHarness('keep');
        const joins = jest.fn();
        h.network.pending_channel_joins = joins;
        h.network.pending_channel_joins_timer = 123;
        h.emitConnecting();
        expect(joins).not.toHaveBeenCalled();
        expect(h.network.pending_channel_joins).toBe(null);
        expect(h.network.pending_channel_joins_timer).toBe(null);
    });

    it('does nothing on STATUS with no parked joins', () => {
        const h = makeHarness('keep');
        h.emitStatus(['STATUS', 'OFF', 'OFF']);
        expect(h.network.pending_channel_joins).toBe(null);
    });
});
