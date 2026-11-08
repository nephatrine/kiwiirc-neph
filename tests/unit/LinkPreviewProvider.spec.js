import * as Misc from '@/helpers/Misc';
import {
    clearLinkPreviewCache,
    resolveEmbedFallback,
    resolveLinkPreview
} from '@/libs/LinkPreview';
import {
    getLinkPreviewProvider,
    getOEmbedFallbackProvider
} from '@/libs/LinkPreviewProviders';
import { clearPagePreviewCache } from '@/libs/PagePreview';

function htmlResponse(html) {
    return {
        ok: true,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async() => html,
    };
}

function jsonResponse(data) {
    return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async() => data,
        text: async() => JSON.stringify(data),
    };
}

describe('link preview providers', () => {
    afterEach(() => {
        clearLinkPreviewCache();
        clearPagePreviewCache();
        delete global.fetch;
        delete window.kiwiDesktop;
    });

    it('recognizes oEmbed provider URLs without changing direct media', () => {
        expect(getLinkPreviewProvider('https://www.ted.com/talks/a_talk')).toBe(null);
        expect(Misc.getMediaInfo('https://www.ted.com/talks/a_talk')).toMatchObject({
            type: 'embed',
            provider: 'ted',
        });
        expect(getLinkPreviewProvider('https://imgur.com/gallery/AbCdEf')).toBe(null);
        expect(Misc.getMediaInfo('https://imgur.com/gallery/AbCdEf').type).toBe('imgur');
        expect(Misc.getMediaInfo('https://imgur.com/gallery/spooky-bats-8hjUWeb').id)
            .toBe('8hjUWeb');
        expect(getLinkPreviewProvider('https://www.dailymotion.com/video/x7tgad0').id)
            .toBe('dailymotion');
        expect(getLinkPreviewProvider('https://www.reddit.com/r/test/comments/abc123/post').id)
            .toBe('reddit');
        expect(getLinkPreviewProvider('https://speakerdeck.com/user/a-talk').id)
            .toBe('speakerdeck');
        expect(getLinkPreviewProvider('https://example.com/article')).toBe(null);

        expect(Misc.getMediaInfo('https://example.com/image.jpg').type).toBe('image');
    });

    it('uses a Tier C player for Vimeo', () => {
        const vimeo = 'https://vimeo.com/channels/comedy/741893324';
        const vimeoPlayer = 'https://player.vimeo.com/video/741893324';

        expect(Misc.getMediaInfo(vimeo)).toMatchObject({
            type: 'vimeo',
            id: '741893324',
        });
        expect(Misc.getMediaInfo(vimeoPlayer)).toMatchObject({
            type: 'vimeo',
            id: '741893324',
        });
        expect(getLinkPreviewProvider(vimeo)).toBe(null);
    });

    it('recognizes Flickr photos, albums, and sets', () => {
        const photo = 'https://www.flickr.com/photos/24516483@N03/27376931671/in/photolist-HHcVZi';
        const album = 'https://www.flickr.com/photos/24516483@N03/albums/72157667466355446';
        const set = 'https://www.flickr.com/photos/24516483@N03/sets/72157667466355446';

        expect(getLinkPreviewProvider(photo).id).toBe('flickr');
        expect(getLinkPreviewProvider(album).id).toBe('flickr');
        expect(getLinkPreviewProvider(set).id).toBe('flickr');
        expect(Misc.getMediaInfo(album).type).toBe('');

        window.kiwiDesktop = {};
        expect(Misc.getMediaInfo(album).type).toBe('oembed');
        delete window.kiwiDesktop;
    });

    it('hides desktop-only providers on web', () => {
        const url = 'https://www.dailymotion.com/video/x7tgad0';

        expect(Misc.getMediaInfo(url).type).toBe('');

        window.kiwiDesktop = {};
        expect(Misc.getMediaInfo(url).type).toBe('oembed');
        delete window.kiwiDesktop;
    });

    it('provides Tier B fallbacks for Tier C URLs', async() => {
        expect(getOEmbedFallbackProvider('https://vimeo.com/123456').id).toBe('vimeo');
        expect(getOEmbedFallbackProvider('https://www.youtube.com/watch?v=abc').id)
            .toBe('youtube');
        expect(getOEmbedFallbackProvider('https://example.com/video')).toBe(null);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async() => ({
                title: 'Fallback video',
                provider_name: 'Vimeo',
            }),
        });

        const card = await resolveEmbedFallback('https://vimeo.com/123456');

        expect(card).toMatchObject({
            kind: 'card',
            provider: 'vimeo',
            title: 'Fallback video',
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to Tier D when no Tier B provider exists', async() => {
        window.kiwiDesktop = {};
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <meta property="og:title" content="Map page">
            </head></html>
        `));

        const card = await resolveEmbedFallback(
            'https://www.openstreetmap.org/#map=12/50.2598/28.6695'
        );

        expect(card).toMatchObject({
            kind: 'card',
            provider: 'metadata',
            title: 'Map page',
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to Tier D when Tier B fails', async() => {
        window.kiwiDesktop = {};
        global.fetch = jest.fn().mockImplementation((requestUrl) => {
            if (String(requestUrl).includes('api/oembed')) {
                return Promise.reject(new Error('blocked'));
            }
            return Promise.resolve(htmlResponse(`
                <html><head>
                    <meta property="og:title" content="Vimeo page">
                </head></html>
            `));
        });

        const card = await resolveEmbedFallback('https://vimeo.com/123456');

        expect(card).toMatchObject({
            kind: 'card',
            provider: 'metadata',
            title: 'Vimeo page',
        });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not attempt Tier D on web', async() => {
        global.fetch = jest.fn();

        await expect(resolveEmbedFallback(
            'https://www.openstreetmap.org/#map=12/50.2598/28.6695'
        )).rejects.toThrow('no embed fallback provider');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('allows Tier D on web for verified generic hosts', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <meta property="og:title" content="NPR page">
            </head></html>
        `));

        const card = await resolveEmbedFallback('https://www.npr.org/story');

        expect(card).toMatchObject({
            kind: 'card',
            provider: 'metadata',
            title: 'NPR page',
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('recognizes named web providers', () => {
        expect(getLinkPreviewProvider('https://en.wikipedia.org/wiki/IRC').id)
            .toBe('wikipedia');
        expect(getLinkPreviewProvider('https://archive.org/details/nasa').id)
            .toBe('archive');
        expect(getLinkPreviewProvider(
            'https://stackoverflow.com/questions/100003/what-are-metaclasses-in-python'
        ).id).toBe('stackexchange');
        expect(getLinkPreviewProvider('https://harrypotter.fandom.com/wiki/Harry_Potter').id)
            .toBe('fandom');
        expect(getLinkPreviewProvider('https://x.com/jack/status/20').id).toBe('x');
        expect(getLinkPreviewProvider(
            'https://write.as/blogofsand/doom-slayer-arrives-in-westeros-volume-i-the-north'
        ).id).toBe('writeas');
        expect(getLinkPreviewProvider(
            'https://lemma.pub/did:plc:2i6incpu57yuhm3lvcttcahy/pub/3mx62fc3c5c7v/3mzrhnlulss6v'
        ).id).toBe('lemma');
        expect(getLinkPreviewProvider('https://www.fandom.com/wiki/Main_Page')).toBe(null);
        expect(getLinkPreviewProvider('https://x.com/jack')).toBe(null);
        expect(getLinkPreviewProvider('https://write.as/api/posts/123')).toBe(null);

        expect(Misc.getMediaInfo('https://en.wikipedia.org/wiki/IRC')).toMatchObject({
            type: 'oembed',
            id: 'wikipedia',
        });
        expect(Misc.getMediaInfo('https://archive.org/details/nasa')).toMatchObject({
            type: 'oembed',
            id: 'archive',
        });
        expect(Misc.getMediaInfo('https://x.com/jack/status/20')).toMatchObject({
            type: 'oembed',
            id: 'x',
        });
        expect(Misc.getMediaInfo(
            'https://write.as/blogofsand/doom-slayer-arrives-in-westeros-volume-i-the-north'
        )).toMatchObject({
            type: 'oembed',
            id: 'writeas',
        });
        expect(Misc.getMediaInfo(
            'https://lemma.pub/did:plc:2i6incpu57yuhm3lvcttcahy/pub/3mx62fc3c5c7v/3mzrhnlulss6v'
        )).toMatchObject({
            type: 'oembed',
            id: 'lemma',
        });
    });

    it('resolves a Wikipedia summary card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            title: 'IRC',
            extract: 'Internet Relay Chat',
            thumbnail: { source: 'https://upload.wikimedia.org/irc.png' },
            content_urls: {
                desktop: { page: 'https://en.wikipedia.org/wiki/IRC' },
            },
        }));

        const card = await resolveLinkPreview('https://en.wikipedia.org/wiki/IRC');

        expect(card).toMatchObject({
            kind: 'card',
            provider: 'wikipedia',
            providerName: 'Wikipedia',
            title: 'IRC',
            description: 'Internet Relay Chat',
            image: 'https://upload.wikimedia.org/irc.png',
            url: 'https://en.wikipedia.org/wiki/IRC',
        });
    });

    it('resolves an Internet Archive card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            metadata: {
                title: 'NASA',
                description: 'NASA image archive <a href="https://example.com">details</a>&nbsp;',
                creator: 'NASA',
            },
        }));

        const card = await resolveLinkPreview('https://archive.org/details/nasa');

        expect(card).toMatchObject({
            provider: 'archive',
            providerName: 'Internet Archive',
            title: 'NASA',
            description: 'NASA image archive details',
            author: 'NASA',
            image: 'https://archive.org/services/img/nasa',
        });
    });

    it('resolves a Stack Overflow card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            items: [{
                title: 'What are metaclasses in Python?',
                score: 100,
                answer_count: 5,
                owner: { display_name: 'Bite code' },
                link: 'https://stackoverflow.com/questions/100003',
            }],
        }));

        const card = await resolveLinkPreview(
            'https://stackoverflow.com/questions/100003/what-are-metaclasses-in-python'
        );

        expect(card).toMatchObject({
            provider: 'stackexchange',
            providerName: 'Stack Overflow',
            title: 'What are metaclasses in Python?',
            description: '100 score · 5 answers',
            author: 'Bite code',
            url: 'https://stackoverflow.com/questions/100003',
        });
    });

    it('resolves a Fandom card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            query: {
                pages: {
                    13: {
                        title: 'Harry Potter',
                        pageprops: { description: 'Fictional wizard' },
                        thumbnail: { source: 'https://static.wikia.nocookie.net/harry.png' },
                    },
                },
            },
        }));

        const card = await resolveLinkPreview(
            'https://harrypotter.fandom.com/wiki/Harry_Potter'
        );

        expect(card).toMatchObject({
            provider: 'fandom',
            providerName: 'Fandom',
            title: 'Harry Potter',
            description: 'Fictional wizard',
            image: 'https://static.wikia.nocookie.net/harry.png',
        });
    });

    it('resolves an X post card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            author_name: 'jack',
            url: 'https://x.com/jack/status/20',
        }));

        const card = await resolveLinkPreview('https://x.com/jack/status/20');

        expect(card).toMatchObject({
            provider: 'x',
            providerName: 'X',
            title: 'Post by jack',
            author: 'jack',
            url: 'https://x.com/jack/status/20',
        });
    });

    it('rejects when Tier B and Tier D both fail', async() => {
        window.kiwiDesktop = {};
        global.fetch = jest.fn().mockRejectedValue(new Error('blocked'));

        await expect(resolveEmbedFallback('https://vimeo.com/123456'))
            .rejects.toThrow('blocked');
    });

    it('resolves a Write.as post card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            code: 200,
            data: {
                slug: 'yesterdays-checkmate-win',
                title: '',
                body: '![QBB](https://i.snap.as/B7cXqgBA.png)\n\n# Yesterday\'s Checkmate Win.\n\nI won this game yesterday.',
            },
        }));

        const card = await resolveLinkPreview(
            'https://write.as/quick-notes/yesterdays-checkmate-win'
        );

        expect(card).toMatchObject({
            provider: 'writeas',
            providerName: 'Write.as',
            title: 'Yesterday\'s Checkmate Win.',
            description: 'I won this game yesterday.',
            image: 'https://i.snap.as/B7cXqgBA.png',
        });
    });

    it('resolves a Lemma post card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            title: 'Amores (Iii)',
            content: 'as is the sea marvelous\n\nfrom god\'s hands',
        }));

        const card = await resolveLinkPreview(
            'https://lemma.pub/did:plc:2i6incpu57yuhm3lvcttcahy/pub/3mx62fc3c5c7v/3mzrhnlulss6v'
        );

        expect(card).toMatchObject({
            provider: 'lemma',
            providerName: 'Lemma',
            title: 'Amores (Iii)',
            description: 'as is the sea marvelous from god\'s hands',
        });
    });

    it('normalizes a provider oEmbed response into a card', async() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async() => ({
                title: 'A photo',
                description: 'A description',
                author_name: 'Author',
                provider_name: 'Flickr',
                thumbnail_url: 'https://example.com/thumb.jpg',
                html: '<iframe>ignored</iframe>',
            }),
        });

        const photo = 'https://www.flickr.com/photos/user/123456';
        const card = await resolveLinkPreview(photo);

        expect(card).toEqual({
            kind: 'card',
            provider: 'flickr',
            providerName: 'Flickr',
            title: 'A photo',
            description: 'A description',
            author: 'Author',
            image: 'https://example.com/thumb.jpg',
            url: photo,
            originalUrl: photo,
        });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://www.flickr.com/services/oembed/?format=json&url=' +
                'https%3A%2F%2Fwww.flickr.com%2Fphotos%2Fuser%2F123456',
            expect.any(Object)
        );
    });

    it('extracts a safe presentation iframe from oEmbed HTML', async() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async() => ({
                title: 'Le Design thinking',
                provider_name: 'SlideShare',
                width: 427,
                height: 356,
                html: '<iframe src="https://www.slideshare.net/slideshow/' +
                    'embed_code/key/abc123" width="427" height="356"></iframe>' +
                    '<script>ignored()</script>',
            }),
        });

        const url = 'https://www.slideshare.net/EnjoyDigitAll/le-design-thinking';
        const preview = await resolveLinkPreview(url);

        expect(preview).toEqual({
            kind: 'embed',
            provider: 'slideshare',
            providerName: 'SlideShare',
            title: 'Le Design thinking',
            embedUrl: 'https://www.slideshare.net/slideshow/embed_code/key/abc123',
            aspectRatio: '427 / 356',
            originalUrl: url,
        });
    });

    it('does not accept an unlisted iframe host', async() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async() => ({
                title: 'Unsafe presentation',
                provider_name: 'SlideShare',
                width: 427,
                height: 356,
                html: '<iframe src="https://example.com/player/abc123"></iframe>',
            }),
        });

        const url = 'https://www.slideshare.net/EnjoyDigitAll/le-design-thinking';
        const preview = await resolveLinkPreview(url);

        expect(preview.kind).toBe('card');
        expect(preview.embedUrl).toBeUndefined();
    });

    it('caches repeated provider requests', async() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async() => ({
                title: 'Cached photo',
                provider_name: 'Flickr',
            }),
        });

        const url = 'https://www.flickr.com/photos/user/123456';
        await resolveLinkPreview(url);
        await resolveLinkPreview(url);

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
