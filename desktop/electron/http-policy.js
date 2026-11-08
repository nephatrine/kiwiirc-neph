const dns = require('node:dns/promises');
const net = require('node:net');

const PRIVATE_ERROR = 'private network access is disabled';

function normalizeHostname(hostname) {
    return String(hostname || '').replace(/^\[|\]$/g, '');
}

function isPrivateIPv4(address) {
    const parts = address.split('.').map((part) => parseInt(part, 10));
    if (parts.length !== 4 ||
        parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
        return true;
    }

    const [a, b, c] = parts;

    if (a === 0 || a === 10 || a === 127) {
        return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
        return true;
    }
    if (a === 169 && b === 254) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 192 && b === 0 && (c === 0 || c === 2)) {
        return true;
    }
    if (a === 198 && (b === 18 || b === 19)) {
        return true;
    }
    if (a === 198 && b === 51 && c === 100) {
        return true;
    }
    if (a === 203 && b === 0 && c === 113) {
        return true;
    }
    if (a >= 224) {
        return true;
    }

    return false;
}

function isPrivateIPv6(address) {
    let value = address.toLowerCase();

    if (value === '::' || value === '::1') {
        return true;
    }

    if (value.startsWith('::')) {
        const mapped = value.slice(2);
        if (net.isIPv4(mapped)) {
            return isPrivateIPv4(mapped);
        }
    }

    if (value.startsWith('::ffff:')) {
        const mapped = value.slice(7);
        if (net.isIPv4(mapped)) {
            return isPrivateIPv4(mapped);
        }
        const parts = mapped.split(':');
        if (parts.length === 2) {
            const high = parseInt(parts[0], 16);
            const low = parseInt(parts[1], 16);
            if (Number.isInteger(high) && Number.isInteger(low)) {
                return isPrivateIPv4([
                    Math.floor(high / 256),
                    high % 256,
                    Math.floor(low / 256),
                    low % 256,
                ].join('.'));
            }
        }
    }

    const firstGroup = parseInt(value.split(':')[0], 16);
    if (Number.isInteger(firstGroup)) {
        if (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) {
            return true;
        }
        if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) {
            return true;
        }
        if (firstGroup >= 0xff00 && firstGroup <= 0xffff) {
            return true;
        }
    }

    return value.startsWith('2001:db8:');
}

function isPrivateAddress(address) {
    const normalized = normalizeHostname(address);
    const family = net.isIP(normalized);
    if (family === 4) {
        return isPrivateIPv4(normalized);
    }
    if (family === 6) {
        return isPrivateIPv6(normalized);
    }
    return false;
}

function validateHttpUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl) {
        throw new Error('invalid URL');
    }

    let url;
    try {
        url = new URL(rawUrl);
    } catch (err) {
        throw new Error('invalid URL');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('only HTTP and HTTPS URLs are allowed');
    }
    if (!url.hostname) {
        throw new Error('invalid URL host');
    }
    if (url.username || url.password) {
        throw new Error('URL credentials are not allowed');
    }

    return url;
}

async function resolveTarget(rawUrl, allowPrivateNetworks, lookup = dns.lookup) {
    const url = validateHttpUrl(rawUrl);
    const hostname = normalizeHostname(url.hostname);
    const literalFamily = net.isIP(hostname);
    let addresses;

    if (literalFamily) {
        addresses = [{ address: hostname, family: literalFamily }];
    } else {
        addresses = await lookup(hostname, { all: true, verbatim: true });
        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }
    }

    if (!addresses.length) {
        throw new Error('host did not resolve');
    }

    if (!allowPrivateNetworks && addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw new Error(PRIVATE_ERROR);
    }

    return {
        url,
        hostname,
        address: addresses[0].address,
        family: addresses[0].family,
        addresses,
    };
}

function pinnedLookup(addressOrAddresses, family) {
    const addresses = (Array.isArray(addressOrAddresses) ?
        addressOrAddresses :
        [{ address: addressOrAddresses, family }])
        .filter((entry) => entry && entry.address)
        .map((entry) => ({
            address: entry.address,
            family: entry.family,
        }));

    return (hostname, options, callback) => {
        let done = callback;
        let lookupOptions = options;
        if (typeof options === 'function') {
            done = options;
            lookupOptions = {};
        }

        if (!addresses.length) {
            done(new Error('host did not resolve'));
            return;
        }

        if (lookupOptions && lookupOptions.all) {
            done(null, addresses);
            return;
        }

        const entry = addresses[0];
        done(null, entry && entry.address, entry && entry.family);
    };
}

module.exports = {
    PRIVATE_ERROR,
    isPrivateAddress,
    isPrivateIPv4,
    isPrivateIPv6,
    normalizeHostname,
    pinnedLookup,
    resolveTarget,
    validateHttpUrl,
};
