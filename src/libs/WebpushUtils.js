// Pure helpers for draft/webpush (and soju.im/webpush) subscriptions.
// No browser APIs are touched at module scope so this stays unit-testable;
// the browser-facing helpers below only touch APIs when called.

export function base64UrlEncode(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(base64Url) {
    let base64 = String(base64Url).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// The VAPID ISUPPORT token is a URL-safe base64 P-256 public key; the
// PushManager wants it as raw bytes for applicationServerKey.
export function vapidKeyToUint8Array(vapidPublicKey) {
    if (typeof vapidPublicKey !== 'string' || !vapidPublicKey) {
        throw new Error('missing-vapid-key');
    }
    return base64UrlDecode(vapidPublicKey);
}

// Normalise an ArrayBuffer / typed array / base64 string into raw bytes.
export function toVapidBytes(value) {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        return vapidKeyToUint8Array(value);
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return new Uint8Array(value);
}

export function subscriptionMatchesVapidKey(subscription, vapidPublicKey) {
    const current = subscription && subscription.options ?
        subscription.options.applicationServerKey :
        null;
    const currentBytes = toVapidBytes(current);
    if (!currentBytes) {
        return false;
    }

    let desiredBytes = null;
    try {
        desiredBytes = vapidKeyToUint8Array(vapidPublicKey);
    } catch {
        return false;
    }

    if (currentBytes.length !== desiredBytes.length) {
        return false;
    }

    for (let i = 0; i < desiredBytes.length; i++) {
        if (currentBytes[i] !== desiredBytes[i]) {
            return false;
        }
    }
    return true;
}

// The WEBPUSH REGISTER keys parameter is message-tag formatted.
export function subscriptionToTagString(subscription) {
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    if (!p256dh || !auth) {
        throw new Error('missing-subscription-keys');
    }
    return 'p256dh=' + base64UrlEncode(p256dh) + ';auth=' + base64UrlEncode(auth);
}

// One service worker registration (and therefore one push subscription) per
// network. The startup state key keeps separate saved states in the same
// origin from colliding.
export function serviceWorkerScope(stateKey, networkId) {
    return 'static/webpush/' + encodeURIComponent(String(stateKey)) + '/' +
        encodeURIComponent(String(networkId)) + '/';
}

export function parseServiceWorkerScope(scope) {
    if (!scope) {
        return null;
    }

    let url = null;
    try {
        const base = typeof window !== 'undefined' && window.location ?
            window.location.href :
            'https://kiwi.invalid/';
        url = new URL(scope, base);
    } catch {
        return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    let idx = -1;
    for (let i = 0; i < parts.length - 2; i++) {
        if (parts[i] === 'static' && parts[i + 1] === 'webpush') {
            idx = i + 1;
        }
    }
    if (idx === -1 || parts.length < idx + 3) {
        return null;
    }

    try {
        return {
            stateKey: decodeURIComponent(parts[idx + 1]),
            networkId: decodeURIComponent(parts[idx + 2]),
        };
    } catch {
        return null;
    }
}

export function notificationTag(stateKey, networkId, msgid) {
    if (!msgid) {
        return '';
    }
    return 'kiwi-webpush:' + String(stateKey) + ':' +
        String(networkId) + ':' + String(msgid);
}

export function waitForActiveWorker(registration, timeoutMs = 10000) {
    if (!registration) {
        const err = new Error('service-worker-missing');
        err.code = 'service-worker-missing';
        return Promise.reject(err);
    }
    if (registration.active) {
        return Promise.resolve(registration);
    }

    return new Promise((resolve, reject) => {
        const started = Date.now();
        let timer = null;

        const finish = (err) => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (err) {
                reject(err);
            } else {
                resolve(registration);
            }
        };

        const tick = () => {
            if (registration.active) {
                finish();
                return;
            }

            const worker = registration.installing || registration.waiting;
            if (worker && worker.state === 'redundant') {
                const err = new Error('service-worker-redundant');
                err.code = 'service-worker-redundant';
                finish(err);
                return;
            }

            if (Date.now() - started >= timeoutMs) {
                const err = new Error('service-worker-timeout');
                err.code = 'service-worker-timeout';
                finish(err);
                return;
            }

            timer = setTimeout(tick, 50);
        };

        tick();
    });
}

export async function ensureServiceWorker({ stateKey, networkId } = {}) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        throw new Error('no-service-worker');
    }
    // Relative so installs under a sub-path keep working; static/ is copied
    // verbatim to dist/static/ by the build.
    const registration = await navigator.serviceWorker.register('static/sw.js', {
        scope: serviceWorkerScope(stateKey, networkId),
        updateViaCache: 'none',
    });

    if (typeof registration.update === 'function') {
        try {
            await registration.update();
        } catch {
            // The normal registration/wait path still applies.
        }
    }

    if (registration.waiting) {
        try {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
            // The install handler also calls skipWaiting().
        }
    }

    return waitForActiveWorker(registration);
}

async function subscribeWithActiveWorker(registration, options) {
    try {
        return await registration.pushManager.subscribe(options);
    } catch (err) {
        if (!/no active Service Worker/i.test((err && err.message) || '')) {
            throw err;
        }
        await waitForActiveWorker(registration);
        return registration.pushManager.subscribe(options);
    }
}

async function getRegistrationForScope(scope) {
    if (
        typeof navigator === 'undefined' ||
        !navigator.serviceWorker ||
        !navigator.serviceWorker.getRegistration
    ) {
        return null;
    }
    return navigator.serviceWorker.getRegistration(scope);
}

async function getRegistrations() {
    if (
        typeof navigator === 'undefined' ||
        !navigator.serviceWorker ||
        !navigator.serviceWorker.getRegistrations
    ) {
        return [];
    }
    return navigator.serviceWorker.getRegistrations();
}

// Default subscription provider for the middleware. Each network has its own
// service worker registration, so a VAPID key change can safely recreate only
// that network's subscription.
export async function defaultBrowserSubscriptionProvider({
    stateKey,
    networkId,
    vapidPublicKey,
} = {}) {
    const registration = await ensureServiceWorker({ stateKey, networkId });
    let subscription = await registration.pushManager.getSubscription();

    if (subscription && !subscriptionMatchesVapidKey(subscription, vapidPublicKey)) {
        try {
            await subscription.unsubscribe();
        } catch {
            // Another tab may have already removed it.
        }
        subscription = await registration.pushManager.getSubscription();
        if (subscription && !subscriptionMatchesVapidKey(subscription, vapidPublicKey)) {
            subscription = null;
        }
    }

    if (!subscription) {
        try {
            subscription = await subscribeWithActiveWorker(registration, {
                userVisibleOnly: true,
                applicationServerKey: vapidKeyToUint8Array(vapidPublicKey),
            });
        } catch (err) {
            // Another tab may have won a concurrent subscribe race. Reuse its
            // subscription if it matches this network's key.
            subscription = await registration.pushManager.getSubscription();
            if (!subscription ||
                !subscriptionMatchesVapidKey(subscription, vapidPublicKey)
            ) {
                throw err;
            }
        }
    }

    return {
        endpoint: subscription.endpoint,
        keys: subscriptionToTagString(subscription),
    };
}

export async function unsubscribeBrowserSubscription({
    stateKey,
    networkId,
    unregister = false,
} = {}) {
    const scope = serviceWorkerScope(stateKey, networkId);
    const registration = await getRegistrationForScope(scope);
    if (!registration) {
        return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
    }
    if (unregister) {
        await registration.unregister();
    }
    return true;
}

async function removeRegistration(registration) {
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
        await registration.unregister();
    } catch {
        // Keep going; one broken registration must not block the rest.
    }
}

// The original implementation registered static/sw.js with its default
// /static/ scope and shared one subscription across every network. Remove that
// legacy registration so old endpoints cannot keep producing duplicate pushes.
function isLegacyWebpushRegistration(registration) {
    if (parseServiceWorkerScope(registration.scope)) {
        return false;
    }
    const worker = registration.active ||
        registration.waiting ||
        registration.installing;
    if (worker) {
        return /\/static\/sw\.js(?:\?|$)/.test(worker.scriptURL);
    }
    return /\/static\/?$/.test(registration.scope || '');
}

export async function cleanupLegacyRegistrations() {
    let registrations = [];
    try {
        registrations = await getRegistrations();
    } catch {
        return;
    }

    await Promise.all(registrations.map(async(registration) => {
        if (!isLegacyWebpushRegistration(registration)) {
            return;
        }
        await removeRegistration(registration);
    }));
}

export async function unsubscribeStateBrowserSubscriptions(stateKey) {
    let registrations = [];
    try {
        registrations = await getRegistrations();
    } catch {
        return;
    }
    const wantedStateKey = String(stateKey);

    await Promise.all(registrations.map(async(registration) => {
        if (isLegacyWebpushRegistration(registration)) {
            await removeRegistration(registration);
            return;
        }
        const parsed = parseServiceWorkerScope(registration.scope);
        if (!parsed || parsed.stateKey !== wantedStateKey) {
            return;
        }
        await removeRegistration(registration);
    }));
}

export async function cleanupOrphanedRegistrations(stateKey, activeNetworkIds) {
    let registrations = [];
    try {
        registrations = await getRegistrations();
    } catch {
        return;
    }
    const wantedStateKey = String(stateKey);
    const active = new Set((activeNetworkIds || []).map((id) => String(id)));

    await Promise.all(registrations.map(async(registration) => {
        const parsed = parseServiceWorkerScope(registration.scope);
        if (!parsed || parsed.stateKey !== wantedStateKey) {
            return;
        }
        if (active.has(parsed.networkId)) {
            return;
        }
        await removeRegistration(registration);
    }));
}
