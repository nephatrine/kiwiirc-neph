import JSON5 from 'json5';
import * as Misc from '@/helpers/Misc';

export function pageProtocol(pageHref) {
    try {
        return new URL(pageHref || window.location.href).protocol;
    } catch (e) {
        return 'http:';
    }
}

export function acceptStreamUrl(url, pageHref) {
    let clean = Misc.sanitizeUrl(typeof url === 'string' ? url : '');
    if (!clean || !/^https?:\/\//i.test(clean)) {
        return '';
    }
    if (pageProtocol(pageHref) === 'https:' && /^http:/i.test(clean)) {
        return '';
    }
    return clean;
}

export function acceptImageUrl(url) {
    let clean = Misc.sanitizeUrl(typeof url === 'string' ? url : '');
    if (!clean) {
        return '';
    }
    if (/^https?:\/\//i.test(clean) || clean.charAt(0) === '/') {
        return clean;
    }
    return '';
}

export function prepareStations(list, pageHref) {
    if (!Array.isArray(list)) {
        return [];
    }

    let stations = [];
    list.forEach((item) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        let source = acceptStreamUrl(item.source, pageHref);
        if (!source) {
            return;
        }
        stations.push({
            name: typeof item.name === 'string' && item.name
                ? item.name
                : source,
            image: acceptImageUrl(item.image),
            source,
            description: typeof item.description === 'string' ? item.description : '',
            channels: typeof item.channels === 'string' ? item.channels : '',
            nowPlaying: item.nowPlaying === false
                ? false
                : acceptStreamUrl(item.nowPlaying, pageHref),
        });
    });
    return stations;
}

export async function fetchStationList(url, options) {
    let opts = options || {};
    if (!url) {
        return { stations: [], error: '' };
    }

    let doFetch = opts.fetch || fetch;
    let response = await doFetch(url, { credentials: 'omit' });
    if (!response.ok) {
        return { stations: [], error: 'radio_load_failed' };
    }

    let parsed = JSON5.parse(await response.text());
    return {
        stations: prepareStations(parsed, opts.pageHref),
        error: '',
    };
}
