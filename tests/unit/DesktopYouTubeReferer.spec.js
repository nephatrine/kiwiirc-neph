import {
    EMBED_REFERER,
    addEmbedReferer
} from '../../desktop/electron/embed-referer';

describe('Desktop embed request headers', () => {
    it('uses the neutral loopback referer', () => {
        expect(EMBED_REFERER).toBe('https://localhost/');
    });

    it('adds a referer when one is missing', () => {
        expect(addEmbedReferer({})).toEqual({
            Referer: EMBED_REFERER,
        });
        expect(addEmbedReferer({ Accept: '*/*' })).toEqual({
            Accept: '*/*',
            Referer: EMBED_REFERER,
        });
    });

    it('preserves an existing referer regardless of case', () => {
        expect(addEmbedReferer({ Referer: 'https://example.com/' }))
            .toEqual({ Referer: 'https://example.com/' });
        expect(addEmbedReferer({ referer: 'https://example.com/' }))
            .toEqual({ referer: 'https://example.com/' });
    });

    it('replaces an empty referer', () => {
        expect(addEmbedReferer({ Referer: '' })).toEqual({
            Referer: EMBED_REFERER,
        });
    });
});
