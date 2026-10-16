import {
    base64UrlEncode,
    base64UrlDecode,
    vapidKeyToUint8Array,
    subscriptionToTagString,
    ensureServiceWorker
} from '@/libs/WebpushUtils';

describe('webpush encoding helpers', () => {
    it('encodes bytes to unpadded url-safe base64', () => {
        expect(base64UrlEncode(new Uint8Array([255, 239]))).toBe('_-8');
        expect(base64UrlEncode(new Uint8Array([104, 105]))).toBe('aGk');
    });

    it('round-trips arbitrary bytes', () => {
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 65, 66, 67]);
        const decoded = base64UrlDecode(base64UrlEncode(bytes));
        expect(Array.from(decoded)).toEqual(Array.from(bytes));
    });

    it('decodes a 65-byte VAPID key and rejects junk', () => {
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
    });

    it('formats subscription keys in message-tag format', () => {
        const subscription = {
            getKey: (name) => {
                if (name === 'p256dh') {
                    return new Uint8Array([1, 2, 3]);
                }
                if (name === 'auth') {
                    return new Uint8Array([4, 5]);
                }
                return null;
            },
        };
        expect(subscriptionToTagString(subscription)).toBe('p256dh=AQID;auth=BAU');
        expect(() => subscriptionToTagString({ getKey: () => null })).toThrow(
            'missing-subscription-keys'
        );
    });

    it('refuses to provide a subscription without a service worker', async() => {
        await expect(ensureServiceWorker()).rejects.toThrow('no-service-worker');
    });
});
