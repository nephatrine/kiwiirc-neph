import {
    base64UrlEncode,
    base64UrlDecode,
    vapidKeyToUint8Array,
    toVapidBytes,
    subscriptionMatchesVapidKey,
    subscriptionToTagString,
    serviceWorkerScope,
    parseServiceWorkerScope,
    notificationTag,
    waitForActiveWorker,
    ensureServiceWorker,
    defaultBrowserSubscriptionProvider,
    unsubscribeBrowserSubscription,
    unsubscribeStateBrowserSubscriptions,
    cleanupOrphanedRegistrations,
    cleanupLegacyRegistrations
} from '@/libs/WebpushUtils';

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

function setServiceWorker(value) {
    Object.defineProperty(navigator, 'serviceWorker', {
        value,
        configurable: true,
    });
}

function makeSubscription({
    endpoint = 'https://push.example.org/abc',
    keyBytes = new Uint8Array([1, 2, 3]),
    p256dh = new Uint8Array([4, 5, 6]),
    auth = new Uint8Array([7, 8]),
} = {}) {
    return {
        endpoint,
        options: {
            applicationServerKey: keyBytes,
        },
        getKey: (name) => {
            if (name === 'p256dh') {
                return p256dh;
            }
            if (name === 'auth') {
                return auth;
            }
            return null;
        },
        unsubscribe: jest.fn(async() => true),
    };
}

function makeRegistration(subscription, {
    scope = '/static/webpush/kiwi-state/1/',
    subscribeResult = subscription,
    active = { state: 'activated' },
} = {}) {
    return {
        scope,
        active,
        pushManager: {
            getSubscription: jest.fn(async() => subscription),
            subscribe: jest.fn(async() => subscribeResult),
        },
        unregister: jest.fn(async() => true),
    };
}

afterEach(() => {
    if (originalServiceWorker) {
        Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
        delete navigator.serviceWorker;
    }
});

describe('webpush encoding helpers', () => {
    it('encodes bytes to unpadded url-safe base64 and round-trips', () => {
        expect(base64UrlEncode(new Uint8Array([255, 239]))).toBe('_-8');
        expect(base64UrlEncode(new Uint8Array([104, 105]))).toBe('aGk');

        const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 65, 66, 67]);
        const decoded = base64UrlDecode(base64UrlEncode(bytes));
        expect(Array.from(decoded)).toEqual(Array.from(bytes));
    });

    it('decodes and normalises VAPID key bytes', () => {
        const raw = new Uint8Array(65);
        for (let i = 0; i < raw.length; i++) {
            raw[i] = i;
        }
        const encoded = base64UrlEncode(raw);
        const decoded = vapidKeyToUint8Array(encoded);
        expect(decoded.length).toBe(65);
        expect(Array.from(decoded)).toEqual(Array.from(raw));
        expect(() => vapidKeyToUint8Array('')).toThrow('missing-vapid-key');
        expect(() => vapidKeyToUint8Array(null)).toThrow('missing-vapid-key');

        expect(Array.from(toVapidBytes(new Uint8Array([1, 2, 3])))).toEqual([1, 2, 3]);
        expect(Array.from(toVapidBytes(new Uint8Array([1, 2, 3]).buffer))).toEqual([1, 2, 3]);
        expect(Array.from(toVapidBytes('AQID'))).toEqual([1, 2, 3]);
        expect(toVapidBytes(null)).toBeNull();
    });

    it('compares a subscription key with the network VAPID key', () => {
        const key = new Uint8Array([1, 2, 3]);
        const subscription = makeSubscription({ keyBytes: key });
        expect(subscriptionMatchesVapidKey(subscription, base64UrlEncode(key))).toBe(true);
        expect(subscriptionMatchesVapidKey(
            subscription,
            base64UrlEncode(new Uint8Array([3, 2, 1]))
        )).toBe(false);
        expect(subscriptionMatchesVapidKey(
            makeSubscription({ keyBytes: null }),
            base64UrlEncode(key)
        )).toBe(false);
    });

    it('formats subscription keys in message-tag format', () => {
        const subscription = makeSubscription();
        expect(subscriptionToTagString(subscription)).toBe('p256dh=BAUG;auth=Bwg');
        expect(() => subscriptionToTagString({ getKey: () => null })).toThrow(
            'missing-subscription-keys'
        );
    });
});

describe('webpush scopes and tags', () => {
    it('builds and parses scopes and notification tags', () => {
        expect(serviceWorkerScope('kiwi-state', 42)).toBe(
            'static/webpush/kiwi-state/42/'
        );

        expect(parseServiceWorkerScope(
            'https://example.com/kiwi/static/webpush/kiwi-state/42/'
        )).toEqual({
            stateKey: 'kiwi-state',
            networkId: '42',
        });
        expect(parseServiceWorkerScope(
            'https://example.com/static/webpush/webpush/42/'
        )).toEqual({
            stateKey: 'webpush',
            networkId: '42',
        });
        expect(parseServiceWorkerScope('https://example.com/')).toBeNull();

        expect(notificationTag('kiwi-state', 42, 'abc')).toBe(
            'kiwi-webpush:kiwi-state:42:abc'
        );
        expect(notificationTag('kiwi-state', 42, '')).toBe('');
    });
});

describe('webpush browser helpers', () => {
    it('refuses to provide a subscription without a service worker', async() => {
        setServiceWorker(undefined);
        await expect(ensureServiceWorker()).rejects.toThrow('no-service-worker');
    });

    it('resolves immediately when the worker is already active', async() => {
        const registration = makeRegistration(makeSubscription());
        await expect(waitForActiveWorker(registration)).resolves.toBe(registration);
    });

    it('waits for an installing worker to activate', async() => {
        const registration = makeRegistration(makeSubscription(), { active: null });
        registration.installing = { state: 'installing' };
        const promise = waitForActiveWorker(registration, 200);
        setTimeout(() => {
            registration.active = { state: 'activated' };
        }, 10);
        await expect(promise).resolves.toBe(registration);
    });

    it('rejects a redundant worker', async() => {
        const registration = makeRegistration(makeSubscription(), { active: null });
        registration.installing = { state: 'redundant' };
        await expect(waitForActiveWorker(registration, 100)).rejects.toMatchObject({
            code: 'service-worker-redundant',
        });
    });

    it('rejects when the worker never activates', async() => {
        const registration = makeRegistration(makeSubscription(), { active: null });
        registration.installing = { state: 'installing' };
        await expect(waitForActiveWorker(registration, 10)).rejects.toMatchObject({
            code: 'service-worker-timeout',
        });
    });

    it('asks a waiting worker to skip waiting', async() => {
        const registration = makeRegistration(makeSubscription(), { active: null });
        registration.waiting = {
            state: 'installed',
            postMessage: jest.fn(),
        };
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        const promise = ensureServiceWorker({
            stateKey: 'kiwi-state',
            networkId: 1,
        });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(registration.waiting.postMessage).toHaveBeenCalledWith({
            type: 'SKIP_WAITING',
        });
        registration.active = { state: 'activated' };
        await expect(promise).resolves.toBe(registration);
    });

    it('updates and activates a waiting worker beside an active one', async() => {
        const registration = makeRegistration(makeSubscription());
        registration.update = jest.fn(async() => {});
        registration.waiting = {
            state: 'installed',
            postMessage: jest.fn(),
        };
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        await ensureServiceWorker({
            stateKey: 'kiwi-state',
            networkId: 1,
        });

        expect(registration.update).toHaveBeenCalledTimes(1);
        expect(registration.waiting.postMessage).toHaveBeenCalledWith({
            type: 'SKIP_WAITING',
        });
    });

    it('retries subscribe once when the worker is not active yet', async() => {
        const key = new Uint8Array([1, 2, 3]);
        const subscription = makeSubscription({ keyBytes: key });
        const registration = makeRegistration(null, {
            subscribeResult: subscription,
        });
        registration.pushManager.subscribe
            .mockRejectedValueOnce(
                new Error('Subscription failed - no active Service Worker')
            )
            .mockResolvedValueOnce(subscription);
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        const result = await defaultBrowserSubscriptionProvider({
            stateKey: 'kiwi-state',
            networkId: 1,
            vapidPublicKey: base64UrlEncode(key),
        });

        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(2);
        expect(result.endpoint).toBe(subscription.endpoint);
    });

    it('reuses a matching subscription', async() => {
        const key = new Uint8Array([1, 2, 3]);
        const subscription = makeSubscription({ keyBytes: key });
        const registration = makeRegistration(subscription);
        const serviceWorker = {
            register: jest.fn(async() => registration),
        };
        setServiceWorker(serviceWorker);

        const result = await defaultBrowserSubscriptionProvider({
            stateKey: 'kiwi-state',
            networkId: 1,
            vapidPublicKey: base64UrlEncode(key),
        });

        expect(serviceWorker.register).toHaveBeenCalledWith('static/sw.js', {
            scope: 'static/webpush/kiwi-state/1/',
            updateViaCache: 'none',
        });
        expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
        expect(result.endpoint).toBe(subscription.endpoint);
        expect(result.keys).toBe('p256dh=BAUG;auth=Bwg');
    });

    it('recreates a subscription when the VAPID key changes', async() => {
        const oldKey = new Uint8Array([1, 2, 3]);
        const newKey = new Uint8Array([9, 8, 7]);
        const oldSubscription = makeSubscription({ keyBytes: oldKey });
        const newSubscription = makeSubscription({
            keyBytes: newKey,
            endpoint: 'https://push.example.org/new',
        });
        const registration = makeRegistration(oldSubscription, {
            subscribeResult: newSubscription,
        });
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        const result = await defaultBrowserSubscriptionProvider({
            stateKey: 'kiwi-state',
            networkId: 1,
            vapidPublicKey: base64UrlEncode(newKey),
        });

        expect(oldSubscription.unsubscribe).toHaveBeenCalled();
        expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: newKey,
        });
        expect(result.endpoint).toBe('https://push.example.org/new');
    });

    it('creates a subscription when none exists', async() => {
        const key = new Uint8Array([1, 2, 3]);
        const newSubscription = makeSubscription({ keyBytes: key });
        const registration = makeRegistration(null, {
            subscribeResult: newSubscription,
        });
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        await defaultBrowserSubscriptionProvider({
            stateKey: 'kiwi-state',
            networkId: 1,
            vapidPublicKey: base64UrlEncode(key),
        });

        expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: key,
        });
    });

    it('reuses a subscription created by a concurrent subscriber', async() => {
        const key = new Uint8Array([1, 2, 3]);
        const subscription = makeSubscription({ keyBytes: key });
        const registration = makeRegistration(null, {
            subscribeResult: subscription,
        });
        registration.pushManager.getSubscription
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(subscription);
        registration.pushManager.subscribe.mockRejectedValueOnce(
            new Error('concurrent subscribe')
        );
        setServiceWorker({
            register: jest.fn(async() => registration),
        });

        const result = await defaultBrowserSubscriptionProvider({
            stateKey: 'kiwi-state',
            networkId: 1,
            vapidPublicKey: base64UrlEncode(key),
        });

        expect(result.endpoint).toBe(subscription.endpoint);
    });

    it('unsubscribes a network registration', async() => {
        const subscription = makeSubscription();
        const registration = makeRegistration(subscription);
        const serviceWorker = {
            getRegistration: jest.fn(async() => registration),
        };
        setServiceWorker(serviceWorker);

        const result = await unsubscribeBrowserSubscription({
            stateKey: 'kiwi-state',
            networkId: 1,
            unregister: true,
        });

        expect(serviceWorker.getRegistration).toHaveBeenCalledWith(
            'static/webpush/kiwi-state/1/'
        );
        expect(subscription.unsubscribe).toHaveBeenCalled();
        expect(registration.unregister).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it('returns false when there is no network registration', async() => {
        setServiceWorker({
            getRegistration: jest.fn(async() => null),
        });
        const result = await unsubscribeBrowserSubscription({
            stateKey: 'kiwi-state',
            networkId: 1,
        });
        expect(result).toBe(false);
    });

    it('removes every registration for a state key', async() => {
        const first = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/kiwi-state/1/',
        });
        const second = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/kiwi-state/2/',
        });
        const other = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/other-state/1/',
        });
        setServiceWorker({
            getRegistrations: jest.fn(async() => [first, second, other]),
        });

        await unsubscribeStateBrowserSubscriptions('kiwi-state');

        expect(first.unregister).toHaveBeenCalled();
        expect(second.unregister).toHaveBeenCalled();
        expect(other.unregister).not.toHaveBeenCalled();
    });

    it('removes only orphaned registrations', async() => {
        const active = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/kiwi-state/1/',
        });
        const orphan = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/kiwi-state/2/',
        });
        setServiceWorker({
            getRegistrations: jest.fn(async() => [active, orphan]),
        });

        await cleanupOrphanedRegistrations('kiwi-state', [1]);

        expect(active.unregister).not.toHaveBeenCalled();
        expect(orphan.unregister).toHaveBeenCalled();
    });

    it('removes the legacy shared /static/ registration', async() => {
        const legacy = makeRegistration(makeSubscription(), {
            scope: '/static/',
        });
        legacy.active = { scriptURL: 'https://example.com/static/sw.js' };
        const current = makeRegistration(makeSubscription(), {
            scope: '/static/webpush/kiwi-state/1/',
        });
        current.active = { scriptURL: 'https://example.com/static/sw.js' };
        setServiceWorker({
            getRegistrations: jest.fn(async() => [legacy, current]),
        });

        await cleanupLegacyRegistrations();

        expect(legacy.unregister).toHaveBeenCalled();
        expect(current.unregister).not.toHaveBeenCalled();
    });
});
