'kiwi public';

/** @module */

/**
 * MurmurHash3 x86 32-bit hash.
 *
 * Vendored from the murmurhash3js package v3.0.1
 * (https://github.com/pid/murmurHash3js, MIT licence) so it is no longer a
 * runtime dependency. Only the x86 32-bit variant is used by the app. The
 * arithmetic is kept identical to the original so existing nick colours do not
 * change.
 */

/* eslint-disable no-bitwise */

function x86Multiply(m, n) {
    return ((m & 0xffff) * n) + ((((m >>> 16) * n) & 0xffff) << 16);
}

function x86Rotl(m, n) {
    return (m << n) | (m >>> (32 - n));
}

function x86Fmix(h) {
    let x = h;

    x ^= x >>> 16;
    x = x86Multiply(x, 0x85ebca6b);
    x ^= x >>> 13;
    x = x86Multiply(x, 0xc2b2ae35);
    x ^= x >>> 16;

    return x;
}

/**
 * Generate a 32-bit MurmurHash3 (x86) hash of a string.
 * @param {String} key The string to hash
 * @param {Number} [seed] An optional seed, defaults to 0
 * @returns {Number} The hash as an unsigned 32-bit integer
 */
export function hash32(key, seed) {
    let str = key || '';
    let initial = seed || 0;

    let remainder = str.length % 4;
    let bytes = str.length - remainder;

    let h1 = initial;
    let k1 = 0;

    let c1 = 0xcc9e2d51;
    let c2 = 0x1b873593;

    let i;
    for (i = 0; i < bytes; i += 4) {
        k1 = ((str.charCodeAt(i) & 0xff)) |
            ((str.charCodeAt(i + 1) & 0xff) << 8) |
            ((str.charCodeAt(i + 2) & 0xff) << 16) |
            ((str.charCodeAt(i + 3) & 0xff) << 24);

        k1 = x86Multiply(k1, c1);
        k1 = x86Rotl(k1, 15);
        k1 = x86Multiply(k1, c2);

        h1 ^= k1;
        h1 = x86Rotl(h1, 13);
        h1 = x86Multiply(h1, 5) + 0xe6546b64;
    }

    k1 = 0;

    switch (remainder) {
    case 3:
        k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16;
        // falls through
    case 2:
        k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;
        // falls through
    case 1:
        k1 ^= (str.charCodeAt(i) & 0xff);
        k1 = x86Multiply(k1, c1);
        k1 = x86Rotl(k1, 15);
        k1 = x86Multiply(k1, c2);
        h1 ^= k1;
        break;
    default:
        break;
    }

    h1 ^= str.length;
    h1 = x86Fmix(h1);

    return h1 >>> 0;
}
