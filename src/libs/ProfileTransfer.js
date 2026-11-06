export const PROFILE_FORMAT = 'kiwi-profile';
export const PROFILE_VERSION = 1;
export const MAX_PROFILE_BYTES = 64 * 1024 * 1024;
const MAX_SECRET_BYTES = 64 * 1024;

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function byteLength(value) {
    return new Blob([value]).size;
}

function sanitizeState(rawState) {
    if (!isObject(rawState) || !Array.isArray(rawState.networks)) {
        throw new Error('invalid profile state');
    }

    const state = clone(rawState);
    state.networks.forEach((network) => {
        if (!isObject(network)) {
            throw new Error('invalid profile network');
        }
        if (!isObject(network.connection)) {
            network.connection = {};
        }
        network.connection.password = '';
        network.password = '';
        if (!Array.isArray(network.buffers)) {
            network.buffers = [];
        }
    });

    if (typeof state.user_settings !== 'undefined' && !isObject(state.user_settings)) {
        throw new Error('invalid profile settings');
    }

    return state;
}

function networkAllowsPassword(network) {
    return !network ||
        typeof network.setting !== 'function' ||
        network.setting('rememberPassword') !== false;
}

export function sanitizeProfileSecrets(value, state = null) {
    const result = {};
    if (!isObject(value)) {
        return result;
    }

    const allowedIds = state && Array.isArray(state.networks) ?
        new Set(state.networks.map((network) => String(network.id))) :
        null;

    Object.keys(value).forEach((networkId) => {
        if (!/^\d{1,12}$/.test(networkId)) {
            return;
        }
        if (allowedIds && !allowedIds.has(networkId)) {
            return;
        }

        const source = value[networkId];
        if (!isObject(source)) {
            return;
        }

        const entry = {};
        ['connection', 'sasl'].forEach((field) => {
            const secret = source[field];
            if (typeof secret === 'string' &&
                secret &&
                byteLength(secret) <= MAX_SECRET_BYTES
            ) {
                entry[field] = secret;
            }
        });

        if (Object.keys(entry).length) {
            result[networkId] = entry;
        }
    });

    return result;
}

export function collectProfileSecrets(state) {
    const secrets = {};

    state.networks.forEach((network) => {
        if (!networkAllowsPassword(network)) {
            return;
        }

        const entry = {};
        if (network.connection && network.connection.password) {
            entry.connection = network.connection.password;
        }
        if (network.password) {
            entry.sasl = network.password;
        }
        if (Object.keys(entry).length) {
            secrets[String(network.id)] = entry;
        }
    });

    return secrets;
}

export function buildProfileBundle(state, options = {}) {
    const stateData = sanitizeState(JSON.parse(state.exportState(true, false)));
    const bundle = {
        format: PROFILE_FORMAT,
        version: PROFILE_VERSION,
        source: options.source === 'desktop' ? 'desktop' : 'web',
        exportedAt: new Date().toISOString(),
        state: stateData,
    };

    if (options.includePasswords) {
        const secrets = sanitizeProfileSecrets(
            options.secrets || collectProfileSecrets(state),
            stateData
        );
        if (Object.keys(secrets).length) {
            bundle.secrets = secrets;
        }
    }

    return bundle;
}

export function validateProfileBundle(value) {
    if (!isObject(value) || value.format !== PROFILE_FORMAT) {
        throw new Error('invalid profile format');
    }
    if (value.version !== PROFILE_VERSION) {
        throw new Error('unsupported profile version');
    }

    const state = sanitizeState(value.state);
    const result = {
        format: PROFILE_FORMAT,
        version: PROFILE_VERSION,
        source: value.source === 'desktop' ? 'desktop' : 'web',
        exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
        state,
    };

    if (typeof value.secrets !== 'undefined') {
        const secrets = sanitizeProfileSecrets(value.secrets, state);
        if (Object.keys(secrets).length) {
            result.secrets = secrets;
        }
    }

    return result;
}

export function parseProfileBundleText(text) {
    if (typeof text !== 'string') {
        throw new Error('invalid profile file');
    }
    if (text.length > MAX_PROFILE_BYTES) {
        throw new Error('profile file is too large');
    }

    let value;
    try {
        value = JSON.parse(text);
    } catch (err) {
        throw new Error('invalid profile JSON');
    }

    return validateProfileBundle(value);
}

export function applyProfileBundle(state, bundle) {
    const profile = validateProfileBundle(bundle);
    state.importState(JSON.stringify(profile.state));

    let appliedSecrets = 0;
    Object.keys(profile.secrets || {}).forEach((networkId) => {
        const network = state.getNetwork(Number(networkId));
        if (!network || !networkAllowsPassword(network)) {
            return;
        }

        const entry = profile.secrets[networkId] || {};
        if (typeof entry.connection === 'string') {
            network.connection.password = entry.connection;
        }
        if (typeof entry.sasl === 'string') {
            network.password = entry.sasl;
        }
        appliedSecrets += 1;
    });

    return { appliedSecrets };
}

export function profileBundleFilename() {
    return `kiwi-profile-${new Date().toISOString().slice(0, 10)}.json`;
}

export function downloadProfileBundle(bundle) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = profileBundleFilename();
    link.click();
    URL.revokeObjectURL(url);
}
