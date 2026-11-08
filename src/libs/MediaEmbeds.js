const DEFAULT_ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';

function openStreetMapBBox(lat, lon, zoom) {
    const n = 2 ** zoom;
    const tileSize = 256;
    const width = 640;
    const height = 480;
    const xTile = Math.floor((lon + 180) / 360 * n);
    const yTile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
        1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    const lonToTile = (x) => x / n * 360 - 180;
    const latToTile = (y) => Math.atan(
        (Math.exp(Math.PI * (1 - 2 * y / n)) - Math.exp(-Math.PI * (1 - 2 * y / n))) / 2
    ) / Math.PI * 180;
    const xStart = (xTile * tileSize - width / 2) / tileSize;
    const yStart = (yTile * tileSize - height / 2) / tileSize;
    const xEnd = (xTile * tileSize + width / 2) / tileSize;
    const yEnd = (yTile * tileSize + height / 2) / tileSize;

    return [
        lonToTile(xStart),
        latToTile(yStart),
        lonToTile(xEnd),
        latToTile(yEnd),
    ];
}

function openStreetMapEmbed(url) {
    const parsed = new URL(url);
    const query = parsed.searchParams;
    const rawZoom = query.get('zoom');
    const rawLat = query.get('lat') || query.get('mlat');
    const rawLon = query.get('lon') || query.get('mlon');
    let zoom = rawZoom ? Number(rawZoom) : NaN;
    let lat = rawLat ? Number(rawLat) : NaN;
    let lon = rawLon ? Number(rawLon) : NaN;

    const hash = parsed.hash.replace(/^#/, '');
    const mapHash = hash.match(/(?:^|&)map=([\d.]+)\/([\d.-]+)\/([\d.-]+)/);
    if (mapHash) {
        zoom = Number(mapHash[1]);
        lat = Number(mapHash[2]);
        lon = Number(mapHash[3]);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return null;
    }
    if (!Number.isFinite(zoom)) {
        zoom = 10;
    }
    zoom = Math.max(0, Math.min(18, Math.floor(zoom)));

    const bbox = openStreetMapBBox(lat, lon, zoom);
    return {
        id: `${lat},${lon}`,
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(',')}` +
            `&layer=mapnik&marker=${lat},${lon}`,
        aspectRatio: '4 / 3',
        allow: 'fullscreen',
        maxWidth: '1000px',
    };
}

function yandexMapsEmbed(url) {
    const parsed = new URL(url);
    if (!/(^|\.)yandex\.(?:com|ru)$/i.test(parsed.hostname)) {
        return null;
    }

    const ll = parsed.searchParams.get('ll');
    if (!ll) {
        return null;
    }
    const coords = ll.split(',');
    if (coords.length !== 2) {
        return null;
    }
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }
    const rawZoom = parsed.searchParams.get('z');
    const zoom = rawZoom ? Number(rawZoom) : NaN;
    const params = new URLSearchParams({
        ll: `${lon},${lat}`,
        z: String(Number.isFinite(zoom) ? Math.max(0, Math.min(21, Math.floor(zoom))) : 10),
    });

    return {
        id: `${lat},${lon}`,
        src: `https://yandex.com/map-widget/v1/?${params.toString()}`,
        aspectRatio: '16 / 9',
        allow: 'fullscreen',
        maxWidth: '1000px',
    };
}

const EMBEDS = [
    {
        id: 'ted',
        match: /^https?:\/\/(?:www\.)?ted\.com\/(?:talks|dubbing)\/([a-z0-9_-]+)(?:[/?#].*)?$/i,
        build: (match) => ({
            id: match[1],
            src: `https://embed.ted.com/talks/${match[1]}`,
            aspectRatio: '16 / 9',
        }),
    },
    {
        id: 'mixcloud',
        match: /^https?:\/\/(?:www\.)?mixcloud\.com\/(?:live\/)?([a-z0-9._-]+)(?:\/([a-z0-9._-]+))?\/?(?:[?#].*)?$/i,
        build: (match, url) => {
            const reserved = [
                'about', 'api', 'categories', 'developers', 'discover', 'jobs',
                'login', 'premium', 'privacy', 'search', 'settings', 'signup',
                'terms', 'upload', 'widget',
            ];
            if (reserved.includes(match[1].toLowerCase())) {
                return null;
            }
            return {
                id: match[2] ? `${match[1]}/${match[2]}` : match[1],
                src: 'https://www.mixcloud.com/widget/iframe/?hide_cover=1&feed=' +
                    encodeURIComponent(url),
                height: '120px',
                maxWidth: '600px',
                allow: 'autoplay; fullscreen; encrypted-media',
            };
        },
    },
    {
        id: 'wistia',
        match: /^https?:\/\/(?:[a-z0-9-]+\.)*wistia\.com\/medias\/([a-z0-9]+)/i,
        build: (match) => ({
            id: match[1],
            src: `https://fast.wistia.net/embed/iframe/${match[1]}`,
            aspectRatio: '16 / 9',
        }),
    },
    {
        id: 'wistia',
        match: /^https?:\/\/fast\.wistia\.net\/embed\/iframe\/([a-z0-9]+)/i,
        build: (match) => ({
            id: match[1],
            src: `https://fast.wistia.net/embed/iframe/${match[1]}`,
            aspectRatio: '16 / 9',
        }),
    },
    {
        id: 'loom',
        match: /^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-z0-9]+)/i,
        build: (match) => ({
            id: match[1],
            src: `https://www.loom.com/embed/${match[1]}`,
            aspectRatio: '16 / 9',
        }),
    },
    {
        id: 'art19',
        match: /^https?:\/\/(?:www\.)?art19\.com\/shows\/([a-z0-9_-]+)(?:\/episodes\/([a-z0-9_-]+))?/i,
        build: (match) => {
            const src = match[2] ?
                `https://art19.com/shows/${match[1]}/episodes/${match[2]}/embed` :
                `https://art19.com/shows/${match[1]}/embed`;
            return {
                id: match[2] ? `${match[1]}/${match[2]}` : match[1],
                src,
                height: '180px',
                maxWidth: '600px',
                allow: 'autoplay; fullscreen; encrypted-media',
            };
        },
    },
    {
        id: 'pinterest',
        match: /^https?:\/\/(?:www\.)?pinterest\.[a-z]{2,3}(?:\.[a-z]{2})?\/pin\/(?:[^/?#]+-)?(\d+)/i,
        build: (match) => ({
            id: match[1],
            src: `https://assets.pinterest.com/ext/embed.html?id=${match[1]}`,
            aspectRatio: '450 / 899',
            maxWidth: '450px',
            allow: 'fullscreen',
        }),
    },
    {
        id: 'tiktok',
        match: /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i,
        build: (match) => ({
            id: match[1],
            src: `https://www.tiktok.com/player/v1/${match[1]}`,
            aspectRatio: '9 / 16',
            maxWidth: '360px',
        }),
    },
    {
        id: 'prezi',
        match: /^https?:\/\/(?:www\.)?prezi\.com\/(?:view\/|embed\/)?([a-z0-9]+)(?:\/[^/?#]*)?(?:\/embed)?\/?(?:[?#].*)?$/i,
        build: (match) => ({
            id: match[1],
            src: `https://prezi.com/embed/${match[1]}/`,
            aspectRatio: '4 / 3',
            allow: 'fullscreen',
            maxWidth: '1000px',
        }),
    },
    {
        id: 'openstreetmap',
        match: /^https?:\/\/(?:www\.)?openstreetmap\.org\//i,
        build: (match, url) => openStreetMapEmbed(url),
    },
    {
        id: 'yandex-maps',
        match: /^https?:\/\/(?:www\.)?yandex\.(?:com|ru)\/maps\//i,
        build: (match, url) => yandexMapsEmbed(url),
    },
];

export function getMediaEmbed(url) {
    if (typeof url !== 'string' || !url) {
        return null;
    }

    for (let i = 0; i < EMBEDS.length; i++) {
        const provider = EMBEDS[i];
        const match = url.match(provider.match);
        if (!match) {
            continue;
        }

        const built = provider.build(match, url);
        if (!built || !built.src) {
            continue;
        }

        return {
            type: 'embed',
            provider: provider.id,
            id: built.id || '',
            src: built.src,
            aspectRatio: built.aspectRatio || '',
            height: built.height || '',
            maxWidth: built.maxWidth || '',
            allow: built.allow || DEFAULT_ALLOW,
        };
    }

    return null;
}

export function getMediaEmbeds() {
    return EMBEDS;
}
