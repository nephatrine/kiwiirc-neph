import { desktopFetch, isDesktop } from '@/libs/desktop/Http';

const CACHE_LIMIT = 100;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_OEMBED_BYTES = 256 * 1024;
const MAX_JSON_LD_BYTES = 200 * 1024;
const WEB_GENERIC_HOSTS = new Set([
    'npr.org',
    'foxnews.com',
    'independent.co.uk',
    'dw.com',
    'w3.org',
    'apache.org',
]);
const GITHUB_RESERVED = new Set([
    'about', 'account', 'actions', 'apps', 'archive', 'blame', 'blob', 'blog',
    'branches', 'codespaces', 'collections', 'commit', 'commits', 'compare',
    'contact', 'customer-stories', 'dashboard', 'discussions', 'download',
    'edit', 'education', 'enterprise', 'events', 'explore', 'features', 'find',
    'government', 'graphs', 'home', 'issues', 'join', 'labels', 'login',
    'marketplace', 'milestones', 'mobile', 'network', 'new', 'nonprofit',
    'notifications', 'open-source', 'organizations', 'orgs', 'packages',
    'partners', 'pricing', 'projects', 'pulls', 'raw', 'readme', 'releases',
    'resources', 'search', 'security', 'settings', 'signup', 'site', 'solutions',
    'sponsors', 'tags', 'team', 'topics', 'tree', 'trending', 'users', 'welcome',
    'wiki',
]);

const GITEA_HOSTS = {
    'gitea.com': { name: 'Gitea', web: true },
    'codeberg.org': { name: 'Codeberg', web: true },
    'code.nephatrine.net': { name: 'NephatrineCode', web: true },
    'code.idtech.space': { name: 'code.idtech.space', web: false },
};
const GITEA_RESERVED = new Set([
    'about', 'actions', 'activity', 'admin', 'api', 'assets', 'avatars',
    'branches', 'commits', 'dashboard', 'explore', 'favicon.ico', 'forks',
    'help', 'hooks', 'issues', 'labels', 'login', 'marketplace', 'milestones',
    'migrate', 'new', 'notifications', 'orgs', 'organizations', 'packages',
    'projects', 'pulls', 'repo', 'repo-avatars', 'repos', 'robots.txt',
    'runners', 'search', 'settings', 'signup', 'stars', 'teams', 'user',
    'users', 'watchers', 'webhooks', 'wiki',
]);
const BITBUCKET_RESERVED = new Set([
    'about', 'account', 'admin', 'apps', 'blog', 'careers', 'contact',
    'dashboard', 'downloads', 'explore', 'features', 'hosting', 'integrations',
    'legal', 'login', 'marketplace', 'new', 'oauth', 'plugins', 'pricing',
    'privacy', 'product', 'repo', 'search', 'security', 'signup', 'site',
    'snippets', 'status', 'support', 'terms', 'topics', 'trust', 'users',
    'workspace',
]);
const GITLAB_RESERVED = new Set([
    '-', 'about', 'abuse_reports', 'admin', 'api', 'assets', 'billing', 'blog',
    'dashboard', 'explore', 'favicon.ico', 'features', 'groups', 'help',
    'ide', 'import', 'invites', 'jobs', 'login', 'marketplace', 'new',
    'notifications', 'oauth', 'pricing', 'privacy', 'profile', 'projects',
    'public', 'robots.txt', 'search', 'security', 'session', 'settings',
    'signup', 'sitemap.xml', 'snippets', 'subscriptions', 'team', 'teams',
    'terms', 'topics', 'unsubscribe', 'uploads', 'users',
]);
const ITCH_RESERVED = new Set([
    'about', 'api', 'assets', 'bundle', 'bundles', 'collections', 'community',
    'dashboard', 'docs', 'games', 'help', 'jam', 'jams', 'login', 'new',
    'profile', 'register', 'search', 'settings', 'support', 'tags', 'upload',
]);
const AMAZON_HOSTS = new Set([
    'amazon.com',
    'amazon.co.uk',
    'amazon.ca',
    'amazon.com.au',
    'amazon.co.jp',
    'amazon.in',
    'amazon.de',
    'amazon.fr',
    'amazon.it',
    'amazon.es',
    'amazon.nl',
    'amazon.se',
    'amazon.pl',
    'amazon.ie',
    'amazon.com.be',
    'amazon.com.mx',
    'amazon.com.br',
    'amazon.sg',
    'amazon.ae',
    'amazon.sa',
    'amazon.com.tr',
    'amazon.eg',
    'amazon.co.za',
]);

const cache = new Map();

function cleanText(value, maxLength) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

export function isWebGenericHost(url) {
    if (typeof url !== 'string' || !url) {
        return false;
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return WEB_GENERIC_HOSTS.has(host);
}

function sanitizeHttpUrl(value, base) {
    if (!value) {
        return '';
    }

    try {
        const resolved = new URL(String(value), base);
        return resolved.protocol === 'http:' || resolved.protocol === 'https:' ?
            resolved.toString() :
            '';
    } catch {
        return '';
    }
}

function metaMap(doc) {
    const values = Object.create(null);
    Array.from(doc.querySelectorAll('meta[property], meta[name]')).forEach((meta) => {
        const key = (meta.getAttribute('property') || meta.getAttribute('name') || '')
            .toLowerCase();
        const content = meta.getAttribute('content');
        if (key && content && !values[key]) {
            values[key] = content;
        }
    });
    return values;
}

function firstMeta(meta, keys) {
    for (let i = 0; i < keys.length; i++) {
        if (meta[keys[i]]) {
            return meta[keys[i]];
        }
    }
    return '';
}

function jsonLdItems(doc) {
    const items = [];
    Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
        .slice(0, 8)
        .forEach((script) => {
            const text = String(script.textContent || '').trim();
            if (!text || text.length > MAX_JSON_LD_BYTES) {
                return;
            }

            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch {
                return;
            }

            const visit = (value) => {
                if (Array.isArray(value)) {
                    value.forEach(visit);
                    return;
                }
                if (!value || typeof value !== 'object') {
                    return;
                }
                if (value['@graph']) {
                    visit(value['@graph']);
                }
                if (value.headline || value.name || value.description || value.image) {
                    items.push(value);
                }
            };
            visit(parsed);
        });
    return items;
}

function jsonLdValue(value) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = jsonLdValue(value[i]);
            if (result) {
                return result;
            }
        }
        return '';
    }
    if (value && typeof value === 'object') {
        return value.name || value.url || value.contentUrl || '';
    }
    return value ? String(value) : '';
}

function jsonLdImage(value) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = jsonLdImage(value[i]);
            if (result) {
                return result;
            }
        }
        return '';
    }
    if (value && typeof value === 'object') {
        return value.url || value.contentUrl || '';
    }
    return value ? String(value) : '';
}

function oembedEndpoint(html, pageUrl) {
    if (typeof DOMParser === 'undefined') {
        return null;
    }

    let doc;
    try {
        doc = new DOMParser().parseFromString(html, 'text/html');
    } catch {
        return null;
    }

    const links = Array.from(doc.querySelectorAll('link[rel~="alternate"][href]'));
    for (let i = 0; i < links.length; i++) {
        const type = String(links[i].getAttribute('type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        let format = '';
        if (type === 'application/json+oembed') {
            format = 'json';
        } else if (type === 'text/xml+oembed' || type === 'application/xml+oembed') {
            format = 'xml';
        }
        if (!format) {
            continue;
        }

        const endpoint = sanitizeHttpUrl(links[i].getAttribute('href'), pageUrl);
        if (!endpoint) {
            continue;
        }

        try {
            const parsed = new URL(endpoint);
            if (parsed.username || parsed.password) {
                continue;
            }
        } catch {
            continue;
        }

        return { endpoint, format };
    }

    return null;
}

function normalizeOEmbed(data, originalUrl) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const title = cleanText(data.title, 300);
    const description = cleanText(data.description, 600);
    const image = sanitizeHttpUrl(data.thumbnail_url || data.thumbnail, originalUrl);
    if (!title && !description && !image) {
        return null;
    }

    return {
        kind: 'card',
        provider: 'oembed',
        providerName: cleanText(data.provider_name, 80) || 'oEmbed',
        title,
        description,
        author: cleanText(data.author_name, 160),
        image,
        url: sanitizeHttpUrl(data.url, originalUrl) || originalUrl,
        originalUrl,
    };
}

function xmlOEmbedData(doc) {
    if (!doc || doc.querySelector('parsererror')) {
        return null;
    }

    const value = (tag) => {
        const node = doc.getElementsByTagName(tag)[0];
        return node ? node.textContent : '';
    };

    return {
        title: value('title'),
        description: value('description'),
        author_name: value('author_name'),
        provider_name: value('provider_name'),
        thumbnail_url: value('thumbnail_url'),
        url: value('url'),
    };
}

function fetchOEmbed(discovery, originalUrl) {
    const accept = discovery.format === 'xml' ?
        'application/xml,text/xml' :
        'application/json';
    return desktopFetch(discovery.endpoint, {
        headers: {
            Accept: accept,
        },
        maxResponseBytes: MAX_OEMBED_BYTES,
    }).then(async(response) => {
        if (!response || !response.ok) {
            throw new Error('oEmbed request failed');
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const text = await readTextWithLimit(response, MAX_OEMBED_BYTES);
        let data;
        if (discovery.format === 'xml') {
            if (contentType && !/xml/.test(contentType)) {
                throw new Error('oEmbed response is not XML');
            }
            const doc = new DOMParser().parseFromString(text, 'application/xml');
            data = xmlOEmbedData(doc);
        } else {
            if (contentType && !/json/.test(contentType)) {
                throw new Error('oEmbed response is not JSON');
            }
            data = JSON.parse(text);
        }

        const preview = normalizeOEmbed(data, originalUrl);
        if (!preview) {
            throw new Error('invalid oEmbed preview');
        }
        return preview;
    });
}

function normalizePage(html, pageUrl) {
    if (typeof DOMParser === 'undefined') {
        return null;
    }

    let parsedDocument;
    try {
        parsedDocument = new DOMParser().parseFromString(html, 'text/html');
    } catch {
        return null;
    }

    const meta = metaMap(parsedDocument);
    const jsonLd = jsonLdItems(parsedDocument);
    const jsonItem = jsonLd.find((item) => item.headline || item.name) || jsonLd[0] || {};

    const title = cleanText(
        firstMeta(meta, ['og:title', 'twitter:title']) ||
            jsonItem.headline ||
            jsonItem.name ||
            parsedDocument.title,
        300
    );
    if (!title) {
        return null;
    }

    const description = cleanText(
        firstMeta(meta, ['og:description', 'twitter:description', 'description']) ||
            jsonItem.description,
        600
    );
    const author = cleanText(
        firstMeta(meta, ['author', 'article:author', 'twitter:creator']) ||
            jsonLdValue(jsonItem.author),
        160
    );
    const siteName = cleanText(
        firstMeta(meta, ['og:site_name', 'application-name']) ||
            jsonLdValue(jsonItem.publisher),
        80
    );
    const image = sanitizeHttpUrl(
        firstMeta(meta, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) ||
            jsonLdImage(jsonItem.image),
        pageUrl
    );

    const canonicalElement = parsedDocument.querySelector('link[rel="canonical"]');
    const canonical = sanitizeHttpUrl(
        (canonicalElement && canonicalElement.getAttribute('href')) ||
            firstMeta(meta, ['og:url']) ||
            pageUrl,
        pageUrl
    ) || pageUrl;

    let hostname = '';
    try {
        hostname = new URL(pageUrl).hostname.replace(/^www\./i, '');
    } catch {
        hostname = '';
    }

    return {
        kind: 'card',
        provider: 'metadata',
        providerName: siteName || hostname || 'Link',
        title,
        description,
        author,
        image,
        url: canonical,
        originalUrl: pageUrl,
    };
}

export function parseGameTrackerServer(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = url.match(
        /^https?:\/\/(?:www\.)?gametracker\.com\/server_info\/([a-z0-9.-]+:\d+)\/?(?:[?#].*)?$/i
    );
    if (!match) {
        return null;
    }

    return {
        server: match[1],
        bannerUrl: `https://cache.gametracker.com/server_info/${match[1]}/banner_560x95.png`,
    };
}

export function parseGiteaRepo(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = url.match(
        /^https?:\/\/([^/?#]+)\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/?(?:[?#].*)?$/i
    );
    if (!match) {
        return null;
    }

    const host = match[1].toLowerCase().replace(/^www\./i, '');
    const config = GITEA_HOSTS[host];
    if (!config) {
        return null;
    }

    const owner = match[2];
    const repo = match[3].replace(/\.git$/i, '');
    if (!repo ||
        GITEA_RESERVED.has(owner.toLowerCase()) ||
        GITEA_RESERVED.has(repo.toLowerCase())) {
        return null;
    }

    return {
        host,
        name: config.name,
        web: config.web,
        owner,
        repo,
        apiUrl: `https://${host}/api/v1/repos/${owner}/${repo}`,
        webUrl: `https://${host}/${owner}/${repo}`,
    };
}

export function parseBitbucketRepo(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = url.match(
        /^https?:\/\/(?:www\.)?bitbucket\.org\/([^/?#]+)\/([^/?#]+)(?:[/?#].*)?$/i
    );
    if (!match) {
        return null;
    }

    const workspace = match[1];
    const repo = match[2].replace(/\.git$/i, '');
    if (!repo ||
        BITBUCKET_RESERVED.has(workspace.toLowerCase()) ||
        BITBUCKET_RESERVED.has(repo.toLowerCase())) {
        return null;
    }

    return {
        workspace,
        repo,
        apiUrl: `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}`,
        webUrl: `https://bitbucket.org/${workspace}/${repo}`,
    };
}

export function parseGitLabRepo(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.hostname.toLowerCase().replace(/^www\./i, '') !== 'gitlab.com') {
        return null;
    }

    const marker = parsed.pathname.indexOf('/-/');
    const pathname = marker === -1 ? parsed.pathname : parsed.pathname.slice(0, marker);
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2 || GITLAB_RESERVED.has(segments[0].toLowerCase())) {
        return null;
    }

    const project = segments[segments.length - 1].replace(/\.git$/i, '');
    if (!project) {
        return null;
    }
    segments[segments.length - 1] = project;

    const projectPath = segments.join('/');
    return {
        projectPath,
        namespace: segments.slice(0, -1).join('/'),
        project,
        apiUrl: `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}`,
        webUrl: `https://gitlab.com/${projectPath}`,
    };
}

export function parseItchGame(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = url.match(
        /^https?:\/\/([a-z0-9-]+)\.itch\.io\/([a-z0-9-]+)\/?(?:[?#].*)?$/i
    );
    if (!match) {
        return null;
    }

    const user = match[1];
    const game = match[2];
    if (ITCH_RESERVED.has(user.toLowerCase()) || ITCH_RESERVED.has(game.toLowerCase())) {
        return null;
    }

    return {
        user,
        game,
        webUrl: `https://${user}.itch.io/${game}`,
    };
}

export function parseAmazonProduct(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^(?:www|smile|m)\./, '');
    if (!AMAZON_HOSTS.has(host)) {
        return null;
    }

    const path = parsed.pathname;
    if (/^\/(?:s|gp\/search|gp\/cart|gp\/buy|gp\/help)(?:[/?#]|$)/i.test(path)) {
        return null;
    }

    let asin = '';
    const marker = path.match(
        /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|product-reviews)\/(.+)$/i
    );
    if (marker) {
        const parts = marker[1].split('/').filter(Boolean);
        const candidate = parts.find((part) => /^[A-Z0-9]{10}$/i.test(part));
        if (candidate) {
            asin = candidate.toUpperCase();
        }
    }

    if (!asin) {
        const queryAsin = parsed.searchParams.get('asin') ||
            parsed.searchParams.get('ASIN') ||
            parsed.searchParams.get('ASIN.1');
        if (queryAsin && /^[A-Z0-9]{10}$/i.test(queryAsin)) {
            asin = queryAsin.toUpperCase();
        }
    }

    if (!asin) {
        return null;
    }

    let title = '';
    const segments = path.split('/').filter(Boolean);
    const dpIndex = segments.findIndex((part) => part.toLowerCase() === 'dp');
    if (dpIndex > 0) {
        try {
            title = humanizeSlug(decodeURIComponent(segments[dpIndex - 1]));
        } catch {
            title = humanizeSlug(segments[dpIndex - 1]);
        }
    }

    return {
        asin,
        host,
        title,
        url: `https://www.${host}/dp/${asin}`,
    };
}

export function parseGitHubRepo(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = url.match(
        /^https?:\/\/(?:www\.)?github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/?(?:[?#].*)?$/i
    );
    if (!match) {
        return null;
    }

    const owner = match[1];
    const repo = match[2];
    if (GITHUB_RESERVED.has(owner.toLowerCase()) || GITHUB_RESERVED.has(repo.toLowerCase())) {
        return null;
    }

    return {
        owner,
        repo,
        apiUrl: `https://api.github.com/repos/${owner}/${repo}`,
        webUrl: `https://github.com/${owner}/${repo}`,
    };
}

function normalizeGitHub(data, originalUrl) {
    if (!data || typeof data !== 'object' || data.message) {
        return null;
    }

    const repo = parseGitHubRepo(originalUrl);
    if (!repo) {
        return null;
    }

    const metrics = [];
    if (Number.isFinite(data.stargazers_count)) {
        metrics.push(`${data.stargazers_count} stars`);
    }
    if (Number.isFinite(data.forks_count)) {
        metrics.push(`${data.forks_count} forks`);
    }
    if (data.language) {
        metrics.push(data.language);
    }

    const description = [
        cleanText(data.description, 400),
        cleanText(metrics.join(' · '), 160),
    ].filter(Boolean).join(' · ');

    return {
        kind: 'card',
        provider: 'github',
        providerName: 'GitHub',
        title: cleanText(data.full_name, 300) || `${repo.owner}/${repo.repo}`,
        description,
        author: cleanText(data.owner && data.owner.login, 160),
        image: sanitizeHttpUrl(data.owner && data.owner.avatar_url, 'https://github.com/'),
        url: sanitizeHttpUrl(data.html_url, 'https://github.com/') || repo.webUrl,
        originalUrl,
    };
}

function normalizeGitea(data, originalUrl) {
    if (!data || typeof data !== 'object' || data.message) {
        return null;
    }

    const repo = parseGiteaRepo(originalUrl);
    if (!repo) {
        return null;
    }

    const metrics = [];
    if (Number.isFinite(data.stars_count)) {
        metrics.push(`${data.stars_count} stars`);
    }
    if (Number.isFinite(data.forks_count)) {
        metrics.push(`${data.forks_count} forks`);
    }
    if (Number.isFinite(data.open_issues_count)) {
        metrics.push(`${data.open_issues_count} issues`);
    }
    if (data.language) {
        metrics.push(data.language);
    }

    const description = [
        cleanText(data.description, 400),
        cleanText(metrics.join(' · '), 200),
    ].filter(Boolean).join(' · ');

    return {
        kind: 'card',
        provider: 'gitea',
        providerName: repo.name,
        title: cleanText(data.full_name, 300) || `${repo.owner}/${repo.repo}`,
        description,
        author: cleanText(data.owner && data.owner.login, 160),
        image: sanitizeHttpUrl(
            data.avatar_url || (data.owner && data.owner.avatar_url),
            `https://${repo.host}/`
        ),
        url: sanitizeHttpUrl(data.html_url, `https://${repo.host}/`) || repo.webUrl,
        originalUrl,
    };
}

function normalizeBitbucket(data, originalUrl) {
    if (!data || typeof data !== 'object' || data.message) {
        return null;
    }

    const repo = parseBitbucketRepo(originalUrl);
    if (!repo) {
        return null;
    }

    const metrics = [];
    if (data.language) {
        metrics.push(data.language);
    }
    if (data.mainbranch && data.mainbranch.name) {
        metrics.push(data.mainbranch.name);
    }

    return {
        kind: 'card',
        provider: 'bitbucket',
        providerName: 'Bitbucket',
        title: cleanText(data.full_name, 300) || `${repo.workspace}/${repo.repo}`,
        description: [
            cleanText(data.description, 400),
            cleanText(metrics.join(' · '), 160),
        ].filter(Boolean).join(' · '),
        author: cleanText(
            data.owner && (data.owner.display_name || data.owner.username),
            160
        ),
        image: sanitizeHttpUrl(
            data.links && data.links.avatar && data.links.avatar.href,
            'https://bitbucket.org/'
        ),
        url: sanitizeHttpUrl(
            data.links && data.links.html && data.links.html.href,
            'https://bitbucket.org/'
        ) || repo.webUrl,
        originalUrl,
    };
}

function normalizeGitLab(data, originalUrl) {
    if (!data || typeof data !== 'object' || data.message) {
        return null;
    }

    const repo = parseGitLabRepo(originalUrl);
    if (!repo) {
        return null;
    }

    const metrics = [];
    if (Number.isFinite(data.star_count)) {
        metrics.push(`${data.star_count} stars`);
    }
    if (Number.isFinite(data.forks_count)) {
        metrics.push(`${data.forks_count} forks`);
    }
    if (data.default_branch) {
        metrics.push(data.default_branch);
    }

    return {
        kind: 'card',
        provider: 'gitlab',
        providerName: 'GitLab',
        title: cleanText(data.name_with_namespace, 300) ||
            cleanText(data.path_with_namespace, 300) ||
            repo.projectPath,
        description: [
            cleanText(data.description, 400),
            cleanText(metrics.join(' · '), 160),
        ].filter(Boolean).join(' · '),
        author: cleanText(data.namespace && data.namespace.name, 160),
        image: sanitizeHttpUrl(
            data.avatar_url || (data.namespace && data.namespace.avatar_url),
            'https://gitlab.com/'
        ),
        url: sanitizeHttpUrl(data.web_url, 'https://gitlab.com/') || repo.webUrl,
        originalUrl,
    };
}

function humanizeSlug(value) {
    return String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function itchFallbackCard(game, originalUrl) {
    return {
        kind: 'card',
        provider: 'itch',
        providerName: 'itch.io',
        title: humanizeSlug(game.game) || game.game,
        description: 'itch.io game page',
        author: game.user,
        image: '',
        url: originalUrl,
        originalUrl,
    };
}

function resolveItch(game, originalUrl) {
    return fetchHtml(originalUrl).then((html) => {
        const preview = normalizePage(html, originalUrl);
        return {
            kind: 'card',
            provider: 'itch',
            providerName: 'itch.io',
            title: preview && preview.title ?
                preview.title :
                humanizeSlug(game.game),
            description: preview && preview.description ?
                preview.description :
                'itch.io game page',
            author: preview && preview.author ? preview.author : game.user,
            image: preview ? preview.image : '',
            url: originalUrl,
            originalUrl,
        };
    }).catch(() => itchFallbackCard(game, originalUrl));
}

function amazonCard(product, originalUrl) {
    return {
        kind: 'card',
        provider: 'amazon',
        providerName: 'Amazon',
        title: cleanText(product.title, 300) || 'Amazon Product',
        description: `ASIN ${product.asin}`,
        author: '',
        image: '',
        url: product.url,
        originalUrl,
    };
}

function gameTrackerCard(server, bannerUrl, title, pageUrl) {
    return {
        kind: 'card',
        provider: 'gametracker',
        providerName: 'GameTracker',
        title: cleanText(title, 300) || server,
        description: 'GameTracker server page',
        author: '',
        image: bannerUrl,
        imageLayout: 'banner',
        url: pageUrl,
        originalUrl: pageUrl,
    };
}

function resolveGameTracker(server, originalUrl) {
    return fetchHtml(originalUrl).then((html) => {
        const preview = normalizePage(html, originalUrl);
        return gameTrackerCard(
            server.server,
            server.bannerUrl,
            preview ? preview.title : server.server,
            originalUrl
        );
    }).catch(() => gameTrackerCard(
        server.server,
        server.bannerUrl,
        server.server,
        originalUrl
    ));
}

function remember(url, preview) {
    if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(url, preview);
}

function fetchJson(url) {
    return desktopFetch(url, {
        headers: {
            Accept: 'application/json',
        },
    }).then(async(response) => {
        if (!response || !response.ok) {
            throw new Error('page preview request failed');
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('invalid page preview response');
        }
        return data;
    });
}

function readStream(reader, decoder, maxBytes, bytes, text) {
    return reader.read().then((chunk) => {
        if (chunk.done) {
            return text + decoder.decode();
        }

        const nextBytes = bytes + chunk.value.byteLength;
        if (nextBytes > maxBytes) {
            Promise.resolve(reader.cancel()).catch(() => {});
            throw new Error('page preview is too large');
        }

        return readStream(
            reader,
            decoder,
            maxBytes,
            nextBytes,
            text + decoder.decode(chunk.value, { stream: true })
        );
    });
}

async function readTextWithLimit(response, maxBytes) {
    if (response.body &&
        typeof response.body.getReader === 'function' &&
        typeof TextDecoder !== 'undefined') {
        const reader = response.body.getReader();
        try {
            return await readStream(reader, new TextDecoder(), maxBytes, 0, '');
        } catch (err) {
            Promise.resolve(reader.cancel()).catch(() => {});
            throw err;
        }
    }

    const text = await response.text();
    const size = typeof TextEncoder !== 'undefined' ?
        new TextEncoder().encode(text).byteLength :
        text.length;
    if (size > maxBytes) {
        throw new Error('page preview is too large');
    }
    return text;
}

function fetchHtml(url) {
    return desktopFetch(url, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
        },
        maxResponseBytes: MAX_HTML_BYTES,
    }).then(async(response) => {
        if (!response || !response.ok) {
            throw new Error('page preview request failed');
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
            throw new Error('page preview is not HTML');
        }

        return readTextWithLimit(response, MAX_HTML_BYTES);
    });
}

function resolveGitHub(repo, originalUrl) {
    return fetchJson(repo.apiUrl).then((data) => {
        const preview = normalizeGitHub(data, originalUrl);
        if (!preview) {
            throw new Error('invalid GitHub preview');
        }
        return preview;
    });
}

function resolveGitea(repo, originalUrl) {
    return fetchJson(repo.apiUrl).then((data) => {
        const preview = normalizeGitea(data, originalUrl);
        if (!preview) {
            throw new Error('invalid Gitea preview');
        }
        return preview;
    });
}

function resolveBitbucket(repo, originalUrl) {
    return fetchJson(repo.apiUrl).then((data) => {
        const preview = normalizeBitbucket(data, originalUrl);
        if (!preview) {
            throw new Error('invalid Bitbucket preview');
        }
        return preview;
    });
}

function resolveGitLab(repo, originalUrl) {
    return fetchJson(repo.apiUrl).then((data) => {
        const preview = normalizeGitLab(data, originalUrl);
        if (!preview) {
            throw new Error('invalid GitLab preview');
        }
        return preview;
    });
}

function resolveGeneric(url) {
    return fetchHtml(url).then((html) => {
        const discovery = oembedEndpoint(html, url);
        const fallback = () => {
            const preview = normalizePage(html, url);
            if (!preview) {
                throw new Error('no page metadata');
            }
            return preview;
        };

        if (!discovery) {
            return fallback();
        }

        return fetchOEmbed(discovery, url).catch(fallback);
    });
}

export function clearPagePreviewCache() {
    cache.clear();
}

export function resolvePagePreview(url) {
    if (typeof url !== 'string' || !url) {
        return Promise.reject(new Error('invalid page preview URL'));
    }

    if (cache.has(url)) {
        return Promise.resolve(cache.get(url));
    }

    const repo = parseGitHubRepo(url);
    const giteaRepo = parseGiteaRepo(url);
    const gitLabRepo = parseGitLabRepo(url);
    const bitbucketRepo = parseBitbucketRepo(url);
    const gameTracker = parseGameTrackerServer(url);
    const itchGame = parseItchGame(url);
    const amazonProduct = parseAmazonProduct(url);
    let request;
    if (repo) {
        request = resolveGitHub(repo, url).catch(() => resolveGeneric(url));
    } else if (giteaRepo) {
        request = resolveGitea(giteaRepo, url).catch(() => resolveGeneric(url));
    } else if (gitLabRepo) {
        request = resolveGitLab(gitLabRepo, url).catch(() => resolveGeneric(url));
    } else if (bitbucketRepo) {
        request = resolveBitbucket(bitbucketRepo, url).catch(() => resolveGeneric(url));
    } else if (gameTracker) {
        request = resolveGameTracker(gameTracker, url);
    } else if (itchGame) {
        request = resolveItch(itchGame, url);
    } else if (amazonProduct) {
        request = Promise.resolve(amazonCard(amazonProduct, url));
    } else if (!isDesktop() && !isWebGenericHost(url)) {
        request = Promise.reject(new Error('web generic preview is not allowlisted'));
    } else {
        request = resolveGeneric(url);
    }

    return request.then((preview) => {
        remember(url, preview);
        return preview;
    });
}
