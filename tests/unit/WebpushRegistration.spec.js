import state from '@/libs/state';
import webpushMiddleware from '@/libs/WebpushMiddleware';
import AppSettings from '@/components/AppSettings.vue';

jest.mock('@/helpers/TextFormatting', () => ({
    ...jest.requireActual('@/helpers/TextFormatting'),
    t: (key) => key,
}));

const ENDPOINT = 'https://push.example.org/abc123';
const KEYS = 'p256dh=AAAA;auth=BBBB';

function makeHarness({ enabled = true, provider } = {}) {
    const s = state.create();
    s.setting('webpushEnabled', enabled);
    const network = s.addNetwork('TestNetwork', 'TestNick', {});
    network.enabled_caps = ['draft/webpush'];
    network.sasl_account = 'TestAccount';
    network.isupport.VAPID = 'test-vapid-key';
    window.Notification = { permission: 'granted' };
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
    const stubProvider = provider || jest.fn(async() => ({
        endpoint: ENDPOINT,
        keys: KEYS,
    }));
    const useMiddleware = webpushMiddleware(network, { subscriptionProvider: stubProvider });
    useMiddleware(client, rawEvents, parsedEvents);
    return {
        s,
        network,
        client,
        stubProvider,
        emitConnecting() {
            (handlers.connecting || []).forEach((fn) => fn());
        },
        async emitConnected() {
            await Promise.all((handlers.connected || []).map((fn) => fn()));
        },
        emitWebpush(params) {
            parsed('unknown command', {
                command: 'WEBPUSH',
                params,
                tags: {},
            }, client, () => {});
        },
        emitPersistence(params) {
            parsed('unknown command', {
                command: 'PERSISTENCE',
                params,
                tags: {},
            }, client, () => {});
        },
        emitFail(params) {
            const next = jest.fn();
            parsed('unknown command', {
                command: 'FAIL',
                params,
                tags: {},
            }, client, next);
            return next;
        },
        registers() {
            return client.raw.mock.calls.filter((call) => (
                call[0] === 'WEBPUSH' && call[1] === 'REGISTER'
            ));
        },
        unregisters() {
            return client.raw.mock.calls.filter((call) => (
                call[0] === 'WEBPUSH' && call[1] === 'UNREGISTER'
            ));
        },
    };
}

afterEach(() => {
    delete window.Notification;
});

describe('webpush registration', () => {
    it('starts unregistered and REGISTERs on connect when eligible', async() => {
        const h = makeHarness();
        expect(h.network.webpush_registered).toBe(false);
        await h.emitConnected();
        expect(h.stubProvider).toHaveBeenCalledWith('test-vapid-key');
        expect(h.registers()).toEqual([['WEBPUSH', 'REGISTER', ENDPOINT, KEYS]]);
    });

    it('reads VAPID from ISUPPORT, never from cap values', async() => {
        const h = makeHarness();
        // Real-world shape: VAPID arrives as a 005 token, so cap_values
        // stays empty. webpushAvailable must still pass on ISUPPORT alone.
        expect(h.network.cap_values.vapid).toBeUndefined();
        expect(h.network.webpushAvailable()).toBe(true);
        await h.emitConnected();
        expect(h.stubProvider).toHaveBeenCalledWith('test-vapid-key');
        expect(h.registers()).toHaveLength(1);
    });

    describe('persistence gating', () => {
        function persistentHarness(clientSetting, effective) {
            const h = makeHarness();
            h.network.enabled_caps = ['draft/webpush', 'draft/persistence'];
            h.network.persistence_status = { client: clientSetting, effective };
            return h;
        }

        it('hides when the server reports OFF', () => {
            const h = persistentHarness('OFF', 'OFF');
            expect(h.network.webpushAvailable()).toBe(false);
        });

        it('hides on DEFAULT when the server reports OFF', () => {
            const h = persistentHarness('DEFAULT', 'OFF');
            expect(h.network.webpushAvailable()).toBe(false);
        });

        it('shows when the server reports ON', () => {
            const h = persistentHarness('ON', 'ON');
            expect(h.network.webpushAvailable()).toBe(true);
        });

        it('shows without a persistence cap (servers like soju)', () => {
            const h = makeHarness();
            expect(h.network.hasCap('draft/persistence')).toBe(false);
            expect(h.network.webpushAvailable()).toBe(true);
        });
    });

    describe('desktop gating', () => {
        it('hides when desktop notifications are disabled', () => {
            const h = makeHarness();
            h.s.setting('buffers.show_notifications', false);
            expect(h.network.webpushAvailable()).toBe(false);
        });

        it('disabling desktop notifications unregisters push', async() => {
            const h = makeHarness();
            await h.emitConnected();
            expect(h.registers()).toHaveLength(1);
            h.emitWebpush(['REGISTER', ENDPOINT]);
            expect(h.network.webpush_registered).toBe(true);
            const ctx = {
                settingBufferShowNotifications: false,
                get settingWebpushEnabled() {
                    return h.s.setting('webpushEnabled');
                },
                set settingWebpushEnabled(value) {
                    h.s.setting('webpushEnabled', value);
                },
                $state: {
                    getActiveNetwork: () => h.network,
                },
            };
            AppSettings.methods.applyDesktopNotifications.call(ctx);
            expect(h.s.setting('webpushEnabled')).toBe(false);
            expect(h.unregisters()).toHaveLength(1);
            expect(h.network.webpush_registered).toBe(false);
        });
    });

    it('sends nothing when the setting is off', async() => {
        const h = makeHarness({ enabled: false });
        await h.emitConnected();
        expect(h.stubProvider).not.toHaveBeenCalled();
        expect(h.registers()).toHaveLength(0);
    });

    it('sends nothing without the capability, account, VAPID, or permission', async() => {
        const noCap = makeHarness();
        noCap.network.enabled_caps = [];
        await noCap.emitConnected();
        expect(noCap.registers()).toHaveLength(0);

        const noAccount = makeHarness();
        noAccount.network.sasl_account = '';
        await noAccount.emitConnected();
        expect(noAccount.registers()).toHaveLength(0);

        const noVapid = makeHarness();
        delete noVapid.network.isupport.VAPID;
        await noVapid.emitConnected();
        expect(noVapid.registers()).toHaveLength(0);

        const noPermission = makeHarness();
        window.Notification.permission = 'denied';
        await noPermission.emitConnected();
        expect(noPermission.registers()).toHaveLength(0);
    });

    it('does not retry when the provider fails', async() => {
        const h = makeHarness({
            provider: jest.fn(async() => {
                throw new Error('denied');
            }),
        });
        await h.emitConnected();
        expect(h.registers()).toHaveLength(0);
        expect(h.network.webpush_registered).toBe(false);
    });

    it('marks registered on the REGISTER echo and re-registers on reconnect', async() => {
        const h = makeHarness();
        await h.emitConnected();
        h.emitWebpush(['REGISTER', ENDPOINT]);
        expect(h.network.webpush_registered).toBe(true);
        h.emitConnecting();
        expect(h.network.webpush_registered).toBe(false);
        await h.emitConnected();
        expect(h.registers()).toHaveLength(2);
    });

    it('clears registration on the UNREGISTER echo', async() => {
        const h = makeHarness();
        await h.emitConnected();
        h.emitWebpush(['REGISTER', ENDPOINT]);
        expect(h.network.webpush_registered).toBe(true);
        h.emitWebpush(['UNREGISTER', ENDPOINT]);
        expect(h.network.webpush_registered).toBe(false);
    });

    it('clears registration on FAIL but lets it surface', async() => {
        const h = makeHarness();
        await h.emitConnected();
        h.emitWebpush(['REGISTER', ENDPOINT]);
        expect(h.network.webpush_registered).toBe(true);
        const next = h.emitFail(['WEBPUSH', 'INVALID_PARAMS', 'REGISTER', ENDPOINT]);
        expect(h.network.webpush_registered).toBe(false);
        expect(next).toHaveBeenCalled();
    });

    it('UNREGISTERs immediately when toggled off after registering', async() => {
        const h = makeHarness();
        await h.emitConnected();
        h.emitWebpush(['REGISTER', ENDPOINT]);
        h.s.setting('webpushEnabled', false);
        h.network.setWebpushEnabled();
        expect(h.unregisters()).toEqual([['WEBPUSH', 'UNREGISTER', ENDPOINT]]);
        expect(h.network.webpush_registered).toBe(false);
    });

    it('requests permission on toggle when undecided, then registers on grant', async() => {
        const h = makeHarness();
        window.Notification.permission = 'default';
        window.Notification.requestPermission = jest.fn(() => {
            window.Notification.permission = 'granted';
            return Promise.resolve('granted');
        });
        h.network.setWebpushEnabled();
        expect(window.Notification.requestPermission).toHaveBeenCalled();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(h.registers()).toEqual([['WEBPUSH', 'REGISTER', ENDPOINT, KEYS]]);
    });

    it('supports the callback form of requestPermission', async() => {
        const h = makeHarness();
        window.Notification.permission = 'default';
        window.Notification.requestPermission = jest.fn((cb) => {
            window.Notification.permission = 'granted';
            const outcome = 'granted';
            cb(outcome);
        });
        h.network.setWebpushEnabled();
        expect(window.Notification.requestPermission).toHaveBeenCalled();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(h.registers()).toEqual([['WEBPUSH', 'REGISTER', ENDPOINT, KEYS]]);
    });

    it('never prompts when denied, posts an error, and sends nothing', async() => {
        const h = makeHarness();
        window.Notification.permission = 'denied';
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('granted'));
        h.network.setWebpushEnabled();
        expect(window.Notification.requestPermission).not.toHaveBeenCalled();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(h.registers()).toHaveLength(0);
        const errors = h.network.serverBuffer().getMessages().filter((m) => m.type === 'error');
        expect(errors.length).toBeGreaterThan(0);
    });

    describe('persistence loss', () => {
        it('UNREGISTERs and switches the setting off when STATUS goes OFF', async() => {
            const h = makeHarness();
            await h.emitConnected();
            h.emitWebpush(['REGISTER', ENDPOINT]);
            expect(h.network.webpush_registered).toBe(true);
            h.emitPersistence(['STATUS', 'ON', 'OFF']);
            expect(h.unregisters()).toEqual([['WEBPUSH', 'UNREGISTER', ENDPOINT]]);
            expect(h.network.webpush_registered).toBe(false);
            expect(h.network.webpush_endpoint).toBe('');
            expect(h.s.setting('webpushEnabled')).toBe(false);
        });

        it('sends nothing further on repeated OFF STATUS', async() => {
            const h = makeHarness();
            await h.emitConnected();
            h.emitWebpush(['REGISTER', ENDPOINT]);
            h.emitPersistence(['STATUS', 'ON', 'OFF']);
            expect(h.unregisters()).toHaveLength(1);
            h.emitPersistence(['STATUS', 'ON', 'OFF']);
            expect(h.unregisters()).toHaveLength(1);
            expect(h.s.setting('webpushEnabled')).toBe(false);
        });

        it('flips the setting silently when never registered', () => {
            const h = makeHarness();
            expect(h.s.setting('webpushEnabled')).toBe(true);
            h.emitPersistence(['STATUS', 'DEFAULT', 'OFF']);
            expect(h.unregisters()).toHaveLength(0);
            expect(h.s.setting('webpushEnabled')).toBe(false);
        });

        it('leaves everything alone when STATUS stays ON', async() => {
            const h = makeHarness();
            await h.emitConnected();
            h.emitWebpush(['REGISTER', ENDPOINT]);
            h.emitPersistence(['STATUS', 'ON', 'ON']);
            expect(h.unregisters()).toHaveLength(0);
            expect(h.network.webpush_registered).toBe(true);
            expect(h.s.setting('webpushEnabled')).toBe(true);
        });
    });
});
