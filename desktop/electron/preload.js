const { contextBridge, ipcRenderer } = require('electron');

let cachedConfig = null;

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
    embedErrors: {
        on: (handler) => {
            const listener = (event, url, error) => handler({ url, error });
            ipcRenderer.on('kiwi:embed-error', listener);
            return () => ipcRenderer.removeListener('kiwi:embed-error', listener);
        },
    },
});
