'kiwi public';

/** @module */
import i18next from 'i18next';

import getState from '@/libs/state';
import ThemeManager from '@/libs/ThemeManager';
import { v4Source as ipv4Source, v6Source as ipv6Source } from '@/helpers/IpRegex';
import { hash32 } from '@/helpers/MurmurHash3';
import { escapeHtml } from '@/helpers/Utils';

export const urlRegex = new RegExp(
    // Detect either a protocol or 'www.' to start a URL
    /(([A-Za-z][A-Za-z0-9-]*:\/\/)|(www\.))/.source +
        '(' +
        // Hostname and tld
        /([\w\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF.-]+\.[a-zA-Z]{2,63})/.source +
        '|' +
        'localhost' +
        '|' +
        // IPv4 address
        ipv4Source +
        '|' +
        // IPv6 address
        '(\\[?' +
        ipv6Source +
        '\\]?)' +
        ')' +
        // Optional port..
        /(:[0-9]+)?/.source +
        // Optional path..
        /(\/[\w\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF!:.?$'()[\]*,;~+=&%@!\-/]*)?/.source +
        // Optional fragment
        /(#.*)?/.source,
    'i'
);

export const channelRegex = /(^|\s)([@+~&%}]*)([#&][^ ,\007<>\n\r]+?)([:;.,<>\n\r]+)?$/i;

export function linkifyChannels(word) {
    // "@#kiwiirc," = 3 parts. (prefix=@)(channel=#kiwiirc)(suffix=,)
    return word.replace(channelRegex, (match, mLead, mPrefix, mChannel, mSuffix) => {
        let chan = escapeHtml(mChannel.trim());
        let lead = escapeHtml(mLead);
        let prefix = escapeHtml(mPrefix);
        let suffix = escapeHtml(mSuffix);

        let link = `<a class="u-link kiwi-channel" data-channel-name="${chan}">${chan}</a>`;
        return `${lead}${prefix}${link}${suffix}`;
    });
}

/**
 * Convert a nickname string to a colour code
 * Uses these properties from the CSS theme file:
 * --kiwi-nickcolour-count: 200;  - number of available nick colours
 * --kiwi-nickcolour-hueoffset: 0;  - moves the hue value by hueoffset amounts
 * --kiwi-nickcolour-saturation: 70;  - the nick saturation in HSL value
 * --kiwi-nickcolour-lightness: 40;  - the nick lightness in HSL value
 */
export function createNickColour(nick) {
    let themeMngr = ThemeManager.instance();
    let nickLower = (nick || '').toLowerCase();
    let nickNum = hash32(nickLower);

    let bucketSize = toInt(themeMngr.themeVar('nickcolour-count')) || 200;
    let hueOffset = toInt(themeMngr.themeVar('nickcolour-hueoffset'));
    let hsl = {
        h: mapRange(Math.abs(nickNum) % bucketSize, 0, bucketSize, 0, 360) + hueOffset,
        s: toInt(themeMngr.themeVar('nickcolour-saturation')) || 70,
        l: toInt(themeMngr.themeVar('nickcolour-lightness')) || 40,
    };
    return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Ensure a color has enough contrast against a background color.
 * If not, the lightness is adjusted until the target ratio is met.
 * @param {string} foreground Hex color string
 * @param {string} background Hex color string
 * @param {number} targetRatio Target contrast ratio (default 4.5)
 * @returns {string} The adjusted hex color
 */
export function ensureContrast(foreground, background, targetRatio = 4.5) {
    const fgRgb = hexToRgb(foreground);
    const bgRgb = hexToRgb(background);
    if (!fgRgb || !bgRgb) {
        return foreground;
    }

    const getRatio = (fg, bg) => {
        const l1 = getRelativeLuminance(fg);
        const l2 = getRelativeLuminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    let ratio = getRatio(fgRgb, bgRgb);
    if (ratio >= targetRatio) {
        return foreground;
    }

    const fgHsl = rgbToHsl(fgRgb.r, fgRgb.g, fgRgb.b);
    const bgL = getRelativeLuminance(bgRgb);

    // If background is dark, we lighten. If background is light, we darken.
    const step = bgL < 0.5
        ? 0.02
        : -0.02;
    let adjustedHsl = { ...fgHsl };

    while (ratio < targetRatio) {
        adjustedHsl.l += step;
        if (adjustedHsl.l > 1 || adjustedHsl.l < 0) {
            break;
        }
        const newRgb = hslToRgb(adjustedHsl.h, adjustedHsl.s, adjustedHsl.l);
        ratio = getRatio(newRgb, bgRgb);
    }

    return rgbToHex(hslToRgb(adjustedHsl.h, adjustedHsl.s, adjustedHsl.l));
}

function getRelativeLuminance(rgb) {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
        const s = v / 255;
        return s <= 0.03928
            ? s / 12.92
            : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return null;
    }
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

function rgbToHex(rgb) {
    const toHex = (c) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl(r, g, b) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    let h;
    let s;
    const l = (max + min) / 2;

    if (max === min) {
        h = 0;
        s = 0;
    } else {
        const d = max - min;
        s = l > 0.5
            ? d / (2 - max - min)
            : d / (max + min);
        switch (max) {
        case red: h = (green - blue) / d + (green < blue ? 6 : 0); break;
        case green: h = (blue - red) / d + 2; break;
        case blue: h = (red - green) / d + 4; break;
        default: break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    let r;
    let g;
    let b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, hue) => {
            let val = hue;
            if (val < 0) val += 1;
            if (val > 1) val -= 1;
            if (val < 1 / 6) return p + (q - p) * 6 * val;
            if (val < 1 / 2) return q;
            if (val < 2 / 3) return p + (q - p) * (2 / 3 - val) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * Parse a string to an int, where NaN is 0
 * @param {string} inp
 */
export function toInt(inp) {
    let int = parseInt(inp, 10);
    if (Number.isNaN(int)) {
        int = 0;
    }

    return int;
}

/**
 * Extract a substring from a hex string and parse it as an integer
 * @param {string} hash - Source hex string
 * @param {number} index - Start index of substring
 * @param {number} [length] - Length of substring. Defaults to 1.
 */
export function hexVal(hash, index, len) {
    return parseInt(hash.substr(index, len || 1), 16);
}

/*
 * Re-maps a number from one range to another
 * http://processing.org/reference/map_.html
 */
export function mapRange(value, vMin, vMax, dMin, dMax) {
    let vValue = parseFloat(value);
    let vRange = vMax - vMin;
    let dRange = dMax - dMin;

    return (vValue - vMin) * dRange / vRange + dMin;
}

/**
 * Format a string according to the configured textFormats, including a
 * translation for the %text formatting variable
 */
export function formatAndT(formatId, formatParams, localeId, localeParams) {
    let body = t(localeId, localeParams);
    if (formatParams) {
        formatParams.text = body;
        body = formatText(formatId, formatParams);
    } else {
        body = formatText(formatId, { text: body });
    }

    return body;
}

/**
 * Create a user reference string similar to 'nick'
 */
export function formatUser(fNick) {
    let nick = fNick;

    // Allow passing of a user object or irc-framework event
    if (typeof nick === 'object') {
        nick = nick.nick;
    }

    return formatText('user', { nick });
}

/**
 * Create a full user reference similar to 'nick (user@host)'
 */
export function formatUserFull(fNick, fUsername, fHost) {
    let nick = '';
    let username = '';
    let host = '';

    // Allow passing of a user object or irc-framework event
    if (typeof fNick === 'object') {
        let user = fNick;
        nick = user.nick;
        username = user.username || user.ident;
        host = user.hostname || user.host;
    } else {
        nick = fNick;
        username = fUsername;
        host = fHost;
    }

    return formatText('user_full', { nick, username, host });
}

/**
 * Format a string according to the configured textFormats
 */
export function formatText(formatId, formatParams) {
    let format = getState().setting('textFormats.' + formatId);
    let params = formatParams;

    // Most texts only have a 'text' variable so allow passing of a string for this
    // variable as shorthand.
    if (typeof params === 'string') {
        params = { text: params };
    }

    // Expand a user mask into its individual parts (nick, ident, hostname)
    if (params.user) {
        params.nick = params.user.nick || '';
        params.username = params.user.username || '';
        params.host = params.user.hostname || '';
        params.prefix = params.user.prefix || '';
    }

    // Do the magic. Use the %shorthand syntax to produce output.
    let result = format.replace(/%([A-Z]{2,})/ig, (match, key) => {
        let ret = '';
        if (typeof params[key] !== 'undefined') {
            ret = params[key];
        }

        return ret;
    });

    return result;
}

// Convert a given duration in seconds to human readable weeks,days,hours,minutes,seconds
// only showing the duration parts that are used eg 3666 --> 1 hour, 1 minute, 6 seconds
export function formatDuration(timeSeconds) {
    let seconds = timeSeconds;

    const weeks = Math.floor(seconds / (3600 * 24 * 7));
    seconds -= weeks * 3600 * 24 * 7;

    const days = Math.floor(seconds / (3600 * 24));
    seconds -= days * 3600 * 24;

    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;

    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    const tmp = [];
    (weeks) && tmp.push(t(weeks === 1 ? 'week' : 'week_plural', { count: weeks }));
    (weeks || days) && tmp.push(t(days === 1 ? 'day' : 'day_plural', { count: days }));
    (days || hours) && tmp.push(t(hours === 1 ? 'hour' : 'hour_plural', { count: hours }));
    (days || hours || minutes) && tmp.push(t(minutes === 1 ? 'minute' : 'minute_plural', { count: minutes }));
    tmp.push(t(seconds === 1 ? 'second' : 'second_plural', { count: seconds }));

    return tmp.join(' ');
}

export function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

export function t(key, options) {
    let val = i18next.t(key, options);
    if (!val) {
        let opts = options || {};
        opts.lng = 'en-us';
        val = i18next.t(key, opts);
    }
    return val;
}
