const { contextBridge, ipcRenderer } = require('electron');

const EMBED_ERROR_CHANNEL = 'kiwi:embed-error';
const NOTIFICATION_CLICK_CHANNEL = 'kiwi:notification-click';
const NOTIFICATION_CLOSED_CHANNEL = 'kiwi:notification-closed';
const TRAY_SETTINGS_CHANGED_CHANNEL = 'kiwi:tray-settings-changed';
const embedErrorHandlers = new Set();
let embedErrorListening = false;
let cachedConfig = null;
const notificationSupported = ipcRenderer.sendSync(
    'kiwi:notification-supported'
) === true;
const traySupported = ipcRenderer.sendSync('kiwi:tray-supported') === true;

function notificationEventHandler(channel) {
    const handlers = new Set();
    let listening = false;

    function listen() {
        if (listening) {
            return;
        }
        listening = true;
        ipcRenderer.on(channel, (event, id, reason) => {
            handlers.forEach((handler) => {
                try {
                    handler(id, reason);
                } catch (err) {
                    // One notification handler must not block the others.
                }
            });
        });
    }

    return function on(handler) {
        if (typeof handler !== 'function') {
            return () => {};
        }
        listen();
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
        };
    };
}

const onNotificationClick = notificationEventHandler(NOTIFICATION_CLICK_CHANNEL);
const onNotificationClosed = notificationEventHandler(NOTIFICATION_CLOSED_CHANNEL);

function traySettingsEventHandler() {
    const handlers = new Set();
    let listening = false;

    function listen() {
        if (listening) {
            return;
        }
        listening = true;
        ipcRenderer.on(TRAY_SETTINGS_CHANGED_CHANNEL, (event, settings) => {
            handlers.forEach((handler) => {
                try {
                    handler(settings);
                } catch (err) {
                    // One tray handler must not block the others.
                }
            });
        });
    }

    return function on(handler) {
        if (typeof handler !== 'function') {
            return () => {};
        }
        listen();
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
        };
    };
}

const onTraySettingsChanged = traySettingsEventHandler();

function listenForEmbedErrors() {
    if (embedErrorListening) {
        return;
    }
    embedErrorListening = true;
    ipcRenderer.on(EMBED_ERROR_CHANNEL, (event, url, error) => {
        embedErrorHandlers.forEach((handler) => {
            try {
                handler({ url, error });
            } catch (err) {
                // One embed handler must not block the others.
            }
        });
    });
}

function onEmbedError(handler) {
    if (typeof handler !== 'function') {
        return () => {};
    }
    listenForEmbedErrors();
    embedErrorHandlers.add(handler);
    return () => {
        embedErrorHandlers.delete(handler);
    };
}

function desktopConfig() {
    if (cachedConfig === null) {
        cachedConfig = ipcRenderer.sendSync('kiwi:desktop-config');
    }
    return cachedConfig;
}

contextBridge.exposeInMainWorld('kiwiConfig', desktopConfig);

contextBridge.exposeInMainWorld('kiwiDesktop', {
    isDesktop: true,
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
    capabilities: {
        nativeHttp: true,
        nativeDownloads: true,
        mediaProxy: true,
        profiles: true,
        passwordStorage: true,
        profileTransfer: true,
        chatLogs: true,
        themes: true,
        emojiPacks: true,
        networkIcons: true,
        nativeNotifications: notificationSupported,
        tray: traySupported,
        dcc: false,
    },
    http: {
        request: (options) => ipcRenderer.invoke('kiwi:http-request', options),
        upload: (options) => ipcRenderer.invoke('kiwi:http-upload', options),
    },
    files: {
        saveUrl: (url) => ipcRenderer.invoke('kiwi:save-url', url),
    },
    storage: {
        get: (name) => ipcRenderer.invoke('kiwi:storage-get', name),
        set: (name, value) => ipcRenderer.invoke('kiwi:storage-set', name, value),
    },
    secrets: {
        status: () => ipcRenderer.invoke('kiwi:secrets-status'),
        load: (stateKey) => ipcRenderer.invoke('kiwi:secrets-load', stateKey),
        save: (stateKey, values) => ipcRenderer.invoke('kiwi:secrets-save', stateKey, values),
        clear: (stateKey) => ipcRenderer.invoke('kiwi:secrets-clear', stateKey),
    },
    profile: {
        export: (text, filename) => ipcRenderer.invoke('kiwi:profile-export', text, filename),
        import: () => ipcRenderer.invoke('kiwi:profile-import'),
        backup: () => ipcRenderer.invoke('kiwi:profile-backup'),
        openFolder: () => ipcRenderer.invoke('kiwi:profile-open-folder'),
    },
    themes: {
        list: () => ipcRenderer.invoke('kiwi:themes-list'),
        install: () => ipcRenderer.invoke('kiwi:themes-install'),
        uninstall: (id) => ipcRenderer.invoke('kiwi:themes-uninstall', id),
    },
    emojiPacks: {
        list: () => ipcRenderer.invoke('kiwi:emoji-packs-list'),
        install: () => ipcRenderer.invoke('kiwi:emoji-packs-install'),
        uninstall: (id) => ipcRenderer.invoke('kiwi:emoji-packs-uninstall', id),
    },
    networkIcons: {
        choose: (networkName) => ipcRenderer.invoke(
            'kiwi:network-icons-choose',
            networkName
        ),
    },
    logs: {
        append: (entries) => ipcRenderer.invoke('kiwi:logs-append', entries),
        search: (options) => ipcRenderer.invoke('kiwi:logs-search', options),
        context: (options) => ipcRenderer.invoke('kiwi:logs-context', options),
        redact: (options) => ipcRenderer.invoke('kiwi:logs-redact', options),
        confirm: (options) => ipcRenderer.invoke('kiwi:logs-confirm', options),
        prune: (retentionDays) => ipcRenderer.invoke('kiwi:logs-prune', retentionDays),
        clear: () => ipcRenderer.invoke('kiwi:logs-clear'),
        stats: () => ipcRenderer.invoke('kiwi:logs-stats'),
        status: () => ipcRenderer.invoke('kiwi:logs-status'),
        onOpenSearch: (handler) => {
            const listener = () => handler();
            ipcRenderer.on('kiwi:logs-open-search', listener);
            return () => ipcRenderer.removeListener('kiwi:logs-open-search', listener);
        },
    },
    media: {
        proxyUrl: (url) => `kiwi-media://media/${encodeURIComponent(url)}`,
    },
    notifications: {
        isAvailable: () => notificationSupported,
        show: (payload) => ipcRenderer.invoke('kiwi:notification-show', payload),
        close: (id) => ipcRenderer.invoke('kiwi:notification-close', id),
        onClick: onNotificationClick,
        onClose: onNotificationClosed,
    },
    tray: {
        isAvailable: () => traySupported,
        getSettings: () => ipcRenderer.invoke('kiwi:tray-settings'),
        setSettings: (settings) => ipcRenderer.invoke('kiwi:tray-settings-set', settings),
        setBadge: (summary) => ipcRenderer.send('kiwi:tray-badge', summary),
        onSettingsChanged: onTraySettingsChanged,
    },
    presets: {
        onApply: (handler) => {
            if (typeof handler !== 'function') {
                return () => {};
            }
            const listener = (event, id) => handler(id);
            ipcRenderer.on('kiwi:apply-preset', listener);
            return () => ipcRenderer.removeListener('kiwi:apply-preset', listener);
        },
        setAvailable: (presets) => {
            ipcRenderer.send('kiwi:presets-available', presets);
        },
    },
    embedErrors: {
        on: (handler) => onEmbedError(handler),
    },
});
