// Pure helpers for draft/webpush (and soju.im/webpush) subscriptions.
// No browser APIs are touched at module scope so this stays unit-testable;
// the subscription provider below is the only part needing a browser.

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

// The WEBPUSH REGISTER keys parameter is message-tag formatted.
export function subscriptionToTagString(subscription) {
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    if (!p256dh || !auth) {
        throw new Error('missing-subscription-keys');
    }
    return 'p256dh=' + base64UrlEncode(p256dh) + ';auth=' + base64UrlEncode(auth);
}

export async function ensureServiceWorker() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        throw new Error('no-service-worker');
    }
    // Relative so installs under a sub-path keep working; static/ is copied
    // verbatim to dist/static/ by the build.
    return navigator.serviceWorker.register('static/sw.js');
}

// Default subscription provider for the middleware: reuses the stored
// browser subscription when one exists, otherwise creates it. WEBPUSH
// REGISTER is idempotent for a known endpoint, so reuse is always safe.
export async function defaultBrowserSubscriptionProvider(vapidPublicKey) {
    const registration = await ensureServiceWorker();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyToUint8Array(vapidPublicKey),
        });
    }
    return {
        endpoint: subscription.endpoint,
        keys: subscriptionToTagString(subscription),
    };
}
