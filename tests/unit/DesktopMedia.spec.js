import { desktopMediaUrl, isMediaProxyAvailable } from '@/libs/desktop/Media';
import {
    decodeMediaUrl,
    encodeMediaUrl
} from '../../desktop/electron/media-url';
import {
    isMediaContentType,
    mediaHeaders
} from '../../desktop/electron/media';

describe('Desktop media proxy', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('leaves URLs unchanged without a desktop bridge', () => {
        const url = 'https://example.com/image.png';

        expect(isMediaProxyAvailable()).toBe(false);
        expect(desktopMediaUrl(url)).toBe(url);
    });

    it('treats an incomplete media bridge as unavailable', () => {
        window.kiwiDesktop = { media: {} };

        expect(isMediaProxyAvailable()).toBe(false);
    });

    it('leaves non-HTTP URLs unchanged', () => {
        window.kiwiDesktop = {
            media: { proxyUrl: (url) => `kiwi-media://media/${encodeURIComponent(url)}` },
        };

        expect(desktopMediaUrl('app://kiwi/static/logo.png'))
            .toBe('app://kiwi/static/logo.png');
    });

    it('rewrites HTTP media URLs through the bridge', () => {
        window.kiwiDesktop = {
            media: { proxyUrl: (url) => `proxied:${url}` },
        };

        expect(desktopMediaUrl('https://example.com/image.png'))
            .toBe('proxied:https://example.com/image.png');
    });

    it('round-trips media proxy URLs', () => {
        const url = 'https://example.com/path/image.png?size=large#fragment';
        const proxied = encodeMediaUrl(url);

        expect(decodeMediaUrl(proxied)).toBe(url);
    });

    it('accepts only direct media content types', () => {
        expect(isMediaContentType('image/png')).toBe(true);
        expect(isMediaContentType('audio/ogg; codecs=opus')).toBe(true);
        expect(isMediaContentType('video/mp4')).toBe(true);
        expect(isMediaContentType('text/html')).toBe(false);
        expect(isMediaContentType('application/json')).toBe(false);
        expect(isMediaContentType('')).toBe(false);
    });

    it('forwards safe response headers and sets no-sniff', () => {
        const headers = mediaHeaders({
            'accept-ranges': 'bytes',
            'content-range': 'bytes 0-9/100',
            'content-length': '10',
            'content-type': 'image/png',
            'x-secret': 'nope',
        }, 'image/png');

        expect(headers['Content-Type']).toBe('image/png');
        expect(headers['Accept-Ranges'] || headers['accept-ranges']).toBe('bytes');
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
        expect(headers['X-Secret']).toBeUndefined();
        expect(headers['x-secret']).toBeUndefined();
    });

    it('allows CORS only for an approved app origin', () => {
        const headers = mediaHeaders({}, 'image/png', 'app://kiwi');

        expect(headers['Access-Control-Allow-Origin']).toBe('app://kiwi');
        expect(headers.Vary).toBe('Origin');
    });
});
