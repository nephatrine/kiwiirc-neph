const POLL_MS = 30000;

export function statusUrlFor(streamUrl) {
    try {
        let url = new URL(streamUrl);
        url.pathname = '/status-json.xsl';
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch (err) {
        return '';
    }
}

function fileName(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }
    try {
        return new URL(value).pathname.split('/').filter(Boolean).pop() || '';
    } catch (err) {
        let parts = value.split('/');
        return parts[parts.length - 1].split('?')[0] || '';
    }
}

function cleanTitle(value) {
    if (typeof value !== 'string') {
        return '';
    }
    let title = value.trim();
    if (!title || title === '-') {
        return '';
    }
    return title;
}

function sourcesFrom(json) {
    let source = json && json.icestats && json.icestats.source;
    if (!source) {
        return [];
    }
    return Array.isArray(source) ? source : [source];
}

function siblingMp3(name) {
    if (/\.ogg$/i.test(name)) {
        return name.replace(/\.ogg$/i, '.mp3');
    }
    if (/^ogg/i.test(name)) {
        return name.replace(/^ogg/i, 'mp3');
    }
    return '';
}

export function titleFromStatus(json, streamUrl) {
    let want = fileName(streamUrl).toLowerCase();
    if (!want) {
        return '';
    }
    let sources = sourcesFrom(json);
    let exact = sources.find((source) => fileName(source.listenurl).toLowerCase() === want);
    let title = cleanTitle(exact && exact.title);
    let mp3Name = siblingMp3(want);
    if (!mp3Name) {
        return title || '';
    }
    let mp3 = sources.find((source) => fileName(source.listenurl).toLowerCase() === mp3Name);
    return cleanTitle(mp3 && mp3.title) || title || '';
}

export function nowPlayingEnabled(station) {
    return !station || station.nowPlaying !== false;
}

export function nowPlayingUrl(station) {
    if (!station || station.nowPlaying === false) {
        return '';
    }
    if (station.nowPlaying) {
        return station.nowPlaying;
    }
    return statusUrlFor(station.source);
}

export async function fetchNowPlaying(station, fetchImpl) {
    let url = nowPlayingUrl(station);
    if (!url) {
        return '';
    }
    let doFetch = fetchImpl || fetch;
    let response = await doFetch(url, { credentials: 'omit' });
    if (!response.ok) {
        return null;
    }
    let json = await response.json();
    if (json && json.icestats) {
        return titleFromStatus(json, station.source);
    }
    return cleanTitle(json && json.title);
}

export { POLL_MS };
