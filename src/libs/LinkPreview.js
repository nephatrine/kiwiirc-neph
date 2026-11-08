import { desktopFetch, isDesktop } from '@/libs/desktop/Http';
import * as Misc from '@/helpers/Misc';
import {
    getLinkPreviewProvider,
    getOEmbedFallbackProvider
} from './LinkPreviewProviders';
import { isWebGenericHost, resolvePagePreview } from './PagePreview';

const CACHE_LIMIT = 100;
const cache = new Map();

function cleanText(value, maxLength) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function extractEmbed(data, provider, originalUrl) {
    if (!provider.embedFromHtml || !provider.iframeHosts || !data || !data.html) {
        return null;
    }

    if (typeof DOMParser === 'undefined') {
        return null;
    }

    let parsedDocument;
    try {
        parsedDocument = new DOMParser().parseFromString(String(data.html), 'text/html');
    } catch {
        return null;
    }

    const iframe = parsedDocument.querySelector('iframe[src]');
    if (!iframe) {
        return null;
    }

    let src = iframe.getAttribute('src') || '';
    if (src.startsWith('//')) {
        src = 'https:' + src;
    }
    if (!/^https:\/\//i.test(src)) {
        return null;
    }

    let host;
    try {
        host = new URL(src).hostname.toLowerCase();
    } catch {
        return null;
    }

    const allowedHosts = provider.iframeHosts.map((value) => value.toLowerCase());
    if (!allowedHosts.includes(host)) {
        return null;
    }

    const width = Number(data.width) || Number(iframe.getAttribute('width'));
    const height = Number(data.height) || Number(iframe.getAttribute('height'));

    return {
        kind: 'embed',
        provider: provider.id,
        providerName: cleanText(data.provider_name, 80) || provider.id,
        title: cleanText(data.title, 300),
        embedUrl: src,
        aspectRatio: width > 0 && height > 0 ? `${width} / ${height}` : '',
        originalUrl,
    };
}

function normalizeResult(data, provider, originalUrl) {
    const embed = extractEmbed(data, provider, originalUrl);
    if (embed) {
        return embed;
    }

    const image = Misc.sanitizeUrl(data.thumbnail_url || data.thumbnail || '');

    return {
        kind: 'card',
        provider: provider.id,
        providerName: cleanText(data.provider_name, 80) || provider.id,
        title: cleanText(data.title, 300),
        description: cleanText(data.description, 600),
        author: cleanText(data.author_name, 160),
        image,
        url: Misc.sanitizeUrl(data.url || originalUrl),
        originalUrl,
    };
}

function remember(url, card) {
    if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(url, card);
}

function fetchPreviewJson(endpoint) {
    return desktopFetch(endpoint, {
        headers: {
            Accept: 'application/json',
        },
    }).then(async(response) => {
        if (!response || !response.ok) {
            throw new Error('link preview request failed');
        }

        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('invalid link preview response');
        }

        return data;
    });
}

function normalizeProviderResult(data, provider, url) {
    const normalized = provider.normalize ?
        provider.normalize(data, provider, url) :
        data;
    if (!normalized || typeof normalized !== 'object') {
        throw new Error('invalid link preview response');
    }
    return normalizeResult(normalized, provider, url);
}

function resolveWithProvider(provider, url) {
    let endpoint;
    try {
        endpoint = provider.fetchUrl ? provider.fetchUrl(url) : provider.oembed(url);
    } catch {
        endpoint = provider.oembed(url);
    }

    return Promise.resolve(endpoint).then((resolvedEndpoint) => (
        fetchPreviewJson(resolvedEndpoint)
    )).then((data) => {
        const card = normalizeProviderResult(data, provider, url);
        remember(url, card);
        return card;
    });
}

function resolveOEmbedFallback(provider, url) {
    return fetchPreviewJson(provider.oembed(url)).then((data) => {
        const card = normalizeResult(data, provider, url);
        remember(url, card);
        return card;
    });
}

function resolvePageFallback(url) {
    return resolvePagePreview(url).then((preview) => {
        remember(url, preview);
        return preview;
    });
}

export function clearLinkPreviewCache() {
    cache.clear();
}

export function isLinkPreviewSupported(url) {
    return !!getLinkPreviewProvider(url);
}

export function resolveEmbedFallback(url) {
    if (cache.has(url)) {
        return Promise.resolve(cache.get(url));
    }

    const provider = getOEmbedFallbackProvider(url);
    const tierB = provider ?
        resolveOEmbedFallback(provider, url) :
        Promise.reject(new Error('no embed fallback provider'));

    return tierB.catch((err) => {
        if (!isDesktop() && !isWebGenericHost(url)) {
            throw err;
        }

        return resolvePageFallback(url).catch(() => {
            throw err;
        });
    });
}

export function resolveLinkPreview(url) {
    const provider = getLinkPreviewProvider(url);
    if (!provider) {
        return Promise.reject(new Error('unsupported link preview provider'));
    }

    if (cache.has(url)) {
        return Promise.resolve(cache.get(url));
    }

    return resolveWithProvider(provider, url).catch((err) => {
        if (!provider.oembed) {
            throw err;
        }

        if (!provider.fetchUrl) {
            return resolvePageFallback(url).catch(() => {
                throw err;
            });
        }

        return resolveOEmbedFallback(provider, url).catch((oembedErr) => (
            resolvePageFallback(url).catch(() => {
                throw oembedErr;
            })
        ));
    });
}
