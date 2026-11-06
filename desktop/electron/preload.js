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
        chatLogs: false,
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
    media: {
        proxyUrl: (url) => `kiwi-media://media/${encodeURIComponent(url)}`,
    },
});
