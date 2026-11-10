const fs = require('node:fs');
const path = require('node:path');
const JSON5 = require('json5');

const CONFIG_FILENAME = 'config.json5';

const DEFAULT_CONFIG = {
    windowTitle: 'Kiwi IRC',
    startupScreen: 'personal',
    allowRegisterProtocolHandler: true,
    kiwiServer: '',
    restricted: false,
    theme: 'Kiwi Dark',
    startupOptions: {
        server: '',
        port: 6697,
        tls: true,
        direct: false,
        channel: '',
        nick: 'kiwi_?',
        remember_buffers: true,
    },
    buffers: {
        hide_preview_cards: true,
        show_topic_in_header: true,
        scrollback_size: 500,
    },
    fileupload: {
        service: 'none',
        litterbox: {
            retention: '72h',
        },
    },
    radio: {
        url: '',
    },
    presetNetworks: [],
    desktopHttp: {
        allowPrivateNetworks: false,
        requestTimeoutMs: 15000,
        maxResponseBytes: 10485760,
        maxDownloadBytes: 104857600,
        maxMediaBytes: 104857600,
        maxRequestBytes: 104857600,
        maxUploadBytes: 268435456,
        maxRedirects: 5,
    },
};

const USER_CONFIG_TEMPLATE = `{
    // Optional desktop configuration overrides.
    //
    // See desktop/README.md for the available settings.
    //
    // "kiwiServer": "https://irc.example.com/webirc/kiwiirc/",
    // "startupOptions": {
    //     "nick": "kiwi_?"
    // },
    //
    // "desktopHttp": {
    //     "allowPrivateNetworks": false
    // }
}
`;

function isPlainObject(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

function cloneValue(value) {
    if (Array.isArray(value)) {
        return value.map(cloneValue);
    }
    if (isPlainObject(value)) {
        return mergeConfig(value, {});
    }
    return value;
}

function mergeConfig(base, override) {
    const merged = {};

    Object.keys(base).forEach((key) => {
        merged[key] = cloneValue(base[key]);
    });

    Object.keys(override).forEach((key) => {
        if (isPlainObject(merged[key]) && isPlainObject(override[key])) {
            merged[key] = mergeConfig(merged[key], override[key]);
        } else {
            merged[key] = cloneValue(override[key]);
        }
    });

    return merged;
}

function parseConfigText(text) {
    const config = JSON5.parse(text);
    if (!isPlainObject(config)) {
        throw new Error('Desktop configuration must be a JSON object');
    }
    return config;
}

function configPathFor(userDataDir) {
    return path.join(userDataDir, CONFIG_FILENAME);
}

function ensureUserConfig(userDataDir) {
    const configPath = configPathFor(userDataDir);
    fs.mkdirSync(userDataDir, { recursive: true });
    if (!fs.existsSync(configPath)) {
        try {
            fs.writeFileSync(configPath, USER_CONFIG_TEMPLATE, {
                flag: 'wx',
                mode: 0o600,
            });
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    }
    return configPath;
}

function loadDesktopConfig(userDataDir) {
    const configPath = configPathFor(userDataDir);
    let userConfig = {};

    if (fs.existsSync(configPath)) {
        try {
            userConfig = parseConfigText(fs.readFileSync(configPath, 'utf8'));
        } catch (err) {
            return {
                config: mergeConfig(DEFAULT_CONFIG, {}),
                configPath,
                error: err,
            };
        }
    }

    return {
        config: mergeConfig(DEFAULT_CONFIG, userConfig),
        configPath,
        error: null,
    };
}

module.exports = {
    CONFIG_FILENAME,
    DEFAULT_CONFIG,
    USER_CONFIG_TEMPLATE,
    configPathFor,
    ensureUserConfig,
    loadDesktopConfig,
    mergeConfig,
    parseConfigText,
};
