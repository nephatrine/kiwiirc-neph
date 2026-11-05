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
        nativeHttp: false,
        mediaProxy: false,
        profiles: false,
        chatLogs: false,
        dcc: false,
    },
});
