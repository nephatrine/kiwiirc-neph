kiwi.plugin('radio', (kiwi, log) => {
    'use strict';

    let SETTING_PREFIX = 'plugin-radio.';
    let DEFAULTS = {
        url: 'static/plugins/radio/stations.json',
        enabled: true,
        nowPlaying: true,
        showStationIcons: true,
        customStations: [],
        hiddenStations: [],
        volume: 0.4,
        starred: [],
        active: '',
        showWave: true,
        autoPlay: false,
        forceVolume: false,
        reloadOnOpen: false,
        forceShowClose: false,
    };
    let WAVE_STYLES = [
        'none',
        'bars',
        'mirror',
        'wave',
        'area',
        'led',
        'pulse',
        'peaks',
    ];
    let WAVE_POINTS = 48;
    let WAVE_UPDATE_MS = 33;
    let WAVE_SMOOTHING = 0.6;
    let WAVE_GAIN = 1.35;
    let WAVE_PEAK_DECAY = 0.8;
    let POLL_MS = 30000;
    let STALL_CHECK_MS = 5000;
    let STALL_MS = 15000;
    let MAX_STALL_ATTEMPTS = 3;
    let NOW_PLAYING_FAIL_BASE_MS = 60 * 1000;
    let NOW_PLAYING_FAIL_MAX_MS = 30 * 60 * 1000;
    let STATION_INFO_CACHE_MS = 6 * 60 * 60 * 1000;
    let STATION_INFO_FAIL_BASE_MS = 5 * 60 * 1000;
    let STATION_INFO_FAIL_MAX_MS = 6 * 60 * 60 * 1000;
    let STATION_INFO_GAP_MIN_MS = 2000;
    let STATION_INFO_GAP_MAX_MS = 4000;
    let radio = null;
    let stationInfoCache = new Map();
    let nowPlayingProviderCache = new Map();

    let Misc = kiwi.require('helpers/Misc');
    let TextFormatting = kiwi.require('helpers/TextFormatting');
    let Utils = kiwi.require('helpers/Utils');
    let NetworkIcons = kiwi.require('libs/desktop/NetworkIcons');
    let LinkPreview = kiwi.require('libs/LinkPreview');

    kiwi.setConfigDefaults('plugin-radio', DEFAULTS);

    function setting(name, fallback) {
        try {
            let value = kiwi.state.setting(SETTING_PREFIX + name);
            return typeof value === 'undefined' ? fallback : value;
        } catch (err) {
            return fallback;
        }
    }

    function setSetting(name, value) {
        try {
            kiwi.state.setting(SETTING_PREFIX + name, value);
        } catch (err) {
            log.error('Unable to save radio setting', err);
        }
    }

    function rawSetting(name) {
        try {
            return kiwi.state.setting(SETTING_PREFIX + name);
        } catch (err) {
            return undefined;
        }
    }

    function waveStyle() {
        let value = rawSetting('waveStyle');
        if (WAVE_STYLES.indexOf(value) !== -1) {
            return value;
        }
        return setting('showWave', true) === false ? 'none' : 'bars';
    }

    function def(object, key, value) {
        Object.defineProperty(object, key, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: value,
        });
    }

    function desktopHttpAvailable() {
        return !!(kiwi.desktop &&
            kiwi.desktop.http &&
            typeof kiwi.desktop.http.isAvailable === 'function' &&
            kiwi.desktop.http.isAvailable());
    }

    function absoluteUrl(url) {
        try {
            return new URL(url, window.location.href).toString();
        } catch (err) {
            return url;
        }
    }

    function radioFetch(url, options) {
        let target = absoluteUrl(url);
        if (desktopHttpAvailable() && /^https?:\/\//i.test(target)) {
            try {
                let parsed = new URL(target);
                let page = new URL(window.location.href);
                if (parsed.origin !== page.origin) {
                    return kiwi.desktop.http.fetch(target, options);
                }
            } catch (err) {
                // Fall through to the browser fetch.
            }
        }
        return fetch(url, options);
    }

    function pageProtocol(pageHref) {
        try {
            return new URL(pageHref || window.location.href).protocol;
        } catch (err) {
            return 'http:';
        }
    }

    function acceptStreamUrl(url, pageHref) {
        let clean = Misc.sanitizeUrl(typeof url === 'string' ? url : '');
        if (!clean || !/^https?:\/\//i.test(clean)) {
            return '';
        }
        if (pageProtocol(pageHref) === 'https:' && /^http:/i.test(clean)) {
            return '';
        }
        return clean;
    }

    function acceptImageUrl(url) {
        let value = typeof url === 'string' ? url : '';
        let clean = /^kiwi-icon:\/\//i.test(value) ?
            value :
            Misc.sanitizeUrl(value);
        if (!clean) {
            return '';
        }
        if (/^https?:\/\//i.test(clean) ||
            /^kiwi-icon:\/\//i.test(clean) ||
            clean.charAt(0) === '/'
        ) {
            return clean;
        }
        return '';
    }

    function stationSources(station) {
        if (!station) {
            return [];
        }
        if (Array.isArray(station.sources) && station.sources.length) {
            return station.sources;
        }
        return station.source ? [station.source] : [];
    }

    function stationMetadata(station) {
        return station && station.metadata ? station.metadata : null;
    }

    function stationDisplayName(station) {
        let info = stationMetadata(station);
        if (info && !station.nameExplicit && info.name) {
            return info.name;
        }
        return station && station.name ? station.name : '';
    }

    function stationDisplayImage(station) {
        let info = stationMetadata(station);
        return (station && station.image) || (info && info.image) || '';
    }

    function stationDisplayHomepage(station) {
        let info = stationMetadata(station);
        return (station && station.homepage) || (info && info.homepage) || '';
    }

    function stationDisplayDescription(station) {
        let info = stationMetadata(station);
        return (station && station.description) ||
            (info && info.description) ||
            '';
    }

    function prepareStations(list, pageHref) {
        if (!Array.isArray(list)) {
            return [];
        }

        let stations = [];
        list.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            let rawSources = Array.isArray(item.sources) && item.sources.length ?
                item.sources :
                [item.source];
            let sources = [];
            rawSources.forEach((rawSource) => {
                let source = acceptStreamUrl(rawSource, pageHref);
                if (source && sources.indexOf(source) === -1) {
                    sources.push(source);
                }
            });
            if (!sources.length) {
                return;
            }

            let source = sources[0];
            let explicitName = typeof item.name === 'string' ?
                item.name.trim() :
                '';
            if (explicitName === source) {
                explicitName = '';
            }
            let cached = stationInfoCache.get(source);
            stations.push({
                name: explicitName || source,
                nameExplicit: !!explicitName,
                image: acceptImageUrl(item.image),
                homepage: acceptStreamUrl(item.homepage, pageHref),
                source: source,
                sources: sources,
                metadata: cached && cached.data ? cached.data : null,
                description: typeof item.description === 'string'
                    ? item.description
                    : '',
                nowPlaying: item.nowPlaying === false
                    ? false
                    : acceptStreamUrl(item.nowPlaying, pageHref),
            });
        });
        return stations;
    }

    async function fetchStationList(url, options) {
        let opts = options || {};
        if (!url) {
            return { stations: [], error: '', missing: false };
        }

        let doFetch = opts.fetch || radioFetch;
        let response = await doFetch(url, { credentials: 'omit' });
        if (!response.ok) {
            if (response.status === 404 || response.status === 410) {
                return { stations: [], error: '', missing: true };
            }
            return { stations: [], error: 'load_failed', missing: false };
        }

        let text = await response.text();
        let parsed = kiwi.JSON5 ? kiwi.JSON5.parse(text) : JSON.parse(text);
        return {
            stations: prepareStations(parsed, opts.pageHref),
            error: '',
            missing: false,
        };
    }

    function statusUrlFor(streamUrl) {
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

    function shoutcastUrlFor(streamUrl) {
        try {
            let url = new URL(streamUrl);
            url.pathname = '/stats';
            url.search = 'sid=1&json=1';
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

    function cleanText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function cleanTitle(value) {
        let title = cleanText(value);
        return title === '-' ? '' : title;
    }

    function cleanHttpUrl(value) {
        let url = Misc.sanitizeUrl(cleanText(value));
        return /^https?:\/\//i.test(url) ? url : '';
    }

    function numberValue(value) {
        let number = parseInt(value, 10);
        return Number.isFinite(number) && number >= 0 ? number : null;
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

    function icecastSource(json, streamUrl) {
        let sources = sourcesFrom(json);
        if (!sources.length) {
            return null;
        }
        let want = fileName(streamUrl).toLowerCase();
        if (!want) {
            return sources.length === 1 ? sources[0] : null;
        }
        let exact = sources.find((source) => (
            fileName(source.listenurl).toLowerCase() === want
        ));
        if (exact) {
            return exact;
        }
        let mp3Name = siblingMp3(want);
        let sibling = mp3Name ?
            sources.find((source) => (
                fileName(source.listenurl).toLowerCase() === mp3Name
            )) :
            null;
        if (sibling) {
            return sibling;
        }
        return sources.length === 1 ? sources[0] : null;
    }

    function parseIcecastStatus(json, streamUrl) {
        let source = icecastSource(json, streamUrl);
        if (!source) {
            return null;
        }
        let artist = cleanText(source.artist);
        let track = cleanTitle(source.title || source.song);
        let title = track;
        if (artist && track &&
            track.toLowerCase().indexOf(artist.toLowerCase()) === -1) {
            title = artist + ' — ' + track;
        }
        return {
            title: title,
            artist: artist,
            name: cleanText(source.server_name),
            description: cleanText(source.server_description),
            homepage: cleanHttpUrl(source.server_url),
            genre: cleanText(source.genre),
            bitrate: numberValue(source.bitrate),
            listeners: numberValue(source.listeners),
            listenerPeak: numberValue(source.listener_peak),
            provider: 'icecast',
        };
    }

    function parseShoutcastStatus(json) {
        let stream = json && (
            json.stream ||
            (Array.isArray(json.streams) ? json.streams[0] : null)
        );
        if (!stream && json && (json.title || json.songtitle || json.name)) {
            stream = json;
        }
        if (!stream) {
            return null;
        }
        let artist = cleanText(stream.artist);
        let track = cleanTitle(
            stream.title ||
            stream.songtitle ||
            stream.song
        );
        let title = track;
        if (artist && track &&
            track.toLowerCase().indexOf(artist.toLowerCase()) === -1) {
            title = artist + ' — ' + track;
        }
        return {
            title: title,
            artist: artist,
            name: cleanText(stream.name || stream.servertitle),
            description: cleanText(
                stream.description ||
                stream.serverdescription ||
                json.description
            ),
            homepage: cleanHttpUrl(
                stream.url ||
                stream.streamurl ||
                stream.serverurl ||
                json.url
            ),
            genre: cleanText(stream.genre || json.genre),
            bitrate: numberValue(
                stream.bitrate ||
                stream.streambitrate ||
                json.bitrate
            ),
            listeners: numberValue(
                stream.listeners !== undefined ?
                    stream.listeners :
                    (stream.currentlisteners || json.listeners)
            ),
            listenerPeak: numberValue(
                stream.listenerpeak ||
                stream.listener_peak ||
                stream.peaklisteners ||
                json.listenerpeak
            ),
            provider: 'shoutcast',
        };
    }

    function parseNowPlaying(json, streamUrl) {
        if (json && json.icestats) {
            return parseIcecastStatus(json, streamUrl);
        }
        return parseShoutcastStatus(json);
    }

    function hasNowPlayingInfo(info) {
        return !!(info && (
            info.title ||
            info.name ||
            info.description ||
            info.homepage ||
            info.genre ||
            info.bitrate ||
            typeof info.listeners === 'number'
        ));
    }

    function hasStationInfo(info) {
        return !!(info && (
            info.name ||
            info.description ||
            info.image ||
            info.homepage ||
            info.genre ||
            info.bitrate
        ));
    }

    function metadataEnabled(station) {
        return setting('nowPlaying', true) !== false &&
            (!station || station.nowPlaying !== false);
    }

    async function fetchNowPlaying(station, sourceUrl, fetchImpl) {
        if (!station || !metadataEnabled(station)) {
            return null;
        }
        let streamUrl = sourceUrl || station.source;
        let urls = [];
        let addUrl = (url) => {
            if (url && urls.indexOf(url) === -1) {
                urls.push(url);
            }
        };
        addUrl(station.nowPlaying);
        addUrl(statusUrlFor(streamUrl));
        addUrl(shoutcastUrlFor(streamUrl));

        let candidates = urls;
        let cached = nowPlayingProviderCache.get(streamUrl);
        if (cached && urls.indexOf(cached) !== -1) {
            candidates = [cached].concat(urls.filter((url) => url !== cached));
        }

        let doFetch = fetchImpl || radioFetch;
        let tryProvider = async(index) => {
            if (index >= candidates.length) {
                nowPlayingProviderCache.delete(streamUrl);
                return null;
            }
            try {
                let response = await doFetch(candidates[index], {
                    credentials: 'omit',
                });
                if (response.ok) {
                    let json = await response.json();
                    let info = parseNowPlaying(json, streamUrl);
                    if (hasNowPlayingInfo(info)) {
                        info.providerUrl = candidates[index];
                        nowPlayingProviderCache.set(streamUrl, candidates[index]);
                        return info;
                    }
                }
            } catch (err) {
                // Try the next metadata provider.
            }
            return tryProvider(index + 1);
        };
        return tryProvider(0);
    }

    function headerValue(headers, name) {
        if (!headers) {
            return '';
        }
        if (typeof headers.get === 'function') {
            return cleanText(headers.get(name));
        }
        let key = Object.keys(headers).find((item) => (
            item.toLowerCase() === name
        ));
        return key ? cleanText(headers[key]) : '';
    }

    function parseAudioInfo(value) {
        let result = {};
        cleanText(value).split(';').forEach((part) => {
            let pieces = part.split('=');
            if (pieces.length < 2) {
                return;
            }
            let key = pieces[0].trim().toLowerCase();
            let infoValue = pieces.slice(1).join('=').trim();
            if (key) {
                result[key] = infoValue;
            }
        });
        return result;
    }

    function parseIcyResponse(response) {
        let headers = response && response.headers;
        let audioInfo = parseAudioInfo(
            headerValue(headers, 'ice-audio-info') ||
            headerValue(headers, 'icy-audio-info')
        );
        let info = {
            name: headerValue(headers, 'icy-name'),
            description: headerValue(headers, 'icy-description'),
            homepage: cleanHttpUrl(headerValue(headers, 'icy-url')),
            genre: headerValue(headers, 'icy-genre') || audioInfo.genre || '',
            bitrate: numberValue(
                headerValue(headers, 'icy-br') || audioInfo.bitrate
            ),
        };
        return hasStationInfo(info) ? info : null;
    }

    async function fetchStationDetails(station, fetchImpl) {
        if (!station) {
            return null;
        }
        let doFetch = fetchImpl || radioFetch;
        let sources = stationSources(station);
        let trySource = async(index) => {
            if (index >= sources.length) {
                return null;
            }
            try {
                let response = await doFetch(sources[index], {
                    method: 'HEAD',
                    credentials: 'omit',
                });
                if (response && response.ok) {
                    let info = parseIcyResponse(response);
                    if (info) {
                        return info;
                    }
                }
            } catch (err) {
                // Some stream servers do not answer HEAD requests.
            }
            return trySource(index + 1);
        };
        let streamInfo = await trySource(0);

        let homepage = (streamInfo && streamInfo.homepage) ||
            station.homepage ||
            stationDisplayHomepage(station) ||
            '';
        let pageInfo = null;
        if (homepage && desktopHttpAvailable() && LinkPreview &&
            typeof LinkPreview.resolveEmbedFallback === 'function') {
            try {
                pageInfo = await LinkPreview.resolveEmbedFallback(homepage);
            } catch (err) {
                pageInfo = null;
            }
        }

        let info = {
            name: (streamInfo && streamInfo.name) ||
                cleanText(pageInfo && pageInfo.title),
            description: (streamInfo && streamInfo.description) ||
                cleanText(pageInfo && pageInfo.description),
            image: cleanText(pageInfo && pageInfo.image),
            homepage: (streamInfo && streamInfo.homepage) ||
                cleanHttpUrl(homepage) ||
                cleanHttpUrl(pageInfo && pageInfo.url),
            genre: (streamInfo && streamInfo.genre) || '',
            bitrate: (streamInfo && streamInfo.bitrate) || null,
        };
        return hasStationInfo(info) ? info : null;
    }

    function adminVolume() {
        let value = kiwi.state.getSetting('settings.plugin-radio.volume');
        return typeof value === 'number' ? value : 0.4;
    }

    function getRadio() {
        if (!radio) {
            radio = createRadio();
        }
        return radio;
    }

    function createRadio() {
        let ui = kiwi.Vue.observable({
            stations: [],
            hiddenStations: [],
            error: '',
            loading: false,
            playing: false,
            muted: false,
            currentName: '',
            currentLabel: '',
            listOpen: false,
            volumeUnlocked: false,
            failed: {},
            waveReady: false,
            trackTitle: '',
            nowPlayingInfo: null,
            visualizerOpen: false,
            visualizerNotice: '',
            missing: false,
        });
        let fileStations = [];

        def(ui, 'audio', null);
        def(ui, 'audioCtx', null);
        def(ui, 'analyser', null);
        def(ui, 'waveFrame', 0);

        let recovering = false;
        let activeStation = null;
        let activeSourceIndex = 0;
        let activeAttempt = 0;
        let trackTimer = null;
        let trackGen = 0;
        let trackFailures = 0;
        let trackBackoffUntil = 0;
        let stallTimer = null;
        let stallGen = 0;
        let lastStreamTime = 0;
        let lastAdvanceAt = 0;
        let stallAttempts = 0;
        let detailQueue = [];
        let detailTimer = null;
        let detailRunning = false;
        let detailGen = 0;

        function enabled() {
            return setting('enabled', true) !== false;
        }

        function waveEnabled() {
            return waveStyle() !== 'none';
        }

        function waveNeeded() {
            return waveEnabled() || ui.visualizerOpen;
        }

        function volume() {
            if (setting('forceVolume', false) && !ui.volumeUnlocked) {
                return adminVolume();
            }
            let value = setting('volume', 0.4);
            return typeof value === 'number' ? value : 0.4;
        }

        function applyVolume() {
            if (!ui.audio) {
                return;
            }
            ui.audio.volume = ui.muted ? 0 : volume();
        }

        function setPlaying(playing) {
            let label = ui.currentLabel || ui.currentName;
            ui.playing = playing;
            kiwi.setMediaPlaying('radio', playing, {
                station: label,
                title: ui.trackTitle,
                display: [label, ui.trackTitle].filter(Boolean).join(' — '),
            });
        }

        function markFailed(name) {
            kiwi.Vue.set(ui.failed, name, true);
            setPlaying(false);
            stopTrackPoll();
            stopStallWatch();
            clearSession();
        }

        function jitterDelay(delay) {
            return Math.round(delay * (0.8 + (Math.random() * 0.4)));
        }

        function nowPlayingRetryDelay(failures) {
            let delay = Math.min(
                NOW_PLAYING_FAIL_MAX_MS,
                NOW_PLAYING_FAIL_BASE_MS * (2 ** (failures - 1))
            );
            return jitterDelay(delay);
        }

        function stationInfoEntry(station) {
            let source = station && station.source;
            if (!source) {
                return null;
            }
            let entry = stationInfoCache.get(source);
            if (!entry) {
                entry = {
                    data: null,
                    fetchedAt: 0,
                    failures: 0,
                    nextAttemptAt: 0,
                };
                stationInfoCache.set(source, entry);
            }
            return entry;
        }

        function applyStationMetadata(source, data) {
            [fileStations, ui.stations, ui.hiddenStations].forEach((list) => {
                list.forEach((station) => {
                    if (station.source === source) {
                        kiwi.Vue.set(station, 'metadata', data);
                    }
                });
            });

            let station = current();
            if (station && station.source === source) {
                ui.currentLabel = stationDisplayName(station);
                if (ui.playing) {
                    setSession(station);
                    setPlaying(true);
                }
            }
        }

        function stationInfoDue(station) {
            if (!station || !metadataEnabled(station)) {
                return false;
            }
            let entry = stationInfoEntry(station);
            if (!entry) {
                return false;
            }
            if (entry.data &&
                Date.now() - entry.fetchedAt < STATION_INFO_CACHE_MS) {
                return false;
            }
            return entry.nextAttemptAt <= Date.now();
        }

        function recordStationInfoFailure(station) {
            let entry = stationInfoEntry(station);
            if (!entry) {
                return;
            }
            entry.failures += 1;
            let delay = Math.min(
                STATION_INFO_FAIL_MAX_MS,
                STATION_INFO_FAIL_BASE_MS * (2 ** (entry.failures - 1))
            );
            entry.nextAttemptAt = Date.now() + jitterDelay(delay);
        }

        async function loadStationDetails(station) {
            let prepared = station;
            if (!prepared || !stationSources(prepared).length) {
                return null;
            }
            let entry = stationInfoEntry(prepared);
            try {
                let info = await fetchStationDetails(prepared);
                if (info) {
                    entry.data = info;
                    entry.fetchedAt = Date.now();
                    entry.failures = 0;
                    entry.nextAttemptAt = 0;
                    applyStationMetadata(prepared.source, info);
                    return info;
                }
                recordStationInfoFailure(prepared);
                return null;
            } catch (err) {
                recordStationInfoFailure(prepared);
                return null;
            }
        }

        function stopDetailQueue() {
            detailGen += 1;
            detailQueue = [];
            if (detailTimer) {
                clearTimeout(detailTimer);
                detailTimer = null;
            }
        }

        function detailPriority(station) {
            let currentStation = current();
            if (currentStation && currentStation.source === station.source) {
                return 0;
            }
            if (isStarred(station.name)) {
                return 1;
            }
            return 2;
        }

        function listHasStation(list, source) {
            return list.some((station) => station.source === source);
        }

        function detailRetryDelay() {
            let now = Date.now();
            let next = Infinity;
            ui.stations.forEach((station) => {
                if (!metadataEnabled(station)) {
                    return;
                }
                let entry = stationInfoCache.get(station.source);
                if (!entry) {
                    next = Math.min(next, now);
                    return;
                }
                if (entry.data &&
                    now - entry.fetchedAt < STATION_INFO_CACHE_MS) {
                    return;
                }
                next = Math.min(next, Math.max(now, entry.nextAttemptAt));
            });
            if (!Number.isFinite(next)) {
                return null;
            }
            return Math.max(1000, next - now);
        }

        function scheduleDetailRetry(gen) {
            if (!ui.listOpen || detailTimer) {
                return;
            }
            let delay = detailRetryDelay();
            if (delay === null) {
                return;
            }
            detailTimer = setTimeout(() => {
                detailTimer = null;
                if (gen === detailGen && ui.listOpen) {
                    startDetailQueue();
                }
            }, delay);
        }

        function pumpDetailQueue(gen) {
            if (gen !== detailGen) {
                return;
            }
            if (!ui.listOpen || !desktopHttpAvailable()) {
                detailQueue = [];
                return;
            }
            if (detailRunning || detailTimer) {
                return;
            }

            let station = detailQueue.shift();
            while (station && (
                !listHasStation(ui.stations, station.source) ||
                !stationInfoDue(station)
            )) {
                station = detailQueue.shift();
            }
            if (!station) {
                scheduleDetailRetry(gen);
                return;
            }

            detailRunning = true;
            loadStationDetails(station).finally(() => {
                detailRunning = false;
                if (gen !== detailGen) {
                    if (ui.listOpen && detailQueue.length) {
                        pumpDetailQueue(detailGen);
                    }
                    return;
                }
                if (!ui.listOpen) {
                    return;
                }
                if (!detailQueue.length) {
                    scheduleDetailRetry(gen);
                    return;
                }
                let delay = STATION_INFO_GAP_MIN_MS +
                    (Math.random() * (STATION_INFO_GAP_MAX_MS - STATION_INFO_GAP_MIN_MS));
                detailTimer = setTimeout(() => {
                    detailTimer = null;
                    pumpDetailQueue(gen);
                }, delay);
            });
        }

        function startDetailQueue() {
            if (!ui.listOpen || !desktopHttpAvailable()) {
                stopDetailQueue();
                return;
            }
            detailGen += 1;
            let gen = detailGen;
            let stations = ui.stations.filter((station) => (
                stationInfoDue(station)
            ));
            stations.sort((a, b) => {
                let priority = detailPriority(a) - detailPriority(b);
                if (priority !== 0) {
                    return priority;
                }
                return stationDisplayName(a).localeCompare(stationDisplayName(b));
            });
            detailQueue = stations;
            if (detailTimer) {
                clearTimeout(detailTimer);
                detailTimer = null;
            }
            pumpDetailQueue(gen);
        }

        function ensureAudio(withWave) {
            if (ui.audio && !!ui.audio.crossOrigin !== !!withWave) {
                discardAudio();
            }
            if (ui.audio) {
                return ui.audio;
            }
            let audio = document.createElement('audio');
            audio.playsInline = true;
            audio.setAttribute('playsinline', '');
            if (withWave) {
                audio.crossOrigin = 'anonymous';
            }
            audio.setAttribute('aria-hidden', 'true');
            audio.style.position = 'fixed';
            audio.style.left = '-9999px';
            audio.style.width = '1px';
            audio.style.height = '1px';
            audio.style.opacity = '0';
            audio.addEventListener('error', () => {
                if (recovering) {
                    return;
                }
                if (audio.crossOrigin) {
                    recoverWithoutWave();
                    return;
                }
                tryNextSource(activeAttempt);
            });
            audio.addEventListener('pause', () => {
                setPlaying(false);
                clearSession();
            });
            document.body.appendChild(audio);
            ui.audio = audio;
            return audio;
        }

        function stopWave() {
            if (ui.waveFrame) {
                window.cancelAnimationFrame(ui.waveFrame);
                ui.waveFrame = 0;
            }
        }

        function discardAudio() {
            ui.waveReady = false;
            ui.analyser = null;
            if (ui.audioCtx && ui.audioCtx.close) {
                ui.audioCtx.close();
            }
            ui.audioCtx = null;
            if (ui.audio && ui.audio.parentNode) {
                ui.audio.parentNode.removeChild(ui.audio);
            }
            ui.audio = null;
        }

        function recoverWithoutWave() {
            if (recovering) {
                return;
            }
            recovering = true;
            if (ui.visualizerOpen) {
                ui.visualizerNotice = 'visualizer_no_audio';
            }
            let station = activeStation;
            let sources = stationSources(station);
            let src = sources[activeSourceIndex] ||
                (ui.audio && (ui.audio.currentSrc || ui.audio.src)) ||
                '';
            let name = station ? station.name : ui.currentName;
            discardAudio();
            if (!src) {
                recovering = false;
                tryNextSource(activeAttempt);
                return;
            }
            let audio = ensureAudio(false);
            audio.src = src;
            applyVolume();
            let started = audio.play();
            if (started && started.then) {
                started.then(() => {
                    recovering = false;
                    setPlaying(true);
                    if (name) {
                        kiwi.Vue.delete(ui.failed, name);
                    }
                    startTrackPoll(station || current());
                    startStallWatch();
                }).catch(() => {
                    recovering = false;
                    tryNextSource(activeAttempt);
                });
            } else {
                recovering = false;
            }
        }

        function attachWave() {
            if (!waveNeeded() || ui.analyser || !ui.audio) {
                return;
            }
            if (!ui.audio.crossOrigin) {
                return;
            }
            let AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                if (ui.visualizerOpen) {
                    ui.visualizerNotice = 'visualizer_no_audio';
                }
                return;
            }
            try {
                let ctx = ui.audioCtx || new AudioCtx();
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                let source = ctx.createMediaElementSource(ui.audio);
                let analyser = ctx.createAnalyser();
                analyser.fftSize = ui.visualizerOpen ? 256 : 64;
                source.connect(analyser);
                analyser.connect(ctx.destination);
                ui.audioCtx = ctx;
                ui.analyser = analyser;
                ui.waveReady = true;
            } catch (err) {
                ui.analyser = null;
                ui.waveReady = false;
                if (ui.visualizerOpen) {
                    ui.visualizerNotice = 'visualizer_no_audio';
                }
            }
        }

        function setSession(station) {
            let session = navigator.mediaSession;
            if (!session || typeof window.MediaMetadata !== 'function') {
                return;
            }
            let label = stationDisplayName(station) || ui.currentLabel || ui.currentName;
            let image = stationDisplayImage(station);
            let info = ui.nowPlayingInfo;
            let artwork = (image && /^https?:\/\//i.test(image))
                ? [{ src: image }]
                : [];
            session.metadata = new window.MediaMetadata({
                title: (info && info.title) || ui.trackTitle || label,
                artist: (info && info.artist) || (ui.trackTitle ? label : ''),
                album: label,
                artwork: artwork,
            });
            session.playbackState = 'playing';
            try {
                session.setActionHandler('play', () => {
                    playCurrent();
                });
                session.setActionHandler('pause', () => {
                    pause();
                });
                session.setActionHandler('previoustrack', () => {
                    skip(-1);
                });
                session.setActionHandler('nexttrack', () => {
                    skip(1);
                });
            } catch (err) {
                // Some browsers reject an action they do not support.
            }
        }

        function clearSession() {
            let session = navigator.mediaSession;
            if (!session) {
                return;
            }
            session.metadata = null;
            session.playbackState = 'none';
            ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((action) => {
                try {
                    session.setActionHandler(action, null);
                } catch (err) {
                    // Ignore unsupported media session actions.
                }
            });
        }

        function current() {
            return ui.stations.find((station) => station.name === ui.currentName) || null;
        }

        function customStationList() {
            return prepareStations(
                setting('customStations', []),
                window.location.href
            );
        }

        function serializeStation(station) {
            return {
                name: station.name,
                image: station.image,
                homepage: station.homepage,
                source: station.source,
                sources: stationSources(station),
                description: station.description,
                nowPlaying: station.nowPlaying,
            };
        }

        function saveCustomStations(list) {
            setSetting('customStations', list.map((station) => (
                serializeStation(station)
            )));
        }

        function hiddenStationSources() {
            let hidden = setting('hiddenStations', []);
            if (!Array.isArray(hidden)) {
                return [];
            }
            return hidden.filter((source, index, list) => (
                typeof source === 'string' &&
                source &&
                list.indexOf(source) === index
            ));
        }

        function rebuildStations() {
            let hidden = hiddenStationSources();
            let hiddenSet = Object.create(null);
            hidden.forEach((source) => {
                hiddenSet[source] = true;
            });

            ui.hiddenStations = fileStations.filter((station) => hiddenSet[station.source]);
            let visibleFileStations = fileStations.filter((station) => !hiddenSet[station.source]);
            let custom = customStationList().map((station) => Object.assign({}, station, {
                custom: true,
            }));
            ui.stations = visibleFileStations.concat(custom);
            if (ui.listOpen) {
                startDetailQueue();
            }
        }

        function prepareCustomStation(station) {
            let prepared = prepareStations([station], window.location.href);
            return prepared.length ? prepared[0] : null;
        }

        function stationConflict(station, originalSource) {
            let sources = stationSources(station);
            return ui.stations.some((item) => (
                item.source !== originalSource &&
                (item.name === station.name ||
                    stationSources(item).some((source) => sources.indexOf(source) !== -1))
            ));
        }

        function addStation(station) {
            let prepared = prepareCustomStation(station);
            if (!prepared) {
                return { ok: false, error: 'invalid_source' };
            }
            if (stationConflict(prepared, '')) {
                return { ok: false, error: 'duplicate_station' };
            }

            let list = customStationList();
            list.push(prepared);
            saveCustomStations(list);
            rebuildStations();
            return { ok: true, station: prepared };
        }

        function updateStation(originalSource, station) {
            let prepared = prepareCustomStation(station);
            if (!prepared) {
                return { ok: false, error: 'invalid_source' };
            }
            if (stationConflict(prepared, originalSource)) {
                return { ok: false, error: 'duplicate_station' };
            }

            let list = customStationList();
            let index = list.findIndex((item) => item.source === originalSource);
            if (index === -1) {
                return { ok: false, error: 'station_not_found' };
            }

            let previous = list[index];
            let wasCurrent = ui.currentName === previous.name;
            if (wasCurrent) {
                pause();
            }
            list[index] = prepared;
            saveCustomStations(list);
            rebuildStations();
            if (wasCurrent) {
                ui.currentName = prepared.name;
                ui.currentLabel = stationDisplayName(prepared);
                setSetting('active', prepared.name);
            }
            return { ok: true, station: prepared };
        }

        function removeStation(station) {
            if (!station) {
                return;
            }
            if (ui.currentName === station.name) {
                pause();
                ui.currentName = '';
                ui.currentLabel = '';
                setSetting('active', '');
            }

            if (station.custom) {
                let list = customStationList().filter((item) => (
                    item.source !== station.source
                ));
                saveCustomStations(list);
            } else {
                let hidden = hiddenStationSources();
                if (hidden.indexOf(station.source) === -1) {
                    hidden.push(station.source);
                    setSetting('hiddenStations', hidden);
                }
            }
            rebuildStations();
        }

        function restoreStation(station) {
            if (!station || !station.source) {
                return;
            }
            let hidden = hiddenStationSources().filter((source) => (
                source !== station.source
            ));
            setSetting('hiddenStations', hidden);
            rebuildStations();
        }

        function restoreAllStations() {
            setSetting('hiddenStations', []);
            rebuildStations();
        }

        async function loadStations() {
            let url = setting('url', '');
            if (!url) {
                fileStations = [];
                rebuildStations();
                ui.error = '';
                ui.missing = false;
                return;
            }
            ui.loading = true;
            ui.error = '';
            ui.missing = false;
            try {
                let result = await fetchStationList(url);
                if (!result.error && !result.missing) {
                    fileStations = result.stations;
                    ui.error = '';
                    ui.missing = false;
                } else if (!ui.playing) {
                    fileStations = result.stations;
                    ui.error = result.error;
                    ui.missing = !!result.missing;
                }
                rebuildStations();
                if (!ui.currentName) {
                    ui.currentName = setting('active', '') || '';
                }
            } catch (err) {
                if (!ui.playing) {
                    fileStations = [];
                    ui.error = 'load_failed';
                    ui.missing = false;
                }
                rebuildStations();
            }
            ui.loading = false;
        }

        function playSource(station, sourceIndex, useWave) {
            let sources = stationSources(station);
            if (!sources.length) {
                return;
            }

            let index = Math.max(0, Math.min(sourceIndex, sources.length - 1));
            activeStation = station;
            activeSourceIndex = index;
            ui.visualizerNotice = '';
            activeAttempt += 1;
            let attempt = activeAttempt;
            stopTrackPoll();
            stopStallWatch();
            stallAttempts = 0;

            let source = sources[index];
            let audio = ensureAudio(useWave);
            ui.currentName = station.name;
            ui.currentLabel = stationDisplayName(station);
            setSetting('active', station.name);
            kiwi.Vue.delete(ui.failed, station.name);
            if (audio.src !== source) {
                audio.src = source;
            }
            applyVolume();
            let started = audio.play();
            if (started && started.then) {
                started.then(() => {
                    setPlaying(true);
                    if (useWave) {
                        attachWave();
                    }
                    setSession(station);
                    startTrackPoll(station);
                    startStallWatch();
                }).catch(() => {
                    if (useWave && audio.crossOrigin) {
                        recoverWithoutWave();
                        return;
                    }
                    tryNextSource(attempt);
                });
            }
        }

        function tryNextSource(attempt) {
            if (typeof attempt !== 'undefined' && attempt !== activeAttempt) {
                return;
            }
            let sources = stationSources(activeStation);
            if (activeStation && activeSourceIndex + 1 < sources.length) {
                playSource(activeStation, activeSourceIndex + 1, waveNeeded());
                return;
            }
            if (activeStation) {
                markFailed(activeStation.name);
            } else if (ui.currentName) {
                markFailed(ui.currentName);
            }
        }

        function play(station) {
            if (!station || !stationSources(station).length) {
                return;
            }
            activeStation = station;
            activeSourceIndex = 0;
            playSource(station, 0, waveNeeded());
        }

        function playCurrent() {
            let station = current();
            if (station) {
                play(station);
                return;
            }
            let name = ui.currentName || setting('active', '');
            let match = ui.stations.find((item) => item.name === name);
            if (match) {
                play(match);
            }
        }

        function stopTrackPoll() {
            trackGen += 1;
            trackFailures = 0;
            trackBackoffUntil = 0;
            if (trackTimer) {
                clearInterval(trackTimer);
                trackTimer = null;
            }
            ui.trackTitle = '';
            ui.nowPlayingInfo = null;
        }

        function startTrackPoll(station) {
            stopTrackPoll();
            if (!station || !metadataEnabled(station)) {
                return;
            }
            let gen = trackGen;
            let pull = function() {
                if (Date.now() < trackBackoffUntil) {
                    return;
                }
                let sourceUrl = stationSources(station)[activeSourceIndex] ||
                    station.source;
                fetchNowPlaying(station, sourceUrl).then((info) => {
                    if (gen !== trackGen || !ui.playing) {
                        return;
                    }
                    if (!info) {
                        trackFailures += 1;
                        trackBackoffUntil = Date.now() +
                            nowPlayingRetryDelay(trackFailures);
                        return;
                    }
                    trackFailures = 0;
                    trackBackoffUntil = 0;
                    ui.nowPlayingInfo = Object.assign({
                        stationSource: station.source,
                        sourceUrl: sourceUrl,
                    }, info);
                    ui.trackTitle = info.title || '';
                    setSession(station);
                    setPlaying(true);
                }).catch(() => {
                    trackFailures += 1;
                    trackBackoffUntil = Date.now() +
                        nowPlayingRetryDelay(trackFailures);
                });
            };
            pull();
            trackTimer = setInterval(pull, POLL_MS);
        }

        function stopStallWatch() {
            stallGen += 1;
            if (stallTimer) {
                clearInterval(stallTimer);
                stallTimer = null;
            }
        }

        function startStallWatch() {
            stopStallWatch();
            let gen = stallGen;
            lastStreamTime = ui.audio ? ui.audio.currentTime : 0;
            lastAdvanceAt = Date.now();
            stallTimer = setInterval(() => {
                if (gen !== stallGen || !ui.playing || !ui.audio ||
                    ui.audio.paused || recovering) {
                    return;
                }
                let time = ui.audio.currentTime;
                let now = Date.now();
                if (time > lastStreamTime) {
                    lastStreamTime = time;
                    lastAdvanceAt = now;
                    stallAttempts = 0;
                    return;
                }
                if (now - lastAdvanceAt >= STALL_MS) {
                    reconnect();
                }
            }, STALL_CHECK_MS);
        }

        function reconnect() {
            let station = current();
            if (!station || !ui.audio) {
                return;
            }
            activeStation = station;
            stallAttempts += 1;
            if (stallAttempts > MAX_STALL_ATTEMPTS) {
                tryNextSource(activeAttempt);
                return;
            }
            stopStallWatch();
            let audio = ui.audio;
            audio.load();
            let restarted = audio.play();
            if (restarted && restarted.then) {
                restarted.then(() => {
                    setPlaying(true);
                    setSession(station);
                    startStallWatch();
                }).catch(() => {
                    recoverWithoutWave();
                });
            }
        }

        function pause() {
            if (ui.audio) {
                ui.audio.pause();
            }
            activeStation = null;
            setPlaying(false);
            stopTrackPoll();
            stopStallWatch();
            stopWave();
            clearSession();
        }

        function toggle() {
            if (ui.playing) {
                pause();
            } else {
                playCurrent();
            }
        }

        function closeBrowser() {
            stopDetailQueue();
            if (!ui.listOpen) {
                return;
            }
            ui.listOpen = false;
            kiwi.state.$emit('active.component', null);
        }

        function setVisualizer(open) {
            let next = !!open;
            if (ui.visualizerOpen === next) {
                return;
            }
            ui.visualizerOpen = next;
            ui.visualizerNotice = '';
            if (ui.analyser) {
                ui.analyser.fftSize = ui.visualizerOpen ? 256 : 64;
            }
            applySettings();
        }

        function applySettings() {
            if (!enabled()) {
                pause();
                closeBrowser();
                return;
            }

            if (!ui.stations.length && !ui.loading && setting('url', '')) {
                loadStations();
            }

            let station = current();
            if (!ui.playing) {
                if (!waveNeeded()) {
                    stopWave();
                }
                if (!metadataEnabled(null)) {
                    stopDetailQueue();
                } else if (ui.listOpen) {
                    startDetailQueue();
                }
                return;
            }

            if (!metadataEnabled(station)) {
                stopTrackPoll();
                if (station) {
                    setSession(station);
                    setPlaying(true);
                }
            } else if (station && !trackTimer) {
                startTrackPoll(station);
            }

            if (!metadataEnabled(null)) {
                stopDetailQueue();
            } else if (ui.listOpen) {
                startDetailQueue();
            }

            if (!waveNeeded()) {
                stopWave();
                return;
            }

            if (station && ui.audio && !ui.audio.crossOrigin) {
                play(station);
            } else {
                attachWave();
            }
            if (!waveEnabled()) {
                stopWave();
            }
        }

        function skip(step) {
            if (!ui.stations.length) {
                return;
            }
            let index = ui.stations.findIndex((station) => station.name === ui.currentName);
            if (index < 0) {
                index = 0;
            }
            let next = (index + step + ui.stations.length) % ui.stations.length;
            play(ui.stations[next]);
        }

        function setVolume(value) {
            let next = Math.min(1, Math.max(0, Number(value)));
            ui.volumeUnlocked = true;
            setSetting('volume', next);
            ui.muted = false;
            applyVolume();
        }

        function toggleMute() {
            ui.muted = !ui.muted;
            applyVolume();
        }

        function isStarred(name) {
            let starred = setting('starred', []);
            return starred.indexOf(name) !== -1;
        }

        function toggleStar(name) {
            let starred = (setting('starred', []) || []).slice();
            let index = starred.indexOf(name);
            if (index === -1) {
                starred.push(name);
            } else {
                starred.splice(index, 1);
            }
            setSetting('starred', starred);
        }

        return {
            ui: ui,
            enabled: enabled,
            setting: setting,
            volume: volume,
            current: current,
            loadStations: loadStations,
            play: play,
            playCurrent: playCurrent,
            pause: pause,
            toggle: toggle,
            skip: skip,
            setVolume: setVolume,
            toggleMute: toggleMute,
            isStarred: isStarred,
            toggleStar: toggleStar,
            stopWave: stopWave,
            waveStyle: waveStyle,
            waveEnabled: waveEnabled,
            applySettings: applySettings,
            closeBrowser: closeBrowser,
            addStation: addStation,
            updateStation: updateStation,
            removeStation: removeStation,
            restoreStation: restoreStation,
            restoreAllStations: restoreAllStations,
            startDetailQueue: startDetailQueue,
            stopDetailQueue: stopDetailQueue,
            setVisualizer: setVisualizer,
            fetchStationDetails: function(station) {
                return loadStationDetails(station);
            },
        };
    }

    function openBrowser() {
        let radioInstance = getRadio();
        if (!radioInstance.enabled()) {
            return false;
        }
        radioInstance.ui.listOpen = true;
        if (radioInstance.setting('reloadOnOpen', false)) {
            radioInstance.loadStations();
        } else if (!radioInstance.ui.stations.length) {
            radioInstance.loadStations();
        }
        radioInstance.startDetailQueue();
        kiwi.state.$emit('active.component', RadioBrowser);
        kiwi.state.$emit('statebrowser.hide');
        return true;
    }

    const RADIO_VISUALIZER_AUDIO_BINS = 128;
    const RADIO_VISUALIZER_VERTEX = `
        attribute vec2 a_position;
        varying vec2 v_uv;

        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;
    const RADIO_VISUALIZER_FEEDBACK = `
        precision mediump float;

        uniform sampler2D u_prev;
        uniform sampler2D u_audio;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_spin;
        uniform float u_twist;
        uniform float u_bass;
        uniform float u_mid;
        uniform float u_treble;
        uniform float u_energy;
        uniform float u_centroid;
        uniform float u_flux;
        uniform float u_beat;
        varying vec2 v_uv;

        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise21(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        vec3 palette(float t) {
            return 0.5 + 0.5 * cos(
                6.28318 * (vec3(1.0, 0.72, 0.42) * t + vec3(0.02, 0.31, 0.64))
            );
        }

        float audioAt(float angle) {
            float x = fract(angle / 6.2831853 + 0.5);
            return texture2D(u_audio, vec2(x, 0.5)).r;
        }

        void main() {
            vec2 uv = v_uv;
            vec2 p = uv - 0.5;
            p.x *= u_resolution.x / max(1.0, u_resolution.y);
            float radius = length(p);
            float angle = atan(p.y, p.x);
            float audio = audioAt(angle);

            float c = cos(u_spin);
            float s = sin(u_spin);
            vec2 rotated = mat2(c, -s, s, c) * p;
            float zoom = 1.0 - (
                0.006 + u_bass * 0.045 + u_beat * 0.035
            );
            vec2 flow = vec2(
                sin(rotated.y * 8.0 + u_twist + u_time * 0.7),
                cos(rotated.x * 7.0 - u_twist * 0.8 + u_time * 0.6)
            );
            flow += vec2(
                noise21(rotated * 6.0 + u_time * 0.15),
                noise21(rotated * 6.0 - u_time * 0.12)
            ) * 2.0 - 1.0;
            rotated += flow * (
                0.0015 + u_mid * 0.008 + u_flux * 0.01
            );
            vec2 sampleUv = rotated / zoom + 0.5;
            float chroma = 0.0015 + u_beat * 0.003;
            vec2 chromaDir = normalize(p + vec2(0.0001));
            vec3 previous;
            previous.r = texture2D(
                u_prev,
                clamp(sampleUv + chromaDir * chroma, 0.001, 0.999)
            ).r;
            previous.g = texture2D(
                u_prev,
                clamp(sampleUv, 0.001, 0.999)
            ).g;
            previous.b = texture2D(
                u_prev,
                clamp(sampleUv - chromaDir * chroma, 0.001, 0.999)
            ).b;
            previous *= 0.91 + u_bass * 0.025;

            float bandA = audioAt(angle + u_twist * 0.15);
            float bandB = audioAt(-angle + u_twist * 0.23);
            float wave = sin(
                angle * 7.0 + radius * 24.0 - u_twist * 1.8
            ) * 0.5 + sin(
                angle * 13.0 - radius * 17.0 + u_twist * 2.4
            ) * 0.5;
            float ringBase = 0.16 + u_bass * 0.05;
            float ringRadius = ringBase + bandA * 0.20 +
                wave * (0.008 + u_mid * 0.018);
            float ringWidth = 0.004 + u_treble * 0.008 + u_beat * 0.004;
            float ring = 1.0 - smoothstep(
                0.0,
                ringWidth,
                abs(radius - ringRadius)
            );
            float ring2Radius = ringRadius + 0.018 +
                bandB * 0.09 - u_beat * 0.01;
            float ring2 = 1.0 - smoothstep(
                0.0,
                ringWidth * 0.7,
                abs(radius - ring2Radius)
            );

            float arms = 3.0 + u_treble * 4.0;
            float armPhase = angle * arms +
                log(radius + 0.035) * (2.2 + u_mid * 2.8) -
                u_twist * (0.7 + u_flux * 1.8);
            float arm = pow(
                max(0.0, cos(armPhase)),
                8.0 + u_treble * 14.0
            );
            float armFade = smoothstep(0.035, 0.18, radius) *
                (1.0 - smoothstep(
                    0.32,
                    0.52 + u_bass * 0.08,
                    radius
                ));
            arm *= armFade * (0.25 + audio * 0.9 + u_flux * 0.5);

            float ribbonPhase = angle * (5.0 + u_mid * 3.0) +
                log(radius + 0.02) * 3.4 + u_spin * 0.6;
            float ribbon = pow(max(0.0, cos(ribbonPhase)), 4.0);
            ribbon *= smoothstep(0.10, 0.25, radius) *
                (1.0 - smoothstep(0.36, 0.62, radius)) *
                (0.12 + u_mid * 0.55);

            vec2 sparkUv = uv * vec2(
                u_resolution.x / max(1.0, u_resolution.y),
                1.0
            ) * 28.0;
            float spark = pow(
                hash21(floor(
                    sparkUv + vec2(u_twist * 1.7, u_time * 0.8)
                )),
                28.0 - u_treble * 12.0
            );
            spark *= smoothstep(0.12, 0.5, radius) *
                (0.15 + u_treble * 1.4);

            float shockRadius = 0.10 + (1.0 - u_beat) * 0.48;
            float shock = 1.0 - smoothstep(
                0.0,
                0.006 + (1.0 - u_beat) * 0.012,
                abs(radius - shockRadius)
            );
            shock *= u_beat * (1.0 - smoothstep(0.55, 0.75, radius));
            float glow = (1.0 - smoothstep(0.0, 0.55, radius)) *
                (0.03 + u_energy * 0.12 + u_bass * 0.08);

            vec3 colorA = palette(
                angle / 6.28318 + u_spin * 0.12 + u_centroid * 0.5
            );
            vec3 colorB = palette(
                -angle / 6.28318 + u_twist * 0.08 + 0.37 + u_energy * 0.3
            );
            vec3 resultColour = previous * 0.90;
            resultColour += colorA * ring * (0.8 + u_treble * 1.5);
            resultColour += colorB * ring2 * (0.35 + u_mid * 0.8);
            resultColour += colorA * arm * (0.35 + u_energy * 0.85);
            resultColour += colorB * ribbon * 0.3;
            resultColour += mix(colorA, vec3(1.0), 0.6) * spark * 0.8;
            resultColour += mix(
                colorA,
                vec3(1.0, 0.85, 0.65),
                0.5
            ) * shock * 0.65;
            resultColour += colorA * glow;
            resultColour += vec3(0.015, 0.025, 0.04) * (1.0 - radius);
            resultColour = resultColour / (1.0 + resultColour * 0.25);
            gl_FragColor = vec4(clamp(resultColour, 0.0, 1.0), 1.0);
        }
    `;
    const RADIO_VISUALIZER_COPY = `
        precision mediump float;

        uniform sampler2D u_texture;
        varying vec2 v_uv;

        void main() {
            gl_FragColor = vec4(texture2D(u_texture, v_uv).rgb, 1.0);
        }
    `;

    const RadioVisualizer = kiwi.Vue.extend({
        template: '#kiwi-radio-visualizer',
        data: function() {
            return {
                radio: getRadio(),
                isFullscreen: false,
                reducedMotion: false,
            };
        },
        computed: {
            playing: function() {
                return this.radio.ui.playing;
            },
            stationLabel: function() {
                let station = this.radio.current();
                if (station) {
                    return stationDisplayName(station);
                }
                return this.radio.ui.currentLabel ||
                    this.radio.ui.currentName ||
                    '';
            },
            trackTitle: function() {
                return this.radio.ui.trackTitle;
            },
            audioReady: function() {
                return this.radio.ui.waveReady && !!this.radio.ui.analyser;
            },
            notice: function() {
                if (this.radio.ui.visualizerNotice) {
                    return this.radio.ui.visualizerNotice;
                }
                if (this.playing && !this.audioReady) {
                    return 'visualizer_waiting_audio';
                }
                return '';
            },
            fullscreenTitle: function() {
                return this.isFullscreen ?
                    'visualizer_exit_fullscreen' :
                    'visualizer_fullscreen';
            },
        },
        mounted: function() {
            this.reducedMotion = !!(
                window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
            );
            this.visual = {
                disposed: false,
                raf: 0,
                frame: null,
                lastFrame: 0,
                time: 0,
                canvas: null,
                container: null,
                resizeObserver: null,
                gl: null,
                ctx2d: null,
                feedbackProgram: null,
                copyProgram: null,
                quadBuffer: null,
                audioTexture: null,
                feedbackUniforms: null,
                copyUniforms: null,
                textures: [],
                framebuffers: [],
                readIndex: 0,
                writeIndex: 1,
                feedbackWidth: 0,
                feedbackHeight: 0,
                audioBins: new Uint8Array(RADIO_VISUALIZER_AUDIO_BINS),
                frequencyData: null,
                previousFrequencyData: null,
                bass: 0,
                mid: 0,
                treble: 0,
                energy: 0,
                centroid: 0,
                flux: 0,
                bassAverage: 0,
                beat: 0,
                spin: 0,
                twist: 0,
            };

            document.addEventListener('fullscreenchange', this.onFullscreenChange);
            document.addEventListener(
                'webkitfullscreenchange',
                this.onFullscreenChange
            );
            if (window.ResizeObserver) {
                this.visual.resizeObserver = new window.ResizeObserver(() => {
                    this.resizeCanvas();
                });
                this.visual.resizeObserver.observe(this.$refs.container);
            } else {
                window.addEventListener('resize', this.resizeCanvas);
            }

            this.radio.setVisualizer(true);
            this.$nextTick(() => {
                if (!this.visual || this.visual.disposed) {
                    return;
                }
                this.initCanvas();
                this.startLoop();
            });
        },
        beforeDestroy: function() {
            if (!this.visual) {
                return;
            }
            this.visual.disposed = true;
            this.stopLoop();
            if (this.visual.resizeObserver) {
                this.visual.resizeObserver.disconnect();
            } else {
                window.removeEventListener('resize', this.resizeCanvas);
            }
            document.removeEventListener(
                'fullscreenchange',
                this.onFullscreenChange
            );
            document.removeEventListener(
                'webkitfullscreenchange',
                this.onFullscreenChange
            );
            let fullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement;
            if (fullscreen && fullscreen === this.$refs.container) {
                let exit = document.exitFullscreen ||
                    document.webkitExitFullscreen;
                if (exit) {
                    try {
                        let result = exit.call(document);
                        if (result && result.catch) {
                            result.catch(() => {});
                        }
                    } catch (err) {
                        // Ignore fullscreen exit failures.
                    }
                }
            }
            this.destroyWebGL();
            this.radio.setVisualizer(false);
        },
        methods: {
            onFullscreenChange: function() {
                let fullscreen = document.fullscreenElement ||
                    document.webkitFullscreenElement;
                this.isFullscreen = !!fullscreen &&
                    fullscreen === this.$refs.container;
            },
            toggleFullscreen: function() {
                let container = this.$refs.container;
                if (!container) {
                    return;
                }
                let fullscreen = document.fullscreenElement ||
                    document.webkitFullscreenElement;
                let action;
                if (fullscreen === container) {
                    action = document.exitFullscreen ||
                        document.webkitExitFullscreen;
                    if (!action) {
                        return;
                    }
                    try {
                        let result = action.call(document);
                        if (result && result.catch) {
                            result.catch(() => {});
                        }
                    } catch (err) {
                        // Ignore fullscreen exit failures.
                    }
                    return;
                }
                action = container.requestFullscreen ||
                    container.webkitRequestFullscreen;
                if (!action) {
                    return;
                }
                try {
                    let result = action.call(container);
                    if (result && result.catch) {
                        result.catch(() => {});
                    }
                } catch (err) {
                    // Ignore fullscreen request failures.
                }
            },
            startLoop: function() {
                if (!this.visual || this.visual.raf) {
                    return;
                }
                this.visual.frame = (now) => {
                    this.drawFrame(now);
                };
                this.visual.raf = window.requestAnimationFrame(
                    this.visual.frame
                );
            },
            stopLoop: function() {
                if (!this.visual) {
                    return;
                }
                if (this.visual.raf) {
                    window.cancelAnimationFrame(this.visual.raf);
                    this.visual.raf = 0;
                }
            },
            drawFrame: function(now) {
                let visual = this.visual;
                if (!visual || visual.disposed) {
                    return;
                }
                let time = typeof now === 'number' ? now : Date.now();
                if (!visual.lastFrame) {
                    visual.lastFrame = time;
                }
                let delta = Math.min(0.1, (time - visual.lastFrame) / 1000);
                visual.lastFrame = time;
                visual.time += delta;

                if (!document.hidden) {
                    this.updateAudio(delta);
                    if (visual.gl) {
                        this.drawWebGL();
                    } else {
                        this.draw2D();
                    }
                }
                visual.raf = window.requestAnimationFrame(visual.frame);
            },
            average: function(data, start, end) {
                if (!data || end <= start) {
                    return 0;
                }
                let total = 0;
                for (let index = start; index < end; index += 1) {
                    total += data[index];
                }
                return total / (end - start);
            },
            updateAudio: function(delta) {
                let visual = this.visual;
                let analyser = this.radio.ui.analyser;
                let bins = visual.audioBins;
                let step = typeof delta === 'number' ?
                    Math.max(0, delta) :
                    0.016;
                let motion = this.reducedMotion ? 0.25 : 1;
                if (!analyser) {
                    bins.fill(0);
                    visual.bass *= 0.94;
                    visual.mid *= 0.94;
                    visual.treble *= 0.94;
                    visual.energy *= 0.94;
                    visual.centroid *= 0.96;
                    visual.flux *= 0.88;
                    visual.beat *= 0.9;
                    visual.spin = (visual.spin + step * 0.03 * motion) %
                        (Math.PI * 2);
                    visual.twist = (visual.twist + step * 0.12 * motion) %
                        (Math.PI * 8);
                    return;
                }

                let length = analyser.frequencyBinCount;
                if (!visual.frequencyData ||
                    visual.frequencyData.length !== length
                ) {
                    visual.frequencyData = new Uint8Array(length);
                }
                analyser.getByteFrequencyData(visual.frequencyData);

                let flux = 0;
                if (!visual.previousFrequencyData ||
                    visual.previousFrequencyData.length !== length
                ) {
                    visual.previousFrequencyData = new Uint8Array(length);
                } else {
                    for (let index = 0; index < length; index += 1) {
                        flux += Math.abs(
                            visual.frequencyData[index] -
                            visual.previousFrequencyData[index]
                        );
                    }
                    flux /= length * 255;
                }
                visual.previousFrequencyData.set(visual.frequencyData);

                for (let index = 0; index < RADIO_VISUALIZER_AUDIO_BINS; index += 1) {
                    let mapped = Math.floor(
                        ((index / (RADIO_VISUALIZER_AUDIO_BINS - 1)) ** 1.7) *
                        (length - 1)
                    );
                    bins[index] = visual.frequencyData[
                        Math.min(length - 1, Math.max(0, mapped))
                    ];
                }

                let bass = this.average(
                    visual.frequencyData,
                    0,
                    Math.min(8, length)
                ) / 255;
                let mid = this.average(
                    visual.frequencyData,
                    Math.min(8, length),
                    Math.min(64, length)
                ) / 255;
                let treble = this.average(
                    visual.frequencyData,
                    Math.min(64, length),
                    length
                ) / 255;
                let energy = this.average(
                    visual.frequencyData,
                    0,
                    length
                ) / 255;
                let weighted = 0;
                let total = 0;
                for (let index = 0; index < length; index += 1) {
                    let value = visual.frequencyData[index];
                    weighted += value * index;
                    total += value;
                }
                let centroid = total > 0 ?
                    weighted / total / Math.max(1, length - 1) :
                    0;

                visual.bass = visual.bass * 0.82 + bass * 0.18;
                visual.mid = visual.mid * 0.82 + mid * 0.18;
                visual.treble = visual.treble * 0.82 + treble * 0.18;
                visual.energy = visual.energy * 0.82 + energy * 0.18;
                visual.centroid = visual.centroid * 0.88 + centroid * 0.12;
                visual.flux = visual.flux * 0.65 + flux * 0.35;

                let beatSignal = bass * 0.7 + flux * 0.8;
                visual.bassAverage = visual.bassAverage * 0.96 +
                    beatSignal * 0.04;
                if (beatSignal > visual.bassAverage * 1.18 + 0.025) {
                    visual.beat = 1;
                } else {
                    visual.beat *= 0.88;
                }

                visual.spin = (visual.spin + step * (
                    0.06 + visual.mid * 0.85 +
                    visual.flux * 1.2 + visual.beat * 0.15
                ) * motion) % (Math.PI * 2);
                visual.twist = (visual.twist + step * (
                    0.18 + visual.mid * 2.2 +
                    visual.treble * 0.6 + visual.flux * 1.4
                ) * motion) % (Math.PI * 8);
            },
            initCanvas: function() {
                let visual = this.visual;
                let canvas = this.$refs.canvas;
                let container = this.$refs.container;
                if (!visual || !canvas || !container) {
                    return;
                }
                visual.canvas = canvas;
                visual.container = container;
                this.resizeCanvas();

                let gl = null;
                try {
                    gl = canvas.getContext('webgl', {
                        alpha: false,
                        antialias: false,
                        depth: false,
                        powerPreference: 'high-performance',
                    }) || canvas.getContext('experimental-webgl');
                } catch (err) {
                    gl = null;
                }
                if (gl && this.setupWebGL(gl)) {
                    this.resizeWebGL();
                    return;
                }
                visual.gl = null;
                visual.ctx2d = canvas.getContext('2d');
            },
            resizeCanvas: function() {
                let visual = this.visual;
                if (!visual || !visual.canvas || !visual.container) {
                    return;
                }
                let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let width = Math.max(
                    1,
                    Math.round(visual.container.clientWidth * dpr)
                );
                let height = Math.max(
                    1,
                    Math.round(visual.container.clientHeight * dpr)
                );
                let scale = Math.min(1, 1920 / width, 1080 / height);
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
                if (visual.canvas.width === width &&
                    visual.canvas.height === height
                ) {
                    return;
                }
                visual.canvas.width = width;
                visual.canvas.height = height;
                visual.ctx2d = visual.ctx2d &&
                    visual.canvas.getContext('2d');
                if (visual.gl) {
                    this.resizeWebGL();
                }
            },
            resizeWebGL: function() {
                let visual = this.visual;
                if (!visual || !visual.gl || !visual.canvas) {
                    return;
                }
                let scale = Math.min(
                    1,
                    1280 / visual.canvas.width,
                    720 / visual.canvas.height
                );
                let width = Math.max(
                    64,
                    Math.floor(visual.canvas.width * scale)
                );
                let height = Math.max(
                    36,
                    Math.floor(visual.canvas.height * scale)
                );
                if (visual.feedbackWidth === width &&
                    visual.feedbackHeight === height
                ) {
                    return;
                }
                visual.feedbackWidth = width;
                visual.feedbackHeight = height;
                this.createFeedbackTargets();
            },
            createFeedbackTargets: function() {
                let visual = this.visual;
                let gl = visual.gl;
                if (!gl) {
                    return;
                }
                this.deleteFeedbackTargets();
                visual.textures = [];
                visual.framebuffers = [];
                gl.clearColor(0, 0, 0, 1);
                for (let index = 0; index < 2; index += 1) {
                    let texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_MIN_FILTER,
                        gl.LINEAR
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_MAG_FILTER,
                        gl.LINEAR
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_WRAP_S,
                        gl.CLAMP_TO_EDGE
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_WRAP_T,
                        gl.CLAMP_TO_EDGE
                    );
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        gl.RGBA,
                        visual.feedbackWidth,
                        visual.feedbackHeight,
                        0,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        null
                    );

                    let framebuffer = gl.createFramebuffer();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                    gl.framebufferTexture2D(
                        gl.FRAMEBUFFER,
                        gl.COLOR_ATTACHMENT0,
                        gl.TEXTURE_2D,
                        texture,
                        0
                    );
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    visual.textures.push(texture);
                    visual.framebuffers.push(framebuffer);
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                visual.readIndex = 0;
                visual.writeIndex = 1;
            },
            deleteFeedbackTargets: function() {
                let visual = this.visual;
                let gl = visual && visual.gl;
                if (!gl) {
                    return;
                }
                (visual.textures || []).forEach((texture) => {
                    gl.deleteTexture(texture);
                });
                (visual.framebuffers || []).forEach((framebuffer) => {
                    gl.deleteFramebuffer(framebuffer);
                });
                visual.textures = [];
                visual.framebuffers = [];
            },
            compileShader: function(gl, type, source) {
                let shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    let info = gl.getShaderInfoLog(shader);
                    gl.deleteShader(shader);
                    throw new Error('radio visualizer shader: ' + info);
                }
                return shader;
            },
            createProgram: function(gl, vertexSource, fragmentSource) {
                let vertex = this.compileShader(
                    gl,
                    gl.VERTEX_SHADER,
                    vertexSource
                );
                let fragment = this.compileShader(
                    gl,
                    gl.FRAGMENT_SHADER,
                    fragmentSource
                );
                let program = gl.createProgram();
                gl.attachShader(program, vertex);
                gl.attachShader(program, fragment);
                gl.bindAttribLocation(program, 0, 'a_position');
                gl.linkProgram(program);
                gl.deleteShader(vertex);
                gl.deleteShader(fragment);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    let info = gl.getProgramInfoLog(program);
                    gl.deleteProgram(program);
                    throw new Error('radio visualizer program: ' + info);
                }
                return program;
            },
            setupWebGL: function(gl) {
                let visual = this.visual;
                visual.gl = gl;
                try {
                    let feedbackProgram = this.createProgram(
                        gl,
                        RADIO_VISUALIZER_VERTEX,
                        RADIO_VISUALIZER_FEEDBACK
                    );
                    let copyProgram = this.createProgram(
                        gl,
                        RADIO_VISUALIZER_VERTEX,
                        RADIO_VISUALIZER_COPY
                    );
                    let quadBuffer = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
                    gl.bufferData(
                        gl.ARRAY_BUFFER,
                        new Float32Array([
                            -1, -1,
                            1, -1,
                            -1, 1,
                            1, 1,
                        ]),
                        gl.STATIC_DRAW
                    );

                    let audioTexture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, audioTexture);
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_MIN_FILTER,
                        gl.LINEAR
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_MAG_FILTER,
                        gl.LINEAR
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_WRAP_S,
                        gl.CLAMP_TO_EDGE
                    );
                    gl.texParameteri(
                        gl.TEXTURE_2D,
                        gl.TEXTURE_WRAP_T,
                        gl.CLAMP_TO_EDGE
                    );
                    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        gl.LUMINANCE,
                        RADIO_VISUALIZER_AUDIO_BINS,
                        1,
                        0,
                        gl.LUMINANCE,
                        gl.UNSIGNED_BYTE,
                        visual.audioBins
                    );

                    visual.feedbackProgram = feedbackProgram;
                    visual.copyProgram = copyProgram;
                    visual.quadBuffer = quadBuffer;
                    visual.audioTexture = audioTexture;
                    visual.feedbackUniforms = {
                        prev: gl.getUniformLocation(feedbackProgram, 'u_prev'),
                        audio: gl.getUniformLocation(feedbackProgram, 'u_audio'),
                        resolution: gl.getUniformLocation(
                            feedbackProgram,
                            'u_resolution'
                        ),
                        time: gl.getUniformLocation(feedbackProgram, 'u_time'),
                        spin: gl.getUniformLocation(feedbackProgram, 'u_spin'),
                        twist: gl.getUniformLocation(feedbackProgram, 'u_twist'),
                        bass: gl.getUniformLocation(feedbackProgram, 'u_bass'),
                        mid: gl.getUniformLocation(feedbackProgram, 'u_mid'),
                        treble: gl.getUniformLocation(
                            feedbackProgram,
                            'u_treble'
                        ),
                        energy: gl.getUniformLocation(
                            feedbackProgram,
                            'u_energy'
                        ),
                        centroid: gl.getUniformLocation(
                            feedbackProgram,
                            'u_centroid'
                        ),
                        flux: gl.getUniformLocation(feedbackProgram, 'u_flux'),
                        beat: gl.getUniformLocation(feedbackProgram, 'u_beat'),
                    };
                    visual.copyUniforms = {
                        texture: gl.getUniformLocation(
                            copyProgram,
                            'u_texture'
                        ),
                    };
                    gl.disable(gl.DEPTH_TEST);
                    gl.disable(gl.BLEND);
                    gl.clearColor(0, 0, 0, 1);
                    return true;
                } catch (err) {
                    this.destroyWebGL();
                    return false;
                }
            },
            uploadAudio: function() {
                let visual = this.visual;
                let gl = visual.gl;
                if (!gl || !visual.audioTexture) {
                    return;
                }
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, visual.audioTexture);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.LUMINANCE,
                    RADIO_VISUALIZER_AUDIO_BINS,
                    1,
                    0,
                    gl.LUMINANCE,
                    gl.UNSIGNED_BYTE,
                    visual.audioBins
                );
            },
            drawWebGL: function() {
                let visual = this.visual;
                let gl = visual.gl;
                if (!gl || !visual.feedbackWidth || !visual.textures.length) {
                    return;
                }
                this.uploadAudio();
                gl.bindFramebuffer(
                    gl.FRAMEBUFFER,
                    visual.framebuffers[visual.writeIndex]
                );
                gl.viewport(
                    0,
                    0,
                    visual.feedbackWidth,
                    visual.feedbackHeight
                );
                gl.useProgram(visual.feedbackProgram);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(
                    gl.TEXTURE_2D,
                    visual.textures[visual.readIndex]
                );
                gl.uniform1i(visual.feedbackUniforms.prev, 0);
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, visual.audioTexture);
                gl.uniform1i(visual.feedbackUniforms.audio, 1);
                gl.uniform2f(
                    visual.feedbackUniforms.resolution,
                    visual.feedbackWidth,
                    visual.feedbackHeight
                );
                gl.uniform1f(
                    visual.feedbackUniforms.time,
                    visual.time * (this.reducedMotion ? 0.25 : 1)
                );
                gl.uniform1f(visual.feedbackUniforms.spin, visual.spin);
                gl.uniform1f(visual.feedbackUniforms.twist, visual.twist);
                gl.uniform1f(visual.feedbackUniforms.bass, visual.bass);
                gl.uniform1f(visual.feedbackUniforms.mid, visual.mid);
                gl.uniform1f(visual.feedbackUniforms.treble, visual.treble);
                gl.uniform1f(visual.feedbackUniforms.energy, visual.energy);
                gl.uniform1f(
                    visual.feedbackUniforms.centroid,
                    visual.centroid
                );
                gl.uniform1f(visual.feedbackUniforms.flux, visual.flux);
                gl.uniform1f(visual.feedbackUniforms.beat, visual.beat);
                gl.bindBuffer(gl.ARRAY_BUFFER, visual.quadBuffer);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, visual.canvas.width, visual.canvas.height);
                gl.useProgram(visual.copyProgram);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(
                    gl.TEXTURE_2D,
                    visual.textures[visual.writeIndex]
                );
                gl.uniform1i(visual.copyUniforms.texture, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                let swap = visual.readIndex;
                visual.readIndex = visual.writeIndex;
                visual.writeIndex = swap;
            },
            draw2D: function() {
                let visual = this.visual;
                let ctx = visual.ctx2d;
                if (!ctx || !visual.canvas) {
                    return;
                }
                let width = visual.canvas.width;
                let height = visual.canvas.height;
                let time = visual.time * (this.reducedMotion ? 0.25 : 1);
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = 'rgba(2, 5, 10, 0.20)';
                ctx.fillRect(0, 0, width, height);
                ctx.globalCompositeOperation = 'lighter';

                let centerX = width / 2;
                let centerY = height / 2;
                let size = Math.min(width, height);
                let bars = 96;
                let rings = 3;
                ctx.lineCap = 'round';

                for (let layer = 0; layer < rings; layer += 1) {
                    let baseRadius = size * (
                        0.12 + layer * 0.038 + visual.bass * 0.03
                    );
                    let direction = layer % 2 === 0 ? 1 : -1;
                    let rotation = visual.spin * direction + layer * 1.7;
                    let alpha = 0.72 - layer * 0.17;
                    for (let index = 0; index < bars; index += 1) {
                        let value = visual.audioBins[Math.floor(
                            (index / bars) * RADIO_VISUALIZER_AUDIO_BINS
                        )] / 255;
                        let angle = (index / bars) * Math.PI * 2 + rotation;
                        let wobble = Math.sin(
                            angle * (3 + layer) +
                            visual.twist +
                            index * 0.35
                        ) * size * (0.004 + visual.mid * 0.008);
                        let inner = baseRadius + wobble;
                        let outer = inner + value * size * (
                            0.11 - layer * 0.022
                        ) + 3;
                        let hue = (
                            visual.centroid * 260 +
                            index / bars * 180 +
                            time * 18 +
                            layer * 50
                        ) % 360;
                        ctx.strokeStyle = 'hsla(' + hue +
                            ', 92%, ' + (68 - layer * 6) + '%, ' +
                            alpha + ')';
                        ctx.lineWidth = Math.max(
                            1,
                            width / bars * (0.18 + value * 0.24)
                        );
                        ctx.beginPath();
                        ctx.moveTo(
                            centerX + Math.cos(angle) * inner,
                            centerY + Math.sin(angle) * inner
                        );
                        ctx.lineTo(
                            centerX + Math.cos(angle) * outer,
                            centerY + Math.sin(angle) * outer
                        );
                        ctx.stroke();
                    }
                }

                let arms = 3 + Math.floor(visual.treble * 3);
                ctx.lineWidth = Math.max(1, size * 0.0035);
                for (let arm = 0; arm < arms; arm += 1) {
                    let hue = (
                        visual.centroid * 260 +
                        arm / arms * 180 +
                        time * 22
                    ) % 360;
                    ctx.strokeStyle = 'hsla(' + hue + ', 90%, 68%, 0.45)';
                    ctx.beginPath();
                    for (let step = 0; step <= 48; step += 1) {
                        let ratio = step / 48;
                        let radius = size * (0.05 + ratio * 0.43);
                        let angle = visual.spin * (arm % 2 === 0 ? 1 : -1) +
                            arm / arms * Math.PI * 2 +
                            Math.log(radius + 1) * (2.2 + visual.mid * 2.4) +
                            visual.twist * 0.2;
                        let x = centerX + Math.cos(angle) * radius;
                        let y = centerY + Math.sin(angle) * radius;
                        if (step === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                }

                let sparks = 12 + Math.floor(visual.treble * 28);
                for (let index = 0; index < sparks; index += 1) {
                    let angle = visual.spin * 0.7 +
                        index * 2.399 +
                        time * 0.6;
                    let radius = size * (
                        0.08 + ((index * 0.37) % 0.42)
                    );
                    let x = centerX + Math.cos(angle) * radius;
                    let y = centerY + Math.sin(angle) * radius;
                    let hue = (
                        visual.centroid * 260 +
                        index * 37 +
                        time * 30
                    ) % 360;
                    let sparkSize = Math.max(
                        1,
                        size * 0.002 * (1 + visual.treble * 2)
                    );
                    ctx.fillStyle = 'hsla(' + hue + ', 90%, 76%, ' +
                        (0.18 + visual.treble * 0.5) + ')';
                    ctx.fillRect(
                        x - sparkSize / 2,
                        y - sparkSize / 2,
                        sparkSize,
                        sparkSize
                    );
                }

                if (visual.beat > 0.02) {
                    let shockRadius = size * (
                        0.10 + (1 - visual.beat) * 0.42
                    );
                    let hue = (
                        visual.centroid * 260 + time * 20
                    ) % 360;
                    ctx.strokeStyle = 'hsla(' + hue +
                        ', 95%, 72%, ' + (visual.beat * 0.55) + ')';
                    ctx.lineWidth = Math.max(1, size * 0.004);
                    ctx.beginPath();
                    ctx.arc(
                        centerX,
                        centerY,
                        shockRadius,
                        0,
                        Math.PI * 2
                    );
                    ctx.stroke();
                }

                ctx.globalCompositeOperation = 'source-over';
            },
            destroyWebGL: function() {
                let visual = this.visual;
                if (!visual) {
                    return;
                }
                let gl = visual.gl;
                if (!gl) {
                    return;
                }
                this.deleteFeedbackTargets();
                if (visual.quadBuffer) {
                    gl.deleteBuffer(visual.quadBuffer);
                }
                if (visual.audioTexture) {
                    gl.deleteTexture(visual.audioTexture);
                }
                if (visual.feedbackProgram) {
                    gl.deleteProgram(visual.feedbackProgram);
                }
                if (visual.copyProgram) {
                    gl.deleteProgram(visual.copyProgram);
                }
                visual.gl = null;
                visual.feedbackProgram = null;
                visual.copyProgram = null;
                visual.quadBuffer = null;
                visual.audioTexture = null;
                visual.feedbackUniforms = null;
                visual.copyUniforms = null;
            },
        },
    });

    const RadioBrowser = kiwi.Vue.extend({
        template: '#kiwi-radio-browser',
        components: {
            RadioVisualizer: RadioVisualizer,
        },
        data: function() {
            return {
                radio: getRadio(),
                showForm: false,
                showHidden: false,
                showVisualizer: false,
                editingSource: '',
                formError: '',
                fetchingDetails: false,
                detailStatus: '',
                lastLookupKey: '',
                draft: {
                    name: '',
                    sources: '',
                    image: '',
                    homepage: '',
                    description: '',
                    nowPlaying: '',
                },
            };
        },
        computed: {
            showStationIcons: function() {
                return this.radio.setting('showStationIcons', true) !== false;
            },
            desktopIconsAvailable: function() {
                return !!(NetworkIcons &&
                    typeof NetworkIcons.isAvailable === 'function' &&
                    NetworkIcons.isAvailable());
            },
            desktopMetadataAvailable: function() {
                return desktopHttpAvailable();
            },
            metadataEnabled: function() {
                return this.radio.setting('nowPlaying', true) !== false;
            },
            ordered: function() {
                return this.radio.ui.stations.slice().sort((a, b) => {
                    let aStar = this.radio.isStarred(a.name) ? 0 : 1;
                    let bStar = this.radio.isStarred(b.name) ? 0 : 1;
                    if (aStar !== bStar) {
                        return aStar - bStar;
                    }
                    return this.stationName(a).localeCompare(this.stationName(b));
                });
            },
        },
        mounted: function() {
            this.radio.ui.listOpen = true;
            this.radio.startDetailQueue();
        },
        beforeDestroy: function() {
            this.radio.ui.listOpen = false;
            this.radio.stopDetailQueue();
            this.radio.setVisualizer(false);
        },
        methods: {
            openVisualizer: function() {
                this.showVisualizer = true;
                this.radio.setVisualizer(true);
            },
            closeVisualizer: function() {
                this.showVisualizer = false;
                this.radio.setVisualizer(false);
            },
            stationName: function(station) {
                return stationDisplayName(station);
            },
            stationImage: function(station) {
                return stationDisplayImage(station);
            },
            stationHomepage: function(station) {
                return stationDisplayHomepage(station);
            },
            stationDescription: function(station) {
                return stationDisplayDescription(station);
            },
            stationInfoLine: function(station) {
                let info = stationMetadata(station) || {};
                let live = this.radio.ui.nowPlayingInfo;
                if (!live || live.stationSource !== station.source) {
                    live = null;
                }
                let genre = info.genre || (live && live.genre);
                let bitrate = info.bitrate || (live && live.bitrate);
                let parts = [];
                if (genre) {
                    parts.push(genre);
                }
                if (bitrate) {
                    parts.push(this.$t('radio:bitrate', {
                        bitrate: bitrate,
                    }));
                }
                if (live && typeof live.listeners === 'number') {
                    parts.push(this.$t(
                        live.listeners === 1 ?
                            'radio:listener' :
                            'radio:listeners',
                        { count: live.listeners }
                    ));
                }
                return parts.join(' · ');
            },
            details: function(station) {
                return TextFormatting.linkifyChannels(
                    Utils.escapeHtml(this.stationDescription(station))
                );
            },
            openAddForm: function() {
                this.editingSource = '';
                this.formError = '';
                this.fetchingDetails = false;
                this.detailStatus = '';
                this.lastLookupKey = '';
                this.draft = {
                    name: '',
                    sources: '',
                    image: '',
                    homepage: '',
                    description: '',
                    nowPlaying: '',
                };
                this.showForm = true;
            },
            openEditForm: function(station) {
                if (!station || !station.custom) {
                    return;
                }
                this.editingSource = station.source;
                this.formError = '';
                this.fetchingDetails = false;
                this.detailStatus = '';
                this.lastLookupKey = station.source;
                this.draft = {
                    name: this.stationName(station),
                    sources: stationSources(station).join('\n'),
                    image: this.stationImage(station),
                    homepage: this.stationHomepage(station),
                    description: this.stationDescription(station),
                    nowPlaying: station.nowPlaying === false ?
                        '' :
                        (station.nowPlaying || ''),
                };
                this.showForm = true;
            },
            autoFetchDetails: function() {
                if (this.editingSource ||
                    !this.metadataEnabled ||
                    !this.desktopMetadataAvailable ||
                    this.fetchingDetails) {
                    return;
                }
                let sources = this.draftSources();
                if (!sources.length || sources[0] === this.lastLookupKey) {
                    return;
                }
                this.fetchDetails();
            },
            fetchDetails: function() {
                let sources = this.draftSources();
                if (!sources.length || !this.desktopMetadataAvailable) {
                    return;
                }
                let station = prepareStations([{
                    name: this.draft.name,
                    sources: sources,
                    image: this.draft.image,
                    homepage: this.draft.homepage,
                    description: this.draft.description,
                    nowPlaying: this.draft.nowPlaying,
                }], window.location.href)[0];
                if (!station) {
                    this.detailStatus = 'details_not_found';
                    return;
                }

                this.lastLookupKey = sources[0];
                this.fetchingDetails = true;
                this.detailStatus = 'fetching_details';
                this.radio.fetchStationDetails(station).then((info) => {
                    this.fetchingDetails = false;
                    if (!info) {
                        this.detailStatus = 'details_not_found';
                        return;
                    }
                    if (!this.draft.name && info.name) {
                        this.draft.name = info.name;
                    }
                    if (!this.draft.image && info.image) {
                        this.draft.image = info.image;
                    }
                    if (!this.draft.homepage && info.homepage) {
                        this.draft.homepage = info.homepage;
                    }
                    if (!this.draft.description && info.description) {
                        this.draft.description = info.description;
                    }
                    this.detailStatus = 'details_fetched';
                }).catch(() => {
                    this.fetchingDetails = false;
                    this.detailStatus = 'details_not_found';
                });
            },
            closeForm: function() {
                this.showForm = false;
                this.formError = '';
            },
            draftSources: function() {
                return String(this.draft.sources || '')
                    .split(/[\r\n,]+/)
                    .map((source) => source.trim())
                    .filter(Boolean);
            },
            saveStation: function() {
                let station = Object.assign({}, this.draft, {
                    sources: this.draftSources(),
                });
                let result;
                if (this.editingSource) {
                    result = this.radio.updateStation(
                        this.editingSource,
                        station
                    );
                } else {
                    result = this.radio.addStation(station);
                }
                if (!result.ok) {
                    this.formError = result.error;
                    return;
                }
                this.showForm = false;
                this.formError = '';
            },
            chooseIcon: function() {
                if (!this.desktopIconsAvailable) {
                    return;
                }
                let name = (this.draft.name || 'station')
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]+/g, '-');
                let prefix = 'radio-' + (name || 'station') + '-' +
                    Date.now().toString(36);
                NetworkIcons.choose(prefix).then((result) => {
                    if (result && result.url) {
                        this.draft.image = result.url;
                    }
                }).catch(() => {
                    this.formError = 'image_failed';
                });
            },
            removeStation: function(station) {
                if (!station) {
                    return;
                }
                let message = this.$t('radio:remove_confirm', {
                    name: this.stationName(station),
                });
                if (!window.confirm(message)) {
                    return;
                }
                this.radio.removeStation(station);
            },
            restoreStation: function(station) {
                this.radio.restoreStation(station);
            },
            restoreAllStations: function() {
                this.radio.restoreAllStations();
            },
            close: function(reopen) {
                this.radio.ui.listOpen = false;
                this.radio.stopDetailQueue();
                this.showVisualizer = false;
                this.radio.setVisualizer(false);
                this.$state.$emit('active.component', null);
                if (reopen) {
                    this.$state.$emit('statebrowser.show');
                }
            },
            onDetailsClick: function(event) {
                if (!event.target.closest('a[data-channel-name]')) {
                    return;
                }
                event.stopPropagation();
                this.openChannel(event);
            },
            openChannel: function(event) {
                let el = event.target.closest('a[data-channel-name]');
                if (!el) {
                    return;
                }
                event.preventDefault();
                let networks = this.$state.networks || [];
                let network = null;
                networks.forEach((item) => {
                    if (!network && item.state === 'connected' && item.ircClient) {
                        network = item;
                    }
                });
                if (!network || !network.ircClient) {
                    return;
                }
                let name = el.getAttribute('data-channel-name');
                if (!name) {
                    return;
                }
                this.$state.addBuffer(network.id, name);
                let buffer = this.$state.getBufferByName(network.id, name);
                if (buffer && !buffer.joined) {
                    network.ircClient.join(name);
                }
                this.$state.setActiveBuffer(network.id, name);
                if (this.$state.ui.app_width <= 550) {
                    this.close();
                }
            },
        },
    });

    let RadioControls = kiwi.Vue.extend({
        template: '#kiwi-radio-controls',
        data: function() {
            return {
                radio: getRadio(),
                waveFrame: 0,
                waveFrequencyData: null,
                waveTimeData: null,
                waveSmoothData: null,
                wavePeaks: null,
                wavePulseLevel: 0,
                waveLastUpdate: 0,
                waveTop: '#5ec9a6',
                waveBottom: '#2f896b',
                nameScroll: 0,
                nameObserver: null,
                trackScroll: 0,
                trackObserver: null,
            };
        },
        computed: {
            available: function() {
                return this.radio.enabled();
            },
            showWave: function() {
                return this.radio.waveEnabled() &&
                    this.radio.ui.playing &&
                    this.radio.ui.waveReady;
            },
            nameScrollStyle: function() {
                if (!this.nameScroll) {
                    return null;
                }
                let travel = Math.max(3, this.nameScroll / 28);
                return {
                    '--kiwi-radio-scroll': this.nameScroll + 'px',
                    'animation-duration': (travel + 3) + 's',
                };
            },
            trackScrollStyle: function() {
                if (!this.trackScroll) {
                    return null;
                }
                let travel = Math.max(3, this.trackScroll / 28);
                return {
                    '--kiwi-radio-scroll': this.trackScroll + 'px',
                    'animation-duration': (travel + 3) + 's',
                };
            },
        },
        watch: {
            'available': function(show) {
                if (show) {
                    this.$nextTick(() => {
                        this.observeName();
                        this.measureName();
                    });
                }
            },
            'radio.ui.currentName': function() {
                this.measureName();
            },
            'radio.ui.currentLabel': function() {
                this.measureName();
            },
            'radio.ui.trackTitle': function() {
                this.$nextTick(() => {
                    if (!this.radio.ui.trackTitle) {
                        this.trackScroll = 0;
                        this.disconnectTrackObserver();
                        return;
                    }
                    this.observeTrack();
                    this.measureTrack();
                });
            },
            'showWave': {
                immediate: true,
                handler: function(show) {
                    this.stopWave();
                    if (show) {
                        this.readWaveColours();
                        this.drawWave();
                    }
                },
            },
        },
        created: function() {
            if (!this.radio.enabled()) {
                return;
            }
            this.radio.loadStations();
            if (this.radio.setting('autoPlay', false)) {
                this.$state.$once('document.clicked', () => {
                    this.radio.playCurrent();
                });
            }
        },
        mounted: function() {
            this.readWaveColours();
            this.listen(this.$state, 'theme.change', this.readWaveColours);
        },
        beforeDestroy: function() {
            this.stopWave();
            if (this.nameObserver) {
                this.nameObserver.disconnect();
                this.nameObserver = null;
            }
            this.disconnectTrackObserver();
        },
        methods: {
            readWaveColours: function() {
                let canvas = this.$refs.wave;
                if (!canvas) {
                    return;
                }
                let styles = window.getComputedStyle(canvas);
                this.waveTop = styles.getPropertyValue('--brand-primary-hover').trim() || '#5ec9a6';
                this.waveBottom = styles.getPropertyValue('--brand-primary').trim() || '#2f896b';
            },
            observeName: function() {
                let track = this.$refs.nameTrack;
                if (!track || this.nameObserver || !window.ResizeObserver) {
                    return;
                }
                this.nameObserver = new ResizeObserver(() => {
                    this.measureName();
                });
                this.nameObserver.observe(track);
            },
            measureName: function() {
                this.$nextTick(() => {
                    let track = this.$refs.nameTrack;
                    let text = this.$refs.nameText;
                    if (!track || !text) {
                        this.nameScroll = 0;
                        return;
                    }
                    let overflow = text.scrollWidth - track.clientWidth;
                    this.nameScroll = overflow > 2 ? overflow : 0;
                });
            },
            observeTrack: function() {
                let track = this.$refs.trackTrack;
                if (!track || !window.ResizeObserver) {
                    return;
                }
                this.disconnectTrackObserver();
                this.trackObserver = new ResizeObserver(() => {
                    this.measureTrack();
                });
                this.trackObserver.observe(track);
            },
            measureTrack: function() {
                this.$nextTick(() => {
                    let track = this.$refs.trackTrack;
                    let text = this.$refs.trackText;
                    if (!track || !text) {
                        this.trackScroll = 0;
                        return;
                    }
                    let overflow = text.scrollWidth - track.clientWidth;
                    this.trackScroll = overflow > 2 ? overflow : 0;
                });
            },
            disconnectTrackObserver: function() {
                if (this.trackObserver) {
                    this.trackObserver.disconnect();
                    this.trackObserver = null;
                }
            },
            openList: function() {
                if (this.radio.ui.listOpen) {
                    this.radio.ui.listOpen = false;
                    this.$state.$emit('active.component', null);
                    this.$state.$emit('statebrowser.show');
                    return;
                }
                openBrowser();
            },
            onVolume: function(event) {
                this.radio.setVolume(event.target.value);
            },
            stopWave: function() {
                if (this.waveFrame) {
                    window.cancelAnimationFrame(this.waveFrame);
                    this.waveFrame = 0;
                }
            },
            drawBars: function(ctx, data, canvas, gradient) {
                let bar = canvas.width / data.length;
                ctx.fillStyle = gradient;
                data.forEach((value, index) => {
                    let height = (value / 255) * canvas.height;
                    ctx.fillRect(
                        index * bar,
                        canvas.height - height,
                        Math.max(1, bar - 1),
                        height
                    );
                });
            },
            drawMirrorBars: function(ctx, data, canvas, gradient) {
                let bar = canvas.width / data.length;
                let middle = canvas.height / 2;
                ctx.fillStyle = gradient;
                data.forEach((value, index) => {
                    let height = (value / 255) * middle;
                    ctx.fillRect(
                        index * bar,
                        middle - height,
                        Math.max(1, bar - 1),
                        height * 2
                    );
                });
            },
            buildWavePoints: function(data) {
                let points = new Float32Array(WAVE_POINTS);
                let span = data.length / WAVE_POINTS;
                for (let index = 0; index < WAVE_POINTS; index += 1) {
                    let start = Math.floor(index * span);
                    let end = Math.max(start + 1, Math.floor((index + 1) * span));
                    let peak = 0;
                    for (let sample = start; sample < end; sample += 1) {
                        let value = data[sample] - 128;
                        if (Math.abs(value) > Math.abs(peak)) {
                            peak = value;
                        }
                    }
                    points[index] = 128 + peak;
                }

                let spatial = new Float32Array(WAVE_POINTS);
                for (let index = 0; index < WAVE_POINTS; index += 1) {
                    let previous = points[Math.max(0, index - 1)];
                    let next = points[Math.min(WAVE_POINTS - 1, index + 1)];
                    spatial[index] = (previous + points[index] * 2 + next) / 4;
                }

                if (!this.waveSmoothData ||
                    this.waveSmoothData.length !== WAVE_POINTS
                ) {
                    this.waveSmoothData = new Float32Array(WAVE_POINTS);
                    this.waveSmoothData.fill(128);
                }
                for (let index = 0; index < WAVE_POINTS; index += 1) {
                    this.waveSmoothData[index] =
                        this.waveSmoothData[index] * WAVE_SMOOTHING +
                        spatial[index] * (1 - WAVE_SMOOTHING);
                }
                return this.waveSmoothData;
            },
            wavePointY: function(value, canvas) {
                let normal = ((value - 128) / 128) * WAVE_GAIN;
                normal = Math.max(-1, Math.min(1, normal));
                return ((normal + 1) / 2) * canvas.height;
            },
            drawWaveLine: function(ctx, data, canvas, colour) {
                let length = data.length;
                if (!length) {
                    return;
                }
                ctx.beginPath();
                data.forEach((value, index) => {
                    let x = (index / Math.max(1, length - 1)) * canvas.width;
                    let y = this.wavePointY(value, canvas);
                    if (index === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.strokeStyle = colour;
                ctx.stroke();
            },
            drawAreaWave: function(ctx, data, canvas, gradient, colour) {
                let length = data.length;
                if (!length) {
                    return;
                }

                let pointX = function(index) {
                    return (index / Math.max(1, length - 1)) * canvas.width;
                };
                let pointY = (value) => this.wavePointY(value, canvas);

                ctx.beginPath();
                ctx.moveTo(0, canvas.height);
                data.forEach((value, index) => {
                    ctx.lineTo(pointX(index), pointY(value));
                });
                ctx.lineTo(canvas.width, canvas.height);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.beginPath();
                data.forEach((value, index) => {
                    if (index === 0) {
                        ctx.moveTo(pointX(index), pointY(value));
                    } else {
                        ctx.lineTo(pointX(index), pointY(value));
                    }
                });
                ctx.lineWidth = 1.5;
                ctx.lineJoin = 'round';
                ctx.strokeStyle = colour;
                ctx.stroke();
            },
            drawLedSpectrum: function(ctx, data, canvas, gradient) {
                let columns = 24;
                let rows = 4;
                let cellWidth = canvas.width / columns;
                let cellHeight = canvas.height / rows;
                for (let column = 0; column < columns; column += 1) {
                    let start = Math.floor((column / columns) * data.length);
                    let end = Math.floor(((column + 1) / columns) * data.length);
                    let peak = 0;
                    for (let index = start; index < end; index += 1) {
                        peak = Math.max(peak, data[index] || 0);
                    }
                    let litRows = Math.ceil((peak / 255) * rows);
                    for (let row = 0; row < rows; row += 1) {
                        let x = column * cellWidth;
                        let y = canvas.height - ((row + 1) * cellHeight);
                        ctx.fillStyle = row < litRows ?
                            gradient :
                            'rgba(255, 255, 255, 0.05)';
                        ctx.fillRect(
                            x + 1,
                            y + 1,
                            Math.max(1, cellWidth - 2),
                            Math.max(1, cellHeight - 2)
                        );
                    }
                }
            },
            drawPulse: function(ctx, data, canvas, gradient) {
                let total = 0;
                data.forEach((value) => {
                    total += value;
                });
                let level = data.length ? (total / data.length) / 255 : 0;
                this.wavePulseLevel =
                    this.wavePulseLevel * 0.72 +
                    level * 0.28;
                let height = Math.max(2, this.wavePulseLevel * (canvas.height - 4));
                let y = (canvas.height - height) / 2;
                ctx.fillStyle = gradient;
                ctx.fillRect(0, y, canvas.width, height);
            },
            drawPeakCaps: function(ctx, data, canvas, gradient, colour) {
                let bar = canvas.width / data.length;
                if (!this.wavePeaks || this.wavePeaks.length !== data.length) {
                    this.wavePeaks = new Float32Array(data.length);
                }

                data.forEach((value, index) => {
                    let peak = this.wavePeaks[index] || 0;
                    peak = value >= peak ?
                        value :
                        Math.max(0, peak - WAVE_PEAK_DECAY);
                    this.wavePeaks[index] = peak;
                });

                ctx.fillStyle = gradient;
                data.forEach((value, index) => {
                    let height = (value / 255) * canvas.height;
                    ctx.fillRect(
                        index * bar,
                        canvas.height - height,
                        Math.max(1, bar - 1),
                        height
                    );
                });

                ctx.fillStyle = colour;
                this.wavePeaks.forEach((peak, index) => {
                    let height = (peak / 255) * canvas.height;
                    ctx.fillRect(
                        index * bar,
                        Math.max(0, canvas.height - height - 1),
                        Math.max(1, bar - 1),
                        2
                    );
                });
            },
            drawWave: function() {
                this.stopWave();
                let canvas = this.$refs.wave;
                let analyser = this.radio.ui.analyser;
                if (!canvas || !analyser || !this.showWave) {
                    if (this.showWave) {
                        this.waveFrame = window.requestAnimationFrame(() => {
                            this.drawWave();
                        });
                    }
                    return;
                }

                let style = this.radio.waveStyle();
                let ctx = canvas.getContext('2d');
                let top = this.waveTop;
                let bottom = this.waveBottom;
                let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, top);
                gradient.addColorStop(1, bottom);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (style === 'wave' || style === 'area') {
                    let length = analyser.fftSize;
                    if (!this.waveTimeData || this.waveTimeData.length !== length) {
                        this.waveTimeData = new Uint8Array(length);
                    }
                    let now = Date.now();
                    if (!this.waveLastUpdate ||
                        now - this.waveLastUpdate >= WAVE_UPDATE_MS
                    ) {
                        analyser.getByteTimeDomainData(this.waveTimeData);
                        this.waveLastUpdate = now;
                        this.buildWavePoints(this.waveTimeData);
                    }
                    let data = this.waveSmoothData;
                    if (data) {
                        if (style === 'wave') {
                            this.drawWaveLine(ctx, data, canvas, top);
                        } else {
                            this.drawAreaWave(ctx, data, canvas, gradient, top);
                        }
                    }
                } else {
                    let length = analyser.frequencyBinCount;
                    if (!this.waveFrequencyData ||
                        this.waveFrequencyData.length !== length
                    ) {
                        this.waveFrequencyData = new Uint8Array(length);
                    }
                    analyser.getByteFrequencyData(this.waveFrequencyData);
                    if (style === 'mirror') {
                        this.drawMirrorBars(ctx, this.waveFrequencyData, canvas, gradient);
                    } else if (style === 'led') {
                        this.drawLedSpectrum(ctx, this.waveFrequencyData, canvas, gradient);
                    } else if (style === 'pulse') {
                        this.drawPulse(ctx, this.waveFrequencyData, canvas, gradient);
                    } else if (style === 'peaks') {
                        this.drawPeakCaps(
                            ctx,
                            this.waveFrequencyData,
                            canvas,
                            gradient,
                            top
                        );
                    } else {
                        this.drawBars(ctx, this.waveFrequencyData, canvas, gradient);
                    }
                }

                this.waveFrame = window.requestAnimationFrame(() => {
                    this.drawWave();
                });
            },
        },
    });

    let settingsTemplate = document.getElementById('kiwi-radio-settings');
    let RadioSettings = kiwi.Vue.extend({
        template: settingsTemplate ? settingsTemplate.innerHTML : '<div></div>',
        computed: {
            enabled: function() {
                return getRadio().setting('enabled', true) !== false;
            },
            nowPlaying: function() {
                return getRadio().setting('nowPlaying', true) !== false;
            },
            showStationIcons: function() {
                return getRadio().setting('showStationIcons', true) !== false;
            },
            waveStyle: function() {
                return getRadio().waveStyle();
            },
        },
        methods: {
            setEnabled: function(value) {
                setSetting('enabled', !!value);
                getRadio().applySettings();
            },
            setNowPlaying: function(value) {
                setSetting('nowPlaying', !!value);
                getRadio().applySettings();
            },
            setShowStationIcons: function(value) {
                setSetting('showStationIcons', !!value);
            },
            setWaveStyle: function(value) {
                if (WAVE_STYLES.indexOf(value) === -1) {
                    return;
                }
                setSetting('waveStyle', value);
                getRadio().applySettings();
            },
        },
    });

    kiwi.addTranslations('radio', {
        'en-us': {
            play: 'Play',
            pause: 'Pause',
            prev: 'Previous station',
            next: 'Next station',
            stations: 'Radio Stations',
            mute: 'Mute',
            unmute: 'Unmute',
            star: 'Star station',
            unstar: 'Unstar station',
            volume: 'Volume',
            close: 'Close',
            enable: 'Enable Radio',
            show_now_playing: 'Fetch Station Metadata',
            show_station_icons: 'Show Station Icons',
            show_waveform: 'Show Waveform',
            wave_none: 'None',
            wave_bars: 'Bars',
            wave_mirror: 'Mirror Bars',
            wave_wave: 'Wave',
            wave_area: 'Area Wave',
            wave_led: 'LED Spectrum',
            wave_pulse: 'Pulse',
            wave_peaks: 'Peak Caps',
            visualizer: 'Visualizer',
            visualizer_idle: 'Select a station to start the visualizer.',
            visualizer_waiting_audio: 'Waiting for audio samples…',
            visualizer_no_audio: 'This stream does not provide audio samples for the visualizer.',
            visualizer_back: 'Back to Stations',
            visualizer_fullscreen: 'Fullscreen',
            visualizer_exit_fullscreen: 'Exit Fullscreen',
            add_station: 'Add Station',
            edit_station: 'Edit Station',
            save_station: 'Save Station',
            cancel: 'Cancel',
            station_name: 'Name',
            station_sources: 'Stream URLs',
            station_homepage: 'Homepage URL',
            station_icon: 'Icon URL',
            choose_icon: 'Choose Image',
            station_description: 'Description',
            station_now_playing: 'Now Playing URL',
            fetch_details: 'Fetch Details',
            fetching_details: 'Fetching Details…',
            details_fetched: 'Station details found.',
            details_not_found: 'No station details found.',
            bitrate: '{{bitrate}} kbps',
            listener: '{{count}} listener',
            listeners: '{{count}} listeners',
            remove_station: 'Remove Station',
            remove_confirm: 'Remove station "{{name}}"?',
            hidden_stations: 'Hidden Stations ({{count}})',
            restore_station: 'Restore',
            restore_all_stations: 'Restore All',
            invalid_source: 'Enter a valid HTTP or HTTPS stream URL.',
            duplicate_station: 'A station with that name or stream URL already exists.',
            station_not_found: 'That station is no longer available.',
            image_failed: 'Unable to use the selected image.',
            loading: 'Loading stations…',
            load_failed: 'Unable to load stations.',
            none: 'No stations available.',
            error: 'Unable to play this station.',
        },
    });

    kiwi.addUi('browser', RadioControls);
    kiwi.addSettingsBlock('general', RadioSettings, {
        title: 'Radio',
    });
    kiwi.registerService('radio', {
        enabled: function() {
            return getRadio().enabled();
        },
        getRadio: getRadio,
        openBrowser: openBrowser,
    });
});
