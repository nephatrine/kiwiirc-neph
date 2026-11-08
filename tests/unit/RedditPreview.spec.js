import {
    clearLinkPreviewCache,
    resolveLinkPreview
} from '@/libs/LinkPreview';
import { getLinkPreviewProvider } from '@/libs/LinkPreviewProviders';
import { clearPagePreviewCache } from '@/libs/PagePreview';

const redditUrl = 'https://www.reddit.com/r/aww/comments/abc123/a_cat/';

function jsonResponse(data) {
    return {
        ok: true,
        json: async() => data,
    };
}

function htmlResponse(html) {
    return {
        ok: true,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async() => html,
    };
}

describe('Reddit link previews', () => {
    afterEach(() => {
        clearLinkPreviewCache();
        clearPagePreviewCache();
        delete global.fetch;
        delete window.kiwiDesktop;
    });

    it('recognizes Reddit post and short-link URLs', () => {
        expect(getLinkPreviewProvider(redditUrl).id).toBe('reddit');
        expect(getLinkPreviewProvider('https://www.reddit.com/r/Guildwars2/s/ayBuBWuPXW').id)
            .toBe('reddit');
    });

    it('uses the oEmbed card without requesting Reddit JSON', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            title: 'A cat',
            author_name: 'alice',
            provider_name: 'reddit',
            description: 'A Reddit post',
            thumbnail_url: 'https://example.com/cat.jpg',
        }));

        const card = await resolveLinkPreview(redditUrl);

        expect(card).toEqual({
            kind: 'card',
            provider: 'reddit',
            providerName: 'reddit',
            title: 'A cat',
            description: 'A Reddit post',
            author: 'alice',
            image: 'https://example.com/cat.jpg',
            url: redditUrl,
            originalUrl: redditUrl,
        });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://www.reddit.com/oembed?url=' +
                'https%3A%2F%2Fwww.reddit.com%2Fr%2Faww%2Fcomments%2Fabc123%2Fa_cat%2F',
            expect.any(Object)
        );
    });

    it('falls back to page metadata when Reddit oEmbed fails', async() => {
        window.kiwiDesktop = {};
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('oEmbed blocked'))
            .mockResolvedValueOnce(htmlResponse(`
                <html><head>
                    <title>Reddit page</title>
                    <meta property="og:image" content="https://example.com/reddit.jpg">
                </head></html>
            `));

        const card = await resolveLinkPreview(redditUrl);

        expect(card).toMatchObject({
            title: 'Reddit page',
            image: 'https://example.com/reddit.jpg',
        });
    });

    it('does not add a fallback card when oEmbed and page metadata fail', async() => {
        global.fetch = jest.fn().mockRejectedValue(new Error('blocked'));

        await expect(resolveLinkPreview(redditUrl)).rejects.toThrow('blocked');
    });
});
