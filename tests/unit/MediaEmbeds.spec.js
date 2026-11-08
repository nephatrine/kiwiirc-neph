import * as Misc from '@/helpers/Misc';
import { getMediaEmbed } from '@/libs/MediaEmbeds';

describe('curated media embeds', () => {
    it('builds TED player URLs', () => {
        const embed = getMediaEmbed('https://www.ted.com/talks/a_talk?language=en');

        expect(embed).toMatchObject({
            type: 'embed',
            provider: 'ted',
            id: 'a_talk',
            src: 'https://embed.ted.com/talks/a_talk',
            aspectRatio: '16 / 9',
        });
        expect(getMediaEmbed('https://www.ted.com/dubbing/a_talk').src)
            .toBe('https://embed.ted.com/talks/a_talk');
    });

    it('builds Mixcloud widget URLs', () => {
        const url = 'https://www.mixcloud.com/sohoradio/dub-on-air-with-dennis-bovell/';
        const embed = getMediaEmbed(url);

        expect(embed).toMatchObject({
            type: 'embed',
            provider: 'mixcloud',
            id: 'sohoradio/dub-on-air-with-dennis-bovell',
            height: '120px',
        });
        expect(embed.src).toContain('https://www.mixcloud.com/widget/iframe/');
        expect(embed.src).toContain(encodeURIComponent(url));
        expect(getMediaEmbed('https://www.mixcloud.com/discover/')).toBe(null);
    });

    it('builds Wistia player URLs', () => {
        expect(getMediaEmbed('https://appsumo.wistia.com/medias/fudkgyoejs')).toMatchObject({
            provider: 'wistia',
            id: 'fudkgyoejs',
            src: 'https://fast.wistia.net/embed/iframe/fudkgyoejs',
        });
        expect(getMediaEmbed('https://fast.wistia.net/embed/iframe/fudkgyoejs').src)
            .toBe('https://fast.wistia.net/embed/iframe/fudkgyoejs');
    });

    it('builds Loom player URLs', () => {
        expect(getMediaEmbed('https://www.loom.com/share/0808e55f94a24992b2de488ac56d3815'))
            .toMatchObject({
                provider: 'loom',
                id: '0808e55f94a24992b2de488ac56d3815',
                src: 'https://www.loom.com/embed/0808e55f94a24992b2de488ac56d3815',
            });
    });

    it('builds Art19 player URLs', () => {
        expect(getMediaEmbed('https://art19.com/shows/intercom-on-product-management'))
            .toMatchObject({
                provider: 'art19',
                src: 'https://art19.com/shows/intercom-on-product-management/embed',
                height: '180px',
            });
        expect(getMediaEmbed(
            'https://art19.com/shows/intercom-on-product-management/' +
            'episodes/5801ff9e-51ba-4e15-a284-5069751c6bed'
        )).toMatchObject({
            src: 'https://art19.com/shows/intercom-on-product-management/' +
                'episodes/5801ff9e-51ba-4e15-a284-5069751c6bed/embed',
        });
    });

    it('builds Pinterest embed URLs', () => {
        const embed = getMediaEmbed('https://www.pinterest.com/pin/123456789012345678/');

        expect(embed).toMatchObject({
            provider: 'pinterest',
            id: '123456789012345678',
            src: 'https://assets.pinterest.com/ext/embed.html?id=123456789012345678',
            maxWidth: '450px',
        });
    });

    it('builds TikTok player URLs', () => {
        const embed = getMediaEmbed('https://www.tiktok.com/@scout2015/video/6718335390845095173');

        expect(embed).toMatchObject({
            provider: 'tiktok',
            id: '6718335390845095173',
            src: 'https://www.tiktok.com/player/v1/6718335390845095173',
            aspectRatio: '9 / 16',
            maxWidth: '360px',
        });
        expect(Misc.getMediaInfo(
            'https://www.tiktok.com/@scout2015/photo/6718335390845095173'
        ).type).toBe('embed');
    });

    it('builds Prezi embeds', () => {
        expect(getMediaEmbed('https://prezi.com/abc123def456/some-prezi/')).toMatchObject({
            provider: 'prezi',
            id: 'abc123def456',
            src: 'https://prezi.com/embed/abc123def456/',
        });
    });

    it('builds OpenStreetMap embeds', () => {
        const embed = getMediaEmbed(
            'https://www.openstreetmap.org/#map=12/50.2598/28.6695'
        );

        expect(embed).toMatchObject({
            provider: 'openstreetmap',
            id: '50.2598,28.6695',
        });
        expect(embed.src).toContain('https://www.openstreetmap.org/export/embed.html');
        expect(embed.src).toContain('marker=50.2598,28.6695');
    });

    it('does not build OpenStreetMap embeds without coordinates', () => {
        expect(getMediaEmbed('https://www.openstreetmap.org/')).toBeNull();
        expect(getMediaEmbed('https://www.openstreetmap.org/node/123')).toBeNull();
    });

    it('builds Yandex map embeds', () => {
        const embed = getMediaEmbed(
            'https://yandex.com/maps/?ll=37.624027%2C55.753512&z=14'
        );

        expect(embed).toMatchObject({
            provider: 'yandex-maps',
            id: '55.753512,37.624027',
            src: 'https://yandex.com/map-widget/v1/?ll=37.624027%2C55.753512&z=14',
        });
    });

    it('leaves unsupported providers alone', () => {
        expect(getMediaEmbed('https://example.com/video/123')).toBe(null);
        expect(getMediaEmbed('https://vm.tiktok.com/ZM123456/')).toBe(null);
    });
});
