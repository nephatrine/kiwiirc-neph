import * as Misc from '@/helpers/Misc';
import {
    clearPagePreviewCache,
    isWebGenericHost,
    parseAmazonProduct,
    parseBitbucketRepo,
    parseGameTrackerServer,
    parseGiteaRepo,
    parseGitHubRepo,
    parseGitLabRepo,
    parseItchGame,
    resolvePagePreview
} from '@/libs/PagePreview';

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

function xmlResponse(text) {
    return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/xml' }),
        text: async() => text,
    };
}

describe('Tier D page previews', () => {
    beforeEach(() => {
        window.kiwiDesktop = {};
    });

    afterEach(() => {
        clearPagePreviewCache();
        delete global.fetch;
        delete window.kiwiDesktop;
        delete window.kiwi;
    });

    it('reads Open Graph metadata', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <meta property="og:title" content="A page">
                <meta property="og:description" content="A description">
                <meta property="og:site_name" content="Example">
                <meta property="og:image" content="/image.png">
                <meta property="og:url" content="/canonical">
            </head></html>
        `));

        const preview = await resolvePagePreview('https://example.com/article');

        expect(preview).toEqual({
            kind: 'card',
            provider: 'metadata',
            providerName: 'Example',
            title: 'A page',
            description: 'A description',
            author: '',
            image: 'https://example.com/image.png',
            url: 'https://example.com/canonical',
            originalUrl: 'https://example.com/article',
        });
    });

    it('discovers and uses a generic JSON oEmbed endpoint', async() => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(htmlResponse(`
                <html><head>
                    <link rel="alternate" type="application/json+oembed"
                        href="/oembed?url=https%3A%2F%2Fexample.com%2Fpost">
                </head></html>
            `))
            .mockResolvedValueOnce(jsonResponse({
                title: 'oEmbed title',
                description: 'oEmbed description',
                author_name: 'oEmbed author',
                provider_name: 'Example Provider',
                thumbnail_url: '/thumb.jpg',
                html: '<iframe>ignored</iframe>',
            }));

        const preview = await resolvePagePreview('https://example.com/post');

        expect(preview).toEqual({
            kind: 'card',
            provider: 'oembed',
            providerName: 'Example Provider',
            title: 'oEmbed title',
            description: 'oEmbed description',
            author: 'oEmbed author',
            image: 'https://example.com/thumb.jpg',
            url: 'https://example.com/post',
            originalUrl: 'https://example.com/post',
        });
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            'https://example.com/oembed?url=https%3A%2F%2Fexample.com%2Fpost',
            expect.any(Object)
        );
    });

    it('discovers an XML oEmbed endpoint', async() => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(htmlResponse(`
                <html><head>
                    <link rel="alternate" type="text/xml+oembed"
                        href="https://example.com/oembed.xml">
                </head></html>
            `))
            .mockResolvedValueOnce(xmlResponse(`
                <oembed>
                    <title>XML title</title>
                    <provider_name>XML Provider</provider_name>
                    <thumbnail_url>https://example.com/xml.jpg</thumbnail_url>
                </oembed>
            `));

        const preview = await resolvePagePreview('https://example.com/post');

        expect(preview).toMatchObject({
            provider: 'oembed',
            providerName: 'XML Provider',
            title: 'XML title',
            image: 'https://example.com/xml.jpg',
        });
    });

    it('falls back to page metadata when oEmbed discovery fails', async() => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(htmlResponse(`
                <html><head>
                    <meta property="og:title" content="Page title">
                    <meta property="og:image" content="https://example.com/page.jpg">
                    <link rel="alternate" type="application/json+oembed"
                        href="https://example.com/oembed">
                </head></html>
            `))
            .mockRejectedValueOnce(new Error('oEmbed failed'));

        const preview = await resolvePagePreview('https://example.com/post');

        expect(preview).toMatchObject({
            provider: 'metadata',
            title: 'Page title',
            image: 'https://example.com/page.jpg',
        });
    });

    it('falls back to Twitter metadata and page title', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <title>Page title</title>
                <meta name="twitter:description" content="Twitter description">
                <meta name="twitter:image" content="https://cdn.example.com/image.jpg">
            </head></html>
        `));

        const preview = await resolvePagePreview('https://example.com/article');

        expect(preview.title).toBe('Page title');
        expect(preview.description).toBe('Twitter description');
        expect(preview.image).toBe('https://cdn.example.com/image.jpg');
    });

    it('falls back to JSON-LD metadata', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <script type="application/ld+json">
                    {"@type":"Article","headline":"JSON title","description":"JSON description",
                     "image":"/json.png","author":{"name":"JSON author"}}
                </script>
            </head></html>
        `));

        const preview = await resolvePagePreview('https://example.com/article');

        expect(preview.title).toBe('JSON title');
        expect(preview.description).toBe('JSON description');
        expect(preview.author).toBe('JSON author');
        expect(preview.image).toBe('https://example.com/json.png');
    });

    it('rejects unsafe image URLs', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <meta property="og:title" content="Unsafe image">
                <meta property="og:image" content="data:image/png;base64,abc">
            </head></html>
        `));

        const preview = await resolvePagePreview('https://example.com/article');

        expect(preview.image).toBe('');
    });

    it('rejects non-HTML responses', async() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            text: async() => '{}',
        });

        await expect(resolvePagePreview('https://example.com/article'))
            .rejects.toThrow('page preview is not HTML');
    });

    it('allows only verified generic web hosts', async() => {
        delete window.kiwiDesktop;

        expect(isWebGenericHost('https://www.npr.org/story')).toBe(true);
        expect(isWebGenericHost('https://foxnews.com/politics')).toBe(true);
        expect(isWebGenericHost('https://www.independent.co.uk/news/story')).toBe(true);
        expect(isWebGenericHost('https://www.dw.com/en/story/a-1')).toBe(true);
        expect(isWebGenericHost('https://www.w3.org/TR/cors/')).toBe(true);
        expect(isWebGenericHost('https://www.apache.org/')).toBe(true);
        expect(isWebGenericHost('https://example.com/article')).toBe(false);

        expect(Misc.getMediaInfo('https://www.npr.org/story')).toMatchObject({
            type: 'metadata',
            provider: 'generic',
        });
        expect(Misc.getMediaInfo('https://example.com/article').type).toBe('');

        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <meta property="og:title" content="NPR page">
            </head></html>
        `));

        const preview = await resolvePagePreview('https://www.npr.org/story');

        expect(preview).toMatchObject({
            provider: 'metadata',
            title: 'NPR page',
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('rejects non-allowlisted generic pages on web without fetching', async() => {
        delete window.kiwiDesktop;
        global.fetch = jest.fn();

        await expect(resolvePagePreview('https://example.com/article'))
            .rejects.toThrow('web generic preview is not allowlisted');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent preview requests for the same URL', async() => {
        let releaseFetch;
        global.fetch = jest.fn(() => new Promise((resolve) => {
            releaseFetch = () => resolve(htmlResponse(`
                <html><head><meta property="og:title" content="Shared page"></head></html>
            `));
        }));

        const first = resolvePagePreview('https://example.com/shared');
        const second = resolvePagePreview('https://example.com/shared');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        releaseFetch();

        const results = await Promise.all([first, second]);
        expect(results[0].title).toBe('Shared page');
        expect(results[1]).toBe(results[0]);
    });

    it('temporarily caches failed preview requests', async() => {
        global.fetch = jest.fn().mockRejectedValue(new Error('CORS failed'));

        await expect(resolvePagePreview('https://example.com/failing'))
            .rejects.toThrow('CORS failed');
        await expect(resolvePagePreview('https://example.com/failing'))
            .rejects.toThrow('page preview recently failed');

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('enforces the web HTML size limit', async() => {
        delete window.kiwiDesktop;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: async() => 'x'.repeat(2 * 1024 * 1024 + 1),
        });

        await expect(resolvePagePreview('https://www.npr.org/story'))
            .rejects.toThrow('page preview is too large');
    });

    it('recognizes GitHub repository URLs', () => {
        expect(parseGitHubRepo('https://github.com/owner/repo')).toMatchObject({
            owner: 'owner',
            repo: 'repo',
            apiUrl: 'https://api.github.com/repos/owner/repo',
        });
        expect(parseGitHubRepo('https://github.com/topics/javascript')).toBe(null);
        expect(parseGitHubRepo('https://github.com/owner/repo/issues')).toBe(null);
    });

    it('builds a GitHub repository card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            full_name: 'owner/repo',
            description: 'A repository',
            html_url: 'https://github.com/owner/repo',
            stargazers_count: 42,
            forks_count: 7,
            language: 'JavaScript',
            owner: {
                login: 'owner',
                avatar_url: 'https://avatars.githubusercontent.com/u/1',
            },
        }));

        const preview = await resolvePagePreview('https://github.com/owner/repo');

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'github',
            providerName: 'GitHub',
            title: 'owner/repo',
            description: 'A repository · 42 stars · 7 forks · JavaScript',
            author: 'owner',
            image: 'https://avatars.githubusercontent.com/u/1',
            url: 'https://github.com/owner/repo',
        });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.github.com/repos/owner/repo',
            expect.any(Object)
        );
    });

    it('recognizes Bitbucket repository URLs', () => {
        expect(parseBitbucketRepo(
            'https://bitbucket.org/Knightmare66/kmquake2_stable/'
        )).toMatchObject({
            workspace: 'Knightmare66',
            repo: 'kmquake2_stable',
            apiUrl: 'https://api.bitbucket.org/2.0/repositories/' +
                'Knightmare66/kmquake2_stable',
        });
        expect(parseBitbucketRepo(
            'https://bitbucket.org/Knightmare66/kmquake2_stable/src/master/'
        )).toMatchObject({
            workspace: 'Knightmare66',
            repo: 'kmquake2_stable',
        });
        expect(parseBitbucketRepo('https://bitbucket.org/product')).toBe(null);
    });

    it('builds a Bitbucket repository card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            full_name: 'Knightmare66/kmquake2_stable',
            description: 'Source code for the stable KMQuake2 branch.',
            language: 'c',
            mainbranch: { name: 'master' },
            owner: { username: 'Knightmare66-team', display_name: 'Knightmare66' },
            links: {
                avatar: { href: 'https://bytebucket.org/ravatar/example' },
                html: { href: 'https://bitbucket.org/Knightmare66/kmquake2_stable' },
            },
        }));

        const preview = await resolvePagePreview(
            'https://bitbucket.org/Knightmare66/kmquake2_stable/src/master/'
        );

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'bitbucket',
            providerName: 'Bitbucket',
            title: 'Knightmare66/kmquake2_stable',
            description: 'Source code for the stable KMQuake2 branch. · c · master',
            author: 'Knightmare66',
            image: 'https://bytebucket.org/ravatar/example',
            url: 'https://bitbucket.org/Knightmare66/kmquake2_stable',
        });
    });

    it('recognizes GitLab repository and nested-group URLs', () => {
        expect(parseGitLabRepo(
            'https://gitlab.com/Jagestah/icky-treasure-generator'
        )).toMatchObject({
            projectPath: 'Jagestah/icky-treasure-generator',
            namespace: 'Jagestah',
            project: 'icky-treasure-generator',
            apiUrl: 'https://gitlab.com/api/v4/projects/' +
                'Jagestah%2Ficky-treasure-generator',
        });
        expect(parseGitLabRepo(
            'https://gitlab.com/group/subgroup/project/-/tree/main'
        )).toMatchObject({
            projectPath: 'group/subgroup/project',
            namespace: 'group/subgroup',
            project: 'project',
        });
        expect(parseGitLabRepo('https://gitlab.com/explore/projects')).toBe(null);
    });

    it('builds a GitLab repository card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            name_with_namespace: 'JJ / icky-treasure-generator',
            path_with_namespace: 'Jagestah/icky-treasure-generator',
            description: 'A treasure generator',
            web_url: 'https://gitlab.com/Jagestah/icky-treasure-generator',
            avatar_url: null,
            star_count: 3,
            forks_count: 1,
            default_branch: 'main',
            namespace: {
                name: 'JJ',
                avatar_url: '/uploads/avatar/example.png',
            },
        }));

        const preview = await resolvePagePreview(
            'https://gitlab.com/Jagestah/icky-treasure-generator'
        );

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'gitlab',
            providerName: 'GitLab',
            title: 'JJ / icky-treasure-generator',
            description: 'A treasure generator · 3 stars · 1 forks · main',
            author: 'JJ',
            image: 'https://gitlab.com/uploads/avatar/example.png',
            url: 'https://gitlab.com/Jagestah/icky-treasure-generator',
        });
    });

    it('recognizes the supported Gitea and Forgejo hosts', () => {
        expect(parseGiteaRepo('https://gitea.com/gitea/act')).toMatchObject({
            host: 'gitea.com',
            name: 'Gitea',
            web: true,
            owner: 'gitea',
            repo: 'act',
            apiUrl: 'https://gitea.com/api/v1/repos/gitea/act',
        });
        expect(parseGiteaRepo('https://codeberg.org/forgejo/forgejo')).toMatchObject({
            host: 'codeberg.org',
            name: 'Codeberg',
            web: true,
            owner: 'forgejo',
            repo: 'forgejo',
        });
        expect(parseGiteaRepo(
            'https://code.nephatrine.net/nephatrine/discord-irc'
        )).toMatchObject({
            host: 'code.nephatrine.net',
            name: 'NephatrineCode',
            web: true,
            owner: 'nephatrine',
            repo: 'discord-irc',
        });
        expect(parseGiteaRepo('https://code.idtech.space/yquake2/yquake2'))
            .toMatchObject({
                host: 'code.idtech.space',
                web: false,
                owner: 'yquake2',
                repo: 'yquake2',
            });
        expect(parseGiteaRepo('https://codeberg.org/forgejo/forgejo/issues')).toBe(null);
        expect(parseGiteaRepo('https://codeberg.org/explore/repos')).toBe(null);
    });

    it('builds a Gitea repository card', async() => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({
            full_name: 'nephatrine/discord-irc',
            description: 'A high-fidelity bridge between Discord and IRC.',
            html_url: 'https://code.nephatrine.net/nephatrine/discord-irc',
            language: 'TypeScript',
            stars_count: 0,
            forks_count: 0,
            open_issues_count: 0,
            owner: {
                login: 'nephatrine',
                avatar_url: 'https://code.nephatrine.net/avatars/example',
            },
        }));

        const preview = await resolvePagePreview(
            'https://code.nephatrine.net/nephatrine/discord-irc'
        );

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'gitea',
            providerName: 'NephatrineCode',
            title: 'nephatrine/discord-irc',
            description: 'A high-fidelity bridge between Discord and IRC. · ' +
                '0 stars · 0 forks · 0 issues · TypeScript',
            author: 'nephatrine',
            image: 'https://code.nephatrine.net/avatars/example',
            url: 'https://code.nephatrine.net/nephatrine/discord-irc',
        });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://code.nephatrine.net/api/v1/repos/nephatrine/discord-irc',
            expect.any(Object)
        );
    });

    it('gates web-disabled Gitea hosts to desktop', () => {
        delete window.kiwiDesktop;
        expect(Misc.getMediaInfo('https://gitea.com/gitea/act')).toMatchObject({
            type: 'metadata',
            provider: 'gitea',
        });
        expect(Misc.getMediaInfo('https://code.idtech.space/yquake2/yquake2').type)
            .toBe('');

        window.kiwiDesktop = {};
        expect(Misc.getMediaInfo('https://code.idtech.space/yquake2/yquake2'))
            .toMatchObject({
                type: 'metadata',
                provider: 'gitea',
            });
    });

    it('recognizes itch.io game URLs', () => {
        expect(parseItchGame(
            'https://donitz.itch.io/octoblast?secret=E1dijJSHtCCDoVwgwOOjafPeHU'
        )).toMatchObject({
            user: 'donitz',
            game: 'octoblast',
            webUrl: 'https://donitz.itch.io/octoblast',
        });
        expect(parseItchGame('https://itch.io/games')).toBe(null);
    });

    it('builds an itch.io card from page metadata', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <title>Octoblast-dev by Donitz</title>
                <meta name="twitter:title" content="Octoblast-dev by Donitz">
                <meta name="twitter:description" content="Play in your browser">
            </head></html>
        `));

        const url = 'https://donitz.itch.io/octoblast?secret=test';
        const preview = await resolvePagePreview(url);

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'itch',
            providerName: 'itch.io',
            title: 'Octoblast-dev by Donitz',
            description: 'Play in your browser',
            url,
            originalUrl: url,
        });
    });

    it('falls back to an itch.io URL title when the page fails', async() => {
        global.fetch = jest.fn().mockRejectedValue(new Error('rate limited'));

        const url = 'https://donitz.itch.io/octoblast?secret=test';
        const preview = await resolvePagePreview(url);

        expect(preview).toMatchObject({
            provider: 'itch',
            providerName: 'itch.io',
            title: 'Octoblast',
            description: 'itch.io game page',
            url,
            originalUrl: url,
        });
    });

    it('recognizes Amazon product URLs', () => {
        expect(parseAmazonProduct(
            'https://www.amazon.com/Noise-Cancelling-Headphones/dp/B08N5WRWNW/ref=sr_1_1'
        )).toEqual({
            asin: 'B08N5WRWNW',
            host: 'amazon.com',
            title: 'Noise Cancelling Headphones',
            url: 'https://www.amazon.com/dp/B08N5WRWNW',
        });
        expect(parseAmazonProduct(
            'https://www.amazon.co.uk/gp/product/B08N5WRWNW'
        )).toMatchObject({
            asin: 'B08N5WRWNW',
            host: 'amazon.co.uk',
            title: '',
            url: 'https://www.amazon.co.uk/dp/B08N5WRWNW',
        });
        expect(parseAmazonProduct(
            'https://www.amazon.com/gp/aw/d/B08N5WRWNW'
        )).toMatchObject({
            asin: 'B08N5WRWNW',
            title: '',
        });
        expect(parseAmazonProduct(
            'https://www.amazon.com/gp/product/glance/B08N5WRWNW'
        )).toMatchObject({
            asin: 'B08N5WRWNW',
            title: '',
        });
        expect(parseAmazonProduct(
            'https://www.amazon.com/dp/B08N5WRWNW?asin=B08N5WRWNW'
        )).toMatchObject({
            asin: 'B08N5WRWNW',
        });
        expect(parseAmazonProduct(
            'https://www.amazon.com/gp/product?asin=B08N5WRWNW'
        )).toMatchObject({
            asin: 'B08N5WRWNW',
        });
        expect(parseAmazonProduct('https://www.amazon.com/s?k=amazon')).toBe(null);
        expect(parseAmazonProduct('https://amzn.to/abc123')).toBe(null);
        expect(parseAmazonProduct('https://amazon.com.evil/dp/B08N5WRWNW')).toBe(null);

        const url = 'https://www.amazon.com/dp/B08N5WRWNW';
        delete window.kiwiDesktop;
        expect(Misc.getMediaInfo(url)).toMatchObject({
            type: 'metadata',
            provider: 'amazon',
            id: 'B08N5WRWNW',
        });

        window.kiwiDesktop = {};
        expect(Misc.getMediaInfo(url)).toMatchObject({
            type: 'metadata',
            provider: 'amazon',
            id: 'B08N5WRWNW',
        });
    });

    it('builds an Amazon card without fetching the product page', async() => {
        global.fetch = jest.fn();

        const url = 'https://www.amazon.com/Noise-Cancelling-Headphones/dp/B08N5WRWNW';
        const preview = await resolvePagePreview(url);

        expect(preview).toEqual({
            kind: 'card',
            provider: 'amazon',
            providerName: 'Amazon',
            title: 'Noise Cancelling Headphones',
            description: 'ASIN B08N5WRWNW',
            author: '',
            image: '',
            url: 'https://www.amazon.com/dp/B08N5WRWNW',
            originalUrl: url,
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses a generic Amazon title when the URL has no slug', async() => {
        global.fetch = jest.fn();

        const url = 'https://www.amazon.com/dp/B08N5WRWNW';
        const preview = await resolvePagePreview(url);

        expect(preview).toMatchObject({
            provider: 'amazon',
            title: 'Amazon Product',
            description: 'ASIN B08N5WRWNW',
            url: 'https://www.amazon.com/dp/B08N5WRWNW',
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('recognizes GameTracker server URLs', () => {
        expect(parseGameTrackerServer(
            'https://www.gametracker.com/server_info/nephatrine.net:27910/'
        )).toEqual({
            server: 'nephatrine.net:27910',
            bannerUrl: 'https://cache.gametracker.com/server_info/' +
                'nephatrine.net:27910/banner_560x95.png',
        });
        expect(parseGameTrackerServer(
            'https://www.gametracker.com/server_info/nephatrine.net:27910/b/'
        )).toBe(null);

        const url = 'https://www.gametracker.com/server_info/nephatrine.net:27910/';
        delete window.kiwiDesktop;
        expect(Misc.getMediaInfo(url).type).toBe('');

        window.kiwiDesktop = {};
        expect(Misc.getMediaInfo(url)).toMatchObject({
            type: 'metadata',
            provider: 'gametracker',
            id: 'nephatrine.net:27910',
        });
    });

    it('builds a GameTracker card with the server banner', async() => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(`
            <html><head>
                <title>NephQ2::ZigBot [q2] Quake 2</title>
            </head></html>
        `));

        const url = 'https://www.gametracker.com/server_info/nephatrine.net:27910/';
        const preview = await resolvePagePreview(url);

        expect(preview).toMatchObject({
            kind: 'card',
            provider: 'gametracker',
            providerName: 'GameTracker',
            title: 'NephQ2::ZigBot [q2] Quake 2',
            description: 'GameTracker server page',
            image: 'https://cache.gametracker.com/server_info/' +
                'nephatrine.net:27910/banner_560x95.png',
            imageLayout: 'banner',
            url,
            originalUrl: url,
        });
    });

    it('falls back to a banner-only GameTracker card', async() => {
        global.fetch = jest.fn().mockRejectedValue(new Error('blocked'));

        const url = 'https://www.gametracker.com/server_info/nephatrine.net:27910/';
        const preview = await resolvePagePreview(url);

        expect(preview).toMatchObject({
            provider: 'gametracker',
            title: 'nephatrine.net:27910',
            image: 'https://cache.gametracker.com/server_info/' +
                'nephatrine.net:27910/banner_560x95.png',
        });
    });

    it('gates generic metadata to desktop and known providers', () => {
        window.kiwiDesktop = {};

        expect(Misc.getMediaInfo('https://example.com/article').type).toBe('metadata');
        expect(Misc.getMediaInfo('https://example.com/article').provider).toBe('generic');
        expect(Misc.getMediaInfo('https://github.com/owner/repo').provider).toBe('github');
        expect(Misc.getMediaInfo('https://www.flickr.com/photos/user/123').type)
            .toBe('oembed');
    });
});
