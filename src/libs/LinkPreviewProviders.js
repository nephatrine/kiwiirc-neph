function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function humanizeSlug(value) {
    return String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function stripMarkdown(value) {
    return String(value || '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^[ \t]*#{1,6}[ \t]*/gm, ' ')
        .replace(/[*_~`>]/g, '')
        .replace(/\\/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodePathPart(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function stackExchangeInfo(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let site = '';
    if (host === 'stackoverflow.com') {
        site = 'stackoverflow';
    } else if (host === 'superuser.com') {
        site = 'superuser';
    } else if (host === 'serverfault.com') {
        site = 'serverfault';
    } else if (host === 'askubuntu.com') {
        site = 'askubuntu';
    } else if (host.endsWith('.stackexchange.com')) {
        site = host.slice(0, -'.stackexchange.com'.length);
    }

    const match = parsed.pathname.match(/\/questions\/(\d+)(?:\/|$)/);
    if (!site || !match) {
        return null;
    }

    return {
        id: match[1],
        site,
        providerName: site === 'stackoverflow' ? 'Stack Overflow' : 'Stack Exchange',
    };
}

function writeAsInfo(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const match = parsed.pathname.match(/^\/([^/?#]+)\/([^/?#]+)\/?$/);
    if (!match) {
        return null;
    }

    const collection = decodePathPart(match[1]);
    if (['api', 'about', 'login', 'signup'].includes(collection.toLowerCase())) {
        return null;
    }

    return {
        collection,
        slug: decodePathPart(match[2]),
    };
}

function lemmaInfo(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const match = parsed.pathname.match(/^\/(did:[^/?#]+)\/pub\/[^/?#]+\/([^/?#]+)\/?$/i);
    if (!match) {
        return null;
    }

    return {
        did: decodePathPart(match[1]),
        rkey: decodePathPart(match[2]),
    };
}

function fandomInfo(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const host = parsed.hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]+)\.fandom\.com$/);
    const titleMatch = parsed.pathname.match(/^\/wiki\/([^?#]+)/);
    if (!match || !titleMatch || match[1] === 'www') {
        return null;
    }

    return {
        host,
        title: decodePathPart(titleMatch[1]),
    };
}

const PROVIDERS = [
    {
        id: 'flickr',
        web: false,
        match: /^https?:\/\/(?:www\.)?flickr\.com\/photos\/[^/]+\/(?:\d+|albums\/\d+|sets\/\d+)/i,
        oembed: (url) => (
            `https://www.flickr.com/services/oembed/?format=json&url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'dailymotion',
        web: false,
        match: /^https?:\/\/(?:www\.)?dailymotion\.com\/video\/[a-z0-9]+/i,
        oembed: (url) => (
            `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'reddit',
        web: false,
        match: /^https?:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/(?:comments\/[a-z0-9]+|s\/[a-z0-9]+)/i,
        oembed: (url) => `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'slideshare',
        web: false,
        embedFromHtml: true,
        iframeHosts: ['slideshare.net', 'www.slideshare.net'],
        match: /^https?:\/\/(?:www\.)?slideshare\.net\/[^/]+\/[^/]+/i,
        oembed: (url) => (
            `https://www.slideshare.net/api/oembed/2?format=json&url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'speakerdeck',
        web: false,
        match: /^https?:\/\/(?:www\.)?speakerdeck\.com\/[^/]+\/[^/]+/i,
        oembed: (url) => (
            `https://speakerdeck.com/oembed.json?url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'wikipedia',
        web: true,
        match: /^https?:\/\/(?!www\.)([a-z-]+)(?:\.m)?\.wikipedia\.org\/wiki\/[^?#]+/i,
        oembed: (url) => {
            const parsed = new URL(url);
            const host = parsed.hostname.match(/^([a-z-]+)(?:\.m)?\.wikipedia\.org$/i);
            const title = decodePathPart(parsed.pathname.replace(/^\/wiki\//, ''));
            return `https://${host[1]}.wikipedia.org/api/rest_v1/page/summary/` +
                encodeURIComponent(title);
        },
        normalize: (data, provider, url) => {
            const title = firstValue(data.title || data.displaytitle);
            const description = firstValue(data.extract || data.description);
            const thumbnail = data.thumbnail && data.thumbnail.source;
            if (!title && !description && !thumbnail) {
                return null;
            }
            return {
                title,
                description,
                thumbnail_url: thumbnail,
                url: data.content_urls &&
                    data.content_urls.desktop &&
                    data.content_urls.desktop.page ?
                    data.content_urls.desktop.page :
                    url,
                provider_name: 'Wikipedia',
            };
        },
    },
    {
        id: 'archive',
        web: true,
        match: /^https?:\/\/(?:www\.)?archive\.org\/details\/([^/?#]+)/i,
        oembed: (url) => {
            const parsed = new URL(url);
            const match = parsed.pathname.match(/^\/details\/([^/?#]+)/i);
            return `https://archive.org/metadata/${encodeURIComponent(decodePathPart(match[1]))}`;
        },
        normalize: (data, provider, url) => {
            const metadata = data.metadata || {};
            const parsed = new URL(url);
            const match = parsed.pathname.match(/^\/details\/([^/?#]+)/i);
            const identifier = match ? decodePathPart(match[1]) : '';
            const title = firstValue(metadata.title);
            const description = firstValue(metadata.description);
            const creator = firstValue(metadata.creator);
            if (!title && !description) {
                return null;
            }
            return {
                title: title || identifier,
                description,
                author_name: creator,
                thumbnail_url: identifier ?
                    `https://archive.org/services/img/${encodeURIComponent(identifier)}` :
                    '',
                url,
                provider_name: 'Internet Archive',
            };
        },
    },
    {
        id: 'stackexchange',
        web: true,
        match: /^https?:\/\/(?:www\.)?(?:stackoverflow|superuser|serverfault|askubuntu)\.com\/questions\/\d+|^https?:\/\/[a-z0-9-]+\.stackexchange\.com\/questions\/\d+/i,
        oembed: (url) => {
            const info = stackExchangeInfo(url);
            return `https://api.stackexchange.com/2.3/questions/${info.id}` +
                `?site=${encodeURIComponent(info.site)}`;
        },
        normalize: (data, provider, url) => {
            const item = data.items && data.items[0];
            if (!item) {
                return null;
            }
            const info = stackExchangeInfo(url);
            const metrics = [];
            if (Number.isFinite(item.score)) {
                metrics.push(`${item.score} score`);
            }
            if (Number.isFinite(item.answer_count)) {
                metrics.push(`${item.answer_count} answers`);
            }
            return {
                title: item.title,
                description: metrics.join(' · ') || 'Stack Exchange question',
                author_name: item.owner && item.owner.display_name,
                thumbnail_url: '',
                url: item.link || url,
                provider_name: info ? info.providerName : 'Stack Exchange',
            };
        },
    },
    {
        id: 'fandom',
        web: true,
        match: /^https?:\/\/(?!www\.)[a-z0-9-]+\.fandom\.com\/wiki\/[^?#]+/i,
        oembed: (url) => {
            const info = fandomInfo(url);
            return `https://${info.host}/api.php?action=query&format=json` +
                `&titles=${encodeURIComponent(info.title)}&prop=pageimages%7Cpageprops` +
                '&ppprop=description&redirects=1&origin=*';
        },
        normalize: (data, provider, url) => {
            const pages = data.query && data.query.pages;
            if (!pages) {
                return null;
            }
            const page = pages[Object.keys(pages)[0]];
            if (!page || page.missing !== undefined) {
                return null;
            }
            return {
                title: page.title,
                description: page.pageprops && page.pageprops.description,
                thumbnail_url: page.thumbnail && page.thumbnail.source,
                url,
                provider_name: 'Fandom',
            };
        },
    },
    {
        id: 'x',
        web: true,
        match: /^https?:\/\/(?:(?:www|mobile)\.)?(?:x|twitter)\.com\/[a-z0-9_]+\/status\/\d+/i,
        oembed: (url) => (
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&format=json`
        ),
        normalize: (data, provider, url) => {
            const author = firstValue(data.author_name);
            if (!author && !data.url) {
                return null;
            }
            return {
                title: author ? `Post by ${author}` : 'X Post',
                description: '',
                author_name: author,
                thumbnail_url: '',
                url: data.url || url,
                provider_name: 'X',
            };
        },
    },
    {
        id: 'writeas',
        web: true,
        match: /^https?:\/\/write\.as\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/i,
        oembed: (url) => {
            const info = writeAsInfo(url);
            return `https://write.as/api/collections/${encodeURIComponent(info.collection)}` +
                `/posts/${encodeURIComponent(info.slug)}`;
        },
        normalize: (data, provider, url) => {
            const post = data.data;
            if (!post) {
                return null;
            }

            const body = String(post.body || '');
            let title = String(post.title || '').trim();
            if (!title) {
                const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                const firstLine = lines.find((line) => !/^!\[[^\]]*\]\([^)]*\)$/.test(line));
                title = stripMarkdown(firstLine || '');
            }
            if (!title) {
                title = humanizeSlug(post.slug);
            }

            let description = stripMarkdown(body);
            if (title && description.toLowerCase().startsWith(title.toLowerCase())) {
                description = description.slice(title.length).trim();
            }
            const imageMatch = body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
            if (!title && !description && !imageMatch) {
                return null;
            }

            return {
                title,
                description,
                thumbnail_url: imageMatch ? imageMatch[1] : '',
                url,
                provider_name: 'Write.as',
            };
        },
    },
    {
        id: 'lemma',
        web: true,
        match: /^https?:\/\/(?:www\.)?lemma\.pub\/did:[^/?#]+\/pub\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/i,
        oembed: (url) => {
            const info = lemmaInfo(url);
            return 'https://api.lemma.pub/posts/content' +
                `?did=${encodeURIComponent(info.did)}` +
                `&rkey=${encodeURIComponent(info.rkey)}`;
        },
        normalize: (data, provider, url) => {
            const title = firstValue(data.title);
            const description = stripMarkdown(firstValue(data.content));
            if (!title && !description) {
                return null;
            }
            return {
                title: title || 'Lemma Post',
                description,
                thumbnail_url: '',
                url,
                provider_name: 'Lemma',
            };
        },
    },
];

const FALLBACK_PROVIDERS = [
    {
        id: 'youtube',
        match: /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i,
        oembed: (url) => (
            `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        ),
    },
    {
        id: 'vimeo',
        match: /^https?:\/\/(?:www\.)?vimeo\.com\/|^https?:\/\/player\.vimeo\.com\//i,
        oembed: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'ted',
        match: /^https?:\/\/(?:www\.)?ted\.com\/(?:talks|dubbing)\//i,
        oembed: (url) => (
            `https://www.ted.com/services/v1/oembed.json?url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'mixcloud',
        match: /^https?:\/\/(?:www\.)?mixcloud\.com\//i,
        oembed: (url) => (
            `https://www.mixcloud.com/oembed/?url=${encodeURIComponent(url)}&format=json`
        ),
    },
    {
        id: 'wistia',
        match: /^https?:\/\/(?:[a-z0-9-]+\.)*wistia\.com\/|^https?:\/\/fast\.wistia\.net\//i,
        oembed: (url) => `https://fast.wistia.com/oembed?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'loom',
        match: /^https?:\/\/(?:www\.)?loom\.com\//i,
        oembed: (url) => `https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'art19',
        match: /^https?:\/\/(?:www\.)?art19\.com\/shows\//i,
        oembed: (url) => `https://art19.com/oembed.json?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'pinterest',
        match: /^https?:\/\/(?:www\.)?pinterest\./i,
        oembed: (url) => (
            `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'tiktok',
        match: /^https?:\/\/(?:www\.)?tiktok\.com\//i,
        oembed: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'soundcloud',
        match: /^https?:\/\/(?:www\.)?soundcloud\.com\//i,
        oembed: (url) => (
            `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
        ),
    },
    {
        id: 'spotify',
        match: /^https?:\/\/open\.spotify\.com\//i,
        oembed: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    },
    {
        id: 'giphy',
        match: /^https?:\/\/(?:www\.)?giphy\.com\//i,
        oembed: (url) => `https://giphy.com/services/oembed?url=${encodeURIComponent(url)}`,
    },
];

export function getLinkPreviewProvider(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    return PROVIDERS.find((provider) => provider.match.test(url)) || null;
}

export function getOEmbedFallbackProvider(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    return FALLBACK_PROVIDERS.find((provider) => provider.match.test(url)) || null;
}

export function getLinkPreviewProviders() {
    return PROVIDERS;
}
