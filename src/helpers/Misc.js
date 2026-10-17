'kiwi public';

/** @module */

import Vue from 'vue';
import PluginWrapper from '@/components/utils/PluginWrapper';
import * as TextFormatting from '@/helpers/TextFormatting';
import { urlRegex } from './TextFormatting';
import { each, escapeRegExp, isPlainObject, setPath } from '@/helpers/Utils';

const styleStripRegexp = new RegExp(
    // Decimal Colours
    /(\x03(\u200B|[0-9]{1,2})(\u200B|,[0-9]{1,2})?|\x03)|/.source +
    // Hex Colours
    /(\x04(\u200B|[0-9a-fA-F]{6})(\u200B|,[0-9a-fA-F]{6})?|\x04)|/.source +
    // Styles
    /[\x02\x1d\x1f\x1e\x11\x16\x0f]/.source,
    'g'
);

let labelId = 0;

/**
 * Generate a unique label for use with the labeled-response IRCv3 spec
 * @returns {String}
 */
export function generateLabel() {
    return 'kiwi-l-' + Date.now() + '-' + labelId++;
}

/**
 * Extract an array of buffers from a string, parsing multiple buffer names and channel keys
 * "#chan,#chan2" => 2 channels without a key
 * "#chan,#chan2 key" => 2 channels, the first having a key
 * "#chan,#chan2 key1,key2" => 2 channels, both having a key
 * "#chan,#chan2 ,key2" => 2 channels, the second having a key
 * @param {string} str List of buffer names and channel keys
 */
export function extractBuffers(str) {
    let spaceIdx = str.indexOf(' ');
    if (spaceIdx === -1) spaceIdx = str.length;

    let bufferNames = str.substr(0, spaceIdx).split(',');
    let keys = str.substr(spaceIdx + 1).split(',');

    let buffers = [];
    bufferNames.forEach((bufferName, idx) => {
        // return if bufferName is empty
        if (!bufferName.trim()) {
            return;
        }
        buffers.push({
            name: bufferName,
            key: keys[idx] || '',
        });
    });

    return buffers;
}

export function extractURL(str) {
    let matches = str.match(urlRegex);
    return matches ? matches[0] : '';
}

export function stripStyles(str) {
    return str.replace(styleStripRegexp, '');
}

/**
 * Sanitize a URL to prevent dangerous schemes and remove control characters
 * @param {string} url The URL to sanitize
 * @returns {string} The sanitized URL or an empty string
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }

    // Strip all control codes (0x00-0x1F and 0x7F-0x9F) from URLs
    // Unlike other metadata, URLs should never contain \n, \r, or \t
    const cleanUrl = url.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

    // Only allow http, https, relative paths, or template variables
    const isSafe = /^(https?:\/\/|\/|\{)/i.test(cleanUrl);
    return isSafe ? cleanUrl : '';
}

/**
 * Get information about media from a URL
 * @param {string} url The URL to analyze
 * @returns {object} { type: string, url: string, id: string }
 */
export function getMediaInfo(url) {
    const info = {
        type: '',
        url: url,
        id: '',
    };

    if (!url) {
        return info;
    }

    // Exclude common file-wrapper pages (e.g. Wikipedia File: pages)
    if (url.match(/\/wiki\/File:/i)) {
        return info;
    }

    // Google Image Search thumbnails
    if (url.match(/encrypted-tbn[0-9]\.gstatic\.com\/images/i) &&
        (url.includes('tbn:') || url.includes('ANd9Gc'))) {
        info.type = 'image';
        return info;
    }

    const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
    const isImage = cleanUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ||
                   url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)([?#]|$)/i);

    if (isImage) {
        info.type = 'image';
        return info;
    }

    const isAudio = cleanUrl.match(/\.(mp3|wav|ogg|m4a|flac)$/i) ||
                   url.match(/\.(mp3|wav|ogg|m4a|flac)([?#]|$)/i);

    if (isAudio) {
        info.type = 'audio';
        return info;
    }

    const isVideo = cleanUrl.match(/\.(mp4|webm|ogv|mov)$/i) ||
                   url.match(/\.(mp4|webm|ogv|mov)([?#]|$)/i);

    if (isVideo) {
        info.type = 'video';
        return info;
    }

    // YouTube
    const ytShortsMatch = url.match(/youtube\.com\/shorts\/([^"&?/\s]{11})/i);
    if (ytShortsMatch) {
        info.type = 'youtube-shorts';
        info.id = ytShortsMatch[1];
        return info;
    }

    const ytMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
    if (ytMatch) {
        info.type = 'youtube';
        info.id = ytMatch[1];
        return info;
    }

    // Twitch
    const twitchClipMatch = url.match(/clips\.twitch\.tv\/([a-z0-9_-]+)/i) || url.match(/twitch\.tv\/\w+\/clip\/([a-z0-9_-]+)/i);
    if (twitchClipMatch) {
        info.type = 'twitch-clip';
        info.id = twitchClipMatch[1];
        return info;
    }
    const twitchChannelMatch = url.match(/twitch\.tv\/([a-z0-9_]+)/i);
    if (twitchChannelMatch) {
        // Exclude some common twitch paths that aren't channels
        const excluded = ['directory', 'videos', 'p', 'about', 'jobs', 'press'];
        if (!excluded.includes(twitchChannelMatch[1].toLowerCase())) {
            info.type = 'twitch-channel';
            info.id = twitchChannelMatch[1];
            return info;
        }
    }

    // Mastodon/Fediverse heuristic
    // Matches patterns like /@user/12345 or /users/user/statuses/12345
    if (url.match(/\/@\w+\/\d+/) || url.match(/\/users\/\w+\/statuses\/\d+/)) {
        info.type = 'fediverse';
        return info;
    }

    // Giphy
    const giphyMatch = url.match(/giphy\.com\/(?:gifs|clips)\/.*-([a-z0-9_-]+)/i) || url.match(/giphy\.com\/gifs\/([a-z0-9_-]+)/i);
    if (giphyMatch) {
        info.type = 'giphy';
        info.id = giphyMatch[1];
        return info;
    }

    // Streamable
    const streamableMatch = url.match(/streamable\.com\/(?:[seo]\/)?([a-z0-9]+)/i);
    if (streamableMatch) {
        info.type = 'streamable';
        info.id = streamableMatch[1];
        return info;
    }

    // RedGifs
    const redgifsMatch = url.match(/redgifs\.com\/watch\/([a-z0-9_-]+)/i);
    if (redgifsMatch) {
        info.type = 'redgifs';
        info.id = redgifsMatch[1];
        return info;
    }

    // Steam Store
    const steamMatch = url.match(/store\.steampowered\.com\/app\/([0-9]+)/i);
    if (steamMatch) {
        info.type = 'steam';
        info.id = steamMatch[1];
        return info;
    }

    // Imgur
    const imgurMatch = url.match(/imgur\.com\/(?:gallery\/|a\/)?(?:.*-)?([a-z0-9]+)/i);
    if (imgurMatch) {
        const id = imgurMatch[1];
        const excluded = ['gallery', 'upload', 'about', 'apps', 'privacy', 'tos', 'jobs'];
        if (!excluded.includes(id.toLowerCase())) {
            // Check for a specific image ID in the fragment (e.g. gallery/slug#imageID)
            const fragmentMatch = url.match(/#([a-z0-9]{5,10})$/i);
            if (fragmentMatch) {
                info.type = 'image';
                info.url = `https://i.imgur.com/${fragmentMatch[1]}.png`;
                return info;
            }

            const isPageWithId = !url.match(/imgur\.com\/(?:gallery\/|a\/)/i);
            if (isPageWithId) {
                // Transform single image page to direct image link to avoid X-Frame-Options block
                info.type = 'image';
                info.url = `https://i.imgur.com/${id}.png`;
                return info;
            }
        }
    }

    // Spotify
    const spotifyMatch = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([a-z0-9]{22})/i);
    if (spotifyMatch) {
        info.type = 'spotify';
        info.id = spotifyMatch[1].toLowerCase() + '/' + spotifyMatch[2];
        return info;
    }

    // SoundCloud
    const soundcloudMatch = url.match(/(?:www\.)?soundcloud\.com\/([a-z0-9_-]+)\/([a-z0-9_-]+)(?:\/([a-z0-9_-]+))?/i);
    if (soundcloudMatch) {
        const owner = soundcloudMatch[1];
        const second = soundcloudMatch[2].toLowerCase();
        const third = soundcloudMatch[3];
        const excluded = ['likes', 'tracks', 'playlists', 'albums', 'followers', 'following', 'stations', 'search'];
        if (second === 'sets' && third) {
            info.type = 'soundcloud';
            info.id = owner + '/sets/' + third;
            return info;
        }
        if (!excluded.includes(second) && !third) {
            info.type = 'soundcloud';
            info.id = owner + '/' + soundcloudMatch[2];
            return info;
        }
    }

    return info;
}

/**
 * Replace IRC control characters with visible Unicode glyphs
 * @param {string} str The string to process
 */
export function controlCharsToGlyphs(str) {
    const glyphMap = {
        '\x02': '\u2402', // ␂
        '\x03': '\u2403', // ␃
        '\x04': '\u2404', // ␄
        '\x0f': '\u240F', // ␏
        '\x11': '\u2411', // ␑
        '\x16': '\u2416', // ␖
        '\x1d': '\u241D', // ␝
        '\x1e': '\u241E', // ␞
        '\x1f': '\u241F', // ␟
    };
    return str.replace(/[\x02\x03\x04\x0f\x11\x16\x1d\x1e\x1f]/g, (match) => glyphMap[match] || match);
}

/**
 * Does a string mention a nickname?
 * @param {string} input The string to search within
 * @param {string} nick The nick to search for
 */
export function mentionsNick(input, nick) {
    if (input.toLowerCase().indexOf(nick.toLowerCase()) === -1) {
        return false;
    }
    let punc = '\\s,.!:;+()\\[\\]?¿\\/<>@-';
    let escapedNick = escapeRegExp(nick);
    let stylesStrippedInput = stripStyles(input);
    let withoutUrls = stylesStrippedInput.replace(new RegExp(urlRegex.source, 'gi'), ' ');
    let r = new RegExp(`(^|[${punc}])${escapedNick}([${punc}]|$)`, 'i');
    return r.test(withoutUrls);
}

/**
 * Get a query string value from the current URL
 * @param {string} _name The query string variable name
 * @param {string} _url The full URL to extract the variable from
 */
export function queryStringVal(_name, _url) {
    let url = _url || window.location.href;
    let name = escapeRegExp(_name);
    let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    let results = regex.exec(url);

    if (!results) {
        return null;
    }
    if (!results[2]) {
        return '';
    }

    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Convert a known error code to a human readable message
 * @param {string} err The error message from the network connection
 */
export function networkErrorMessage(err) {
    const translationKey = err.replace(/^err_/, 'error_');
    const translation = TextFormatting.t(translationKey);
    if (translation === translationKey) {
        return TextFormatting.t('error_unknown');
    }

    return translation;
}

/**
 * Replace ? in nick with random number
 * @param {String} nick A users nick where ? needs replacing
 * @returns {String}
 */
export function processNickRandomNumber(nick) {
    // Replace ? with a random number
    return (nick || 'kiwi-n?').replace(/\?/g, () => Math.floor(Math.random() * 100).toString()).trim();
}

/**
 * Take a users connection object (usually from startupOptions) and normalise a connection
 * settings object. Parses websocket/direct/kiwiServer/etc options and creates a single
 * object that Kiwi can consistently read from.
 * @param {Object} config User provided connection config object
 */
export function connectionInfoFromConfig(config) {
    let connection = {
        tls: false,
        port: 0,
        hostname: '',
        direct: false,
        direct_path: '',
    };

    let wsUri = config.websocket ?
        matchUri(config.websocket) :
        null;

    if (wsUri) {
        connection.direct = true;
        connection.tls = ['wss', 'https', 'ircs'].indexOf(wsUri.protocol) > -1;
        connection.port = wsUri.port;
        connection.hostname = wsUri.hostname;
        connection.direct_path = wsUri.path;
        if (wsUri.search) {
            connection.direct_path += '?' + wsUri.search;
        }
    } else {
        connection.tls = config.tls;
        connection.port = config.port;
        connection.hostname = config.server;
        connection.direct = !!config.direct;
        connection.direct_path = config.direct_path || '';
    }

    return connection;
}

export function matchUri(uri) {
    let reg = /(?:([a-z]+):\/\/)?([a-z.0-9-]+)(?::(?:(\+)?([0-9]+)))?(?:\/([^?]*))?(?:\?(.*))?/;
    /*
    0: "ws://hostname.com:6676/erferf?foo=val"
    1: "ws"
    2: "hostname.com"
    3: undefined
    4: "6676"
    5: "erferf"
    6: "foo=var"
    */
    let m = uri.match(reg);
    if (!m) {
        return null;
    }

    return {
        protocol: (m[1] || '').toLowerCase(),
        hostname: m[2] || '',
        port: parseIntZero(m[4] || ''),
        path: '/' + (m[5] || ''),
        search: m[6] || '',
    };
}

/**
 * Parse a connection string into an object
 * E.g. [ircs?://]irc.network.net:[+]6667/channel?nick=mynick;
 * Multiple connections may be given, separated by ;
 * @param {string} str The connection string URI
 */
export function parseIrcUri(str) {
    let reg = /(?:(ircs?|wss?):\/\/)?([a-z.0-9-]+)(?::(?:(\+)?([0-9]+)))?(?:\/([^?]*))?(?:\?(.*))?/;
    let connections = [];
    str.split(';').forEach((connectionString) => {
        if (!connectionString) {
            return;
        }

        let m = connectionString.match(reg);

        if (!m) {
            return;
        }

        let tls = m[1] === 'ircs' || m[1] === 'wss' || !!m[3];
        let direct = m[1] === 'ws' || m[1] === 'wss';
        let params = Object.create(null);
        (m[6] || '').split('&').forEach((p) => {
            let parts = p.split('=');
            if (parts.length === 2) {
                params[parts[0].toLowerCase()] = parts[1];
            }
        });

        let channels = (m[5] || params.channel || '');
        channels = channels.split(',')
            .filter((channelName) => !!channelName)
            .map((channelName) => {
                let hasPrefix = channelName[0] === '#' ||
                    channelName[0] === '&';

                return hasPrefix ?
                    channelName :
                    '#' + channelName;
            });

        connections.push({
            tls: tls,
            server: m[2],
            port: parseInt(m[4] || (tls ? 6697 : 6667), 10),
            channels: channels,
            nick: params.nick || '',
            encoding: (params.encoding || 'utf8'),
            params: params,
            direct: direct,
        });
    });

    return connections;
}

export function getDefaultConnection() {
    const connection = {
        name: '',
        server: '',
        port: 6667,
        tls: false,
        direct: false,
        path: '',
        type: 'irc',
        channels: '',
    };

    Object.defineProperty(connection, 'toUri', {
        value: () => connectionToUri(connection),
    });

    return connection;
}

const presetServerRegex = /^(?:(?<name>[^|\r\n]+)\|)?(?:(?<proto>(?:irc|ws)s?):\/\/)?(?<server>[^:/#?\r\n]+|(?:\[[^\]]+\]))(?::(?:(?<tls>\+)?(?<port>\d+)))?(?<path>\/([^#?\r\n])+)?(?<channels>[#&][^?\r\n]+)?(?:\?(?<params>.+))?$/;

/**
 * Parse preset server string to an object
 * format: freenode|irc.freenode.net:+6697
 * @param {string} input Preset server string
 */
export function parsePresetServer(input) {
    const match = presetServerRegex.exec(input);
    if (!match || !match.groups) {
        return null;
    }

    const conn = getDefaultConnection();

    if (match.groups.tls === '+') {
        conn.tls = true;
    }

    if (match.groups.proto === 'ircs') {
        conn.port = 6697;
        conn.tls = true;
    } else if (match.groups.proto === 'ws') {
        conn.port = 8067;
        conn.direct = true;
    } else if (match.groups.proto === 'wss') {
        conn.port = 8097;
        conn.tls = true;
        conn.direct = true;
    }

    if (match.groups.port) {
        conn.port = parseInt(match.groups.port, 10);
    }

    if (match.groups.name) {
        conn.name = match.groups.name;
    } else {
        conn.name = match.groups.server;
    }

    if (match.groups.path) {
        conn.path = match.groups.path;
    }

    if (match.groups.params) {
        conn.params = new URLSearchParams(match.groups.params);
    }

    if (conn.params?.has('type')) {
        let type = conn.params.get('type');
        if (type === 'znc') {
            type = 'bnc';
        }

        if (['irc', 'bnc'].includes(type)) {
            conn.type = type;
        }
    }

    if (match.groups.channels) {
        conn.channels = conn.type === 'bnc'
            ? match.groups.channels.slice(1)
            : match.groups.channels;
    }

    conn.server = match.groups.server;

    return conn;
}

export function connectionToUri(conn) {
    let proto = (conn.direct) ? 'ws' : 'irc';

    if (conn.tls) {
        proto += 's';
    }

    return `${proto}://${conn.server}:${conn.port}${conn.path}`;
}

/**
 * Scan though an object and extend any dot notated keys
 * @param {Object} confObj Source object to traverse
 */
export function dedotObject(confObj) {
    if (Array.isArray(confObj)) {
        return;
    }

    each(confObj, (val, key) => {
        if (typeof key === 'string' && key.includes('.')) {
            const path = key.split('.').filter(Boolean);
            if (path.length > 1) {
                delete confObj[key];
                setPath(confObj, path, val);
                return;
            }
        }

        if (isPlainObject(val)) {
            dedotObject(val);
        }
    });
}

/**
 * Replace the target object with source, while keeping the target object reference intact.
 * Delete all the properties from the target object and copy the properties from source
 * over to the target.
 * a = {one: 1, two: 2, three: 3}
 * b = {four: 4, five: 5, six: 6}
 * replaceObjectProps(a, b)
 * a.one === undefined;
 * a.six === 6;
 * @param {Object} target The target object that will be replaced
 * @param {Object} source The source object from which all properties will be copied from
 */
export function replaceObjectProps(target, source) {
    Object.keys(target).forEach((prop) => delete target[prop]);
    Object.keys(source).forEach((prop) => { target[prop] = source[prop]; });
}

/**
 * Create an ISO8601 formatted date
 * @param {Date} date The date object to create the time from. Defaults to the current time
 */
export function dateIso(date) {
    let d = date || new Date();
    return d.toISOString();
}

/**
 * Compare two semver version strings, following semver precedence rules.
 * Numeric dot-separated segments are compared first, then prerelease ordering
 * (a version with a prerelease ranks below the same release version, numeric
 * prerelease identifiers rank below alphanumeric ones).
 * @param {String} a The first version to compare
 * @param {String} b The second version to compare
 * @returns {Number} 1 if a is greater than b, -1 if a is less than b, 0 if equal
 */
export function compareVersions(a, b) {
    let parse = (version) => {
        let parts = String(version).trim().replace(/^v/, '').split('+')[0].split('-');
        let release = parts.shift().split('.').map((n) => parseInt(n, 10) || 0);
        let prerelease = parts.length ? parts.join('-').split('.') : null;
        return { release, prerelease };
    };

    let va = parse(a);
    let vb = parse(b);

    let len = Math.max(va.release.length, vb.release.length);
    for (let i = 0; i < len; i++) {
        let na = va.release[i] || 0;
        let nb = vb.release[i] || 0;
        if (na !== nb) {
            return na > nb ? 1 : -1;
        }
    }

    if (!va.prerelease && !vb.prerelease) {
        return 0;
    }
    if (!va.prerelease) {
        return 1;
    }
    if (!vb.prerelease) {
        return -1;
    }

    let preLen = Math.max(va.prerelease.length, vb.prerelease.length);
    for (let i = 0; i < preLen; i++) {
        let pa = va.prerelease[i];
        let pb = vb.prerelease[i];
        if (pa === undefined) {
            return -1;
        }
        if (pb === undefined) {
            return 1;
        }
        if (pa === pb) {
            continue;
        }

        let numericA = /^\d+$/.test(pa);
        let numericB = /^\d+$/.test(pb);
        if (numericA && numericB) {
            return parseInt(pa, 10) > parseInt(pb, 10) ? 1 : -1;
        }
        if (numericA !== numericB) {
            // Numeric identifiers always have lower precedence than alphanumeric ones
            return numericA ? -1 : 1;
        }
        return pa > pb ? 1 : -1;
    }

    return 0;
}

/**
 * Cast a string to an int, returning 0 if it fails
 * @param {String} inp The number as a string to convert to an int
 */
export function parseIntZero(inp) {
    let int = parseInt(inp, 10);
    return Number.isNaN(int) ?
        0 :
        int;
}

/**
 * Prepare plugin provided object, for use as a plugin component
 * @param {Number} pluginId The number to identify this plugin object
 * @param {Component} componentOrElement The vue.js component object or html element
 * @param {Object} args Optional arguments for this plugin { title: '', props: {} }
 */
export function makePluginObject(pluginId, componentOrElement, args = {}) {
    const plugin = {
        id: pluginId,
        component: null,
        title: () => '',
        props: {},
        tabName: '',
    };

    // copy props from args
    plugin.props = Object.assign(plugin.props, args.props);
    plugin.tabName = args.tabName || args.title || 'plugin_tab_' + pluginId;

    if (componentOrElement instanceof Element) {
        // componentOrElement is an html element, so wrap it in a functional component

        // eslint-disable-next-line no-underscore-dangle
        if (componentOrElement.__vue__ && !window.kiwi_deprecations_vueEl) {
            window.kiwi_deprecations_vueEl = true;
            // eslint-disable-next-line no-console
            console.warn('deprecated component.$el added to plugin api, please switch to just passing the vue.js component object');
        }
        plugin.component = PluginWrapper;
        plugin.props = Object.assign(plugin.props, {
            pluginElement: componentOrElement,
        });
    } else if (componentOrElement instanceof Object) {
        // componentOrElement is an object, attempt to make a vue component from it
        plugin.component = Vue.extend(componentOrElement);
    } else {
        plugin.component = componentOrElement;
    }

    if (typeof args.title === 'string') {
        // if args.title exists wrap it in a function, that can also be a translation string
        plugin.title = () => (args.title.slice(0, 2) === 't_' ? TextFormatting.t(args.title.slice(2)) : args.title);
    }

    return plugin;
}

/**
 * Check for trailing close bracket and return true if no matching open bracket is found
 * @param {String} str The string to check for trailing brackets
 * @returns {Boolean}  Boolean true when trailing bracket and no matching open bracket
 */
export function hasUnmatchedTrailingBracket(str) {
    const brackets = [
        { o: '(', c: ')' },
        { o: '[', c: ']' },
        { o: '{', c: '}' },
    ];

    const type = brackets.find((t) => t.c === str[str.length - 1]);
    if (!type) {
        return false;
    }

    let unmatched = 0;
    for (let i = str.length - 1; i >= 0; i--) {
        if (str[i] === type.c) {
            unmatched++;
        } else if (str[i] === type.o) {
            unmatched--;
        }
    }

    return (unmatched === 1);
}

// This provides a better sort for numbered nicks but does not work on ios9
let intlCollator;
if (global.Intl) {
    intlCollator = new Intl.Collator({}, { numeric: true });
}

export function strCompare(a, b) {
    if (intlCollator) {
        return intlCollator.compare(a, b);
    }

    if (a === b) {
        return 0;
    }

    return a > b ?
        1 :
        -1;
}

export function isSameOriginUrl(url, base) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    let baseHref = base;
    if (!baseHref && typeof window !== 'undefined' && window.location) {
        baseHref = window.location.href;
    }
    if (!baseHref) {
        return false;
    }

    try {
        let parsed = new URL(url, baseHref);
        return parsed.origin === new URL(baseHref).origin;
    } catch (err) {
        return false;
    }
}

export function isSafeSameOriginOpen(url) {
    let info = getMediaInfo(url);
    if (info.type !== 'image' && info.type !== 'audio' && info.type !== 'video') {
        return false;
    }

    try {
        let path = new URL(url, 'https://example.invalid/').pathname;
        return !path.toLowerCase().endsWith('.svg');
    } catch (err) {
        return false;
    }
}

export function downloadUrl(url) {
    let absolute;
    try {
        absolute = new URL(url, window.location.href).href;
    } catch (err) {
        return Promise.resolve();
    }

    return fetch(absolute, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) {
            throw new Error('download failed');
        }
        return response.blob();
    }).then((blob) => {
        let objectUrl = URL.createObjectURL(blob);
        let anchor = document.createElement('a');
        let name = new URL(absolute).pathname.split('/').filter(Boolean).pop() || 'download';
        anchor.href = objectUrl;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    }).catch(() => undefined);
}
