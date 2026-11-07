const {
    app,
    BrowserWindow,
    Menu,
    dialog,
    ipcMain,
    protocol,
    net,
    safeStorage,
    screen,
    shell,
} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ensureUserConfig, loadDesktopConfig } = require('./desktop-config');
const httpService = require('./http');
const { handleMediaRequest } = require('./media');
const { MEDIA_SCHEME } = require('./media-url');
const { createProfileStore, MAX_STORAGE_BYTES } = require('./profile-store');
const { createSecretStore } = require('./secrets');
const { createChatLogStore } = require('./chat-log-store');
const {
    loadWindowState,
    restoreWindowState,
    saveWindowState,
    saveWindowStateSync,
} = require('./window-state');

const APP_SCHEME = 'app';
const APP_HOST = 'kiwi';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DEV_ORIGIN = 'http://localhost:8080';
const isDev = process.argv.includes('--dev');
app.setName('KiwiIRC');
const distPath = app.isPackaged ?
    path.join(process.resourcesPath, 'dist') :
    path.resolve(__dirname, '../../dist');

protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
    {
        scheme: MEDIA_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
]);

let mainWindow = null;
let desktopConfig = null;
let desktopConfigPath = null;
let profileStore = null;
let secretStore = null;
let chatLogStore = null;
let allowUnload = false;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (!mainWindow) {
            return;
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    app.whenReady().then(async() => {
        loadDesktopConfiguration();
        const userDataDir = app.getPath('userData');
        profileStore = createProfileStore(userDataDir);
        secretStore = createSecretStore({ userDataDir, safeStorage });
        try {
            chatLogStore = createChatLogStore(userDataDir);
        } catch (err) {
            console.error('Failed to initialize chat log store:', err);
        }
        registerDesktopConfigIpc();
        buildApplicationMenu();
        await registerAppProtocol();
        registerMediaProtocol();
        createWindow();
    }).catch((err) => {
        console.error('Failed to start desktop shell:', err);
        app.quit();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        if (!chatLogStore) {
            return;
        }
        try {
            chatLogStore.close();
        } catch (err) {
            // The database may already be closed.
        }
        chatLogStore = null;
    });
}

function loadDesktopConfiguration() {
    const userDataDir = app.getPath('userData');

    try {
        desktopConfigPath = ensureUserConfig(userDataDir);
    } catch (err) {
        console.error('Failed to initialize desktop configuration:', err);
        desktopConfigPath = path.join(userDataDir, 'config.json5');
    }

    const result = loadDesktopConfig(userDataDir);
    desktopConfig = result.config;
    desktopConfigPath = result.configPath;

    if (result.error) {
        dialog.showErrorBox(
            'Kiwi IRC Configuration Error',
            `${result.configPath}\n\n${result.error.message}\n\nUsing built-in defaults.`
        );
    }
}

function registerDesktopConfigIpc() {
    ipcMain.on('kiwi:desktop-config', (event) => {
        event.returnValue = desktopConfig;
    });

    ipcMain.handle('kiwi:storage-get', (event, name) => profileStore.get(name));
    ipcMain.handle('kiwi:storage-set', (event, name, value) => (
        profileStore.set(name, value)
    ));
    ipcMain.handle('kiwi:secrets-status', () => secretStore.status());
    ipcMain.handle('kiwi:secrets-load', (event, stateKey) => (
        secretStore.load(stateKey)
    ));
    ipcMain.handle('kiwi:secrets-save', (event, stateKey, secrets) => (
        secretStore.save(stateKey, secrets)
    ));
    ipcMain.handle('kiwi:secrets-clear', (event, stateKey) => (
        secretStore.clear(stateKey)
    ));

    ipcMain.handle('kiwi:profile-export', async(event, text, filename) => {
        if (typeof text !== 'string' || !text ||
            Buffer.byteLength(text, 'utf8') > MAX_STORAGE_BYTES
        ) {
            throw new Error('invalid profile data');
        }

        const defaultName = path.basename(
            typeof filename === 'string' && filename ?
                filename :
                'kiwi-profile.json'
        );
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName,
            filters: [{ name: 'Kiwi Profile', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePath) {
            return { saved: false };
        }

        await fs.writeFile(result.filePath, text, { mode: 0o600 });
        return { saved: true, path: result.filePath };
    });

    ipcMain.handle('kiwi:profile-import', async() => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Kiwi Profile', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePaths.length) {
            return { canceled: true };
        }

        const filePath = result.filePaths[0];
        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > MAX_STORAGE_BYTES) {
            throw new Error('profile file is too large');
        }

        return {
            canceled: false,
            path: filePath,
            text: await fs.readFile(filePath, 'utf8'),
        };
    });

    ipcMain.handle('kiwi:profile-backup', () => profileStore.backup());

    ipcMain.handle('kiwi:profile-open-folder', async() => {
        const error = await shell.openPath(profileStore.profileDirectory());
        if (error) {
            throw new Error(error);
        }
    });

    ipcMain.handle('kiwi:logs-append', (event, entries) => (
        requireChatLogStore().append(entries)
    ));
    ipcMain.handle('kiwi:logs-search', (event, options) => (
        requireChatLogStore().search(options)
    ));
    ipcMain.handle('kiwi:logs-context', (event, options) => (
        requireChatLogStore().context(options)
    ));
    ipcMain.handle('kiwi:logs-redact', (event, options) => (
        requireChatLogStore().redact(options)
    ));
    ipcMain.handle('kiwi:logs-confirm', (event, options) => (
        requireChatLogStore().confirm(options)
    ));
    ipcMain.handle('kiwi:logs-prune', (event, retentionDays) => (
        requireChatLogStore().prune(retentionDays)
    ));
    ipcMain.handle('kiwi:logs-clear', () => requireChatLogStore().clear());
    ipcMain.handle('kiwi:logs-stats', () => requireChatLogStore().stats());
    ipcMain.handle('kiwi:logs-status', () => ({
        available: !!chatLogStore,
    }));

    ipcMain.handle('kiwi:http-request', (event, options) => {
        const policy = desktopHttpPolicy();
        return httpService.request(Object.assign({}, options, {
            maxResponseBytes: policy.maxResponseBytes,
            timeoutMs: policy.timeoutMs,
        }), policy);
    });

    ipcMain.handle('kiwi:http-upload', (event, options) => {
        const policy = desktopHttpPolicy();
        return httpService.upload(Object.assign({}, options, {
            maxResponseBytes: policy.maxResponseBytes,
            timeoutMs: policy.timeoutMs,
        }), policy);
    });

    ipcMain.handle('kiwi:save-url', async(event, url) => {
        if (typeof url !== 'string' || !url) {
            throw new Error('invalid download URL');
        }

        const policy = desktopHttpPolicy();
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: suggestedDownloadName(url),
        });
        if (result.canceled || !result.filePath) {
            return { saved: false };
        }

        const response = await httpService.request({
            url,
            maxResponseBytes: policy.maxDownloadBytes,
        }, policy);
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`download failed (${response.status})`);
        }

        await fs.writeFile(result.filePath, response.body);
        return { saved: true, path: result.filePath };
    });
}

function requireChatLogStore() {
    if (!chatLogStore) {
        throw new Error('chat logging is unavailable');
    }
    return chatLogStore;
}

function positiveInteger(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function desktopHttpPolicy() {
    const settings = (desktopConfig && desktopConfig.desktopHttp) || {};
    return {
        allowPrivateNetworks: settings.allowPrivateNetworks === true,
        timeoutMs: positiveInteger(settings.requestTimeoutMs, 15000),
        maxResponseBytes: positiveInteger(settings.maxResponseBytes, 10 * 1024 * 1024),
        maxDownloadBytes: positiveInteger(settings.maxDownloadBytes, 100 * 1024 * 1024),
        maxMediaBytes: positiveInteger(settings.maxMediaBytes, 100 * 1024 * 1024),
        maxRequestBytes: positiveInteger(settings.maxRequestBytes, 100 * 1024 * 1024),
        maxRedirects: positiveInteger(settings.maxRedirects, 5),
    };
}

function suggestedDownloadName(url) {
    try {
        const parsed = new URL(url);
        const name = decodeURIComponent(path.basename(parsed.pathname));
        return name || 'download';
    } catch (err) {
        return 'download';
    }
}

function buildApplicationMenu() {
    const template = [];

    if (process.platform === 'darwin') {
        template.push({ role: 'appMenu' });
    }

    const fileMenu = [
        {
            label: 'Open Desktop Configuration Folder',
            click: () => {
                openDesktopConfigurationFolder();
            },
        },
        {
            label: 'Reload Desktop Configuration',
            click: () => {
                reloadDesktopConfiguration();
            },
        },
    ];

    if (process.platform !== 'darwin') {
        fileMenu.push({ type: 'separator' }, { role: 'quit', label: 'Exit' });
    }

    template.push({
        label: 'File',
        submenu: fileMenu,
    });
    template.push({ role: 'editMenu' });
    template.push({
        label: 'View',
        submenu: [
            {
                label: 'Reload',
                accelerator: 'CmdOrCtrl+R',
                click: () => {
                    reloadWindow(false);
                },
            },
            {
                label: 'Force Reload',
                accelerator: 'CmdOrCtrl+Shift+R',
                click: () => {
                    reloadWindow(true);
                },
            },
            { type: 'separator' },
            {
                label: 'Search Chat Logs…',
                accelerator: 'CmdOrCtrl+Shift+F',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.send('kiwi:logs-open-search');
                    }
                },
            },
            { type: 'separator' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    });

    if (process.platform === 'darwin') {
        template.push({ role: 'windowMenu' });
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function reloadWindow(ignoreCache) {
    if (!mainWindow) {
        return;
    }

    allowUnload = true;
    mainWindow.webContents.once('did-finish-load', () => {
        allowUnload = false;
    });

    if (ignoreCache) {
        mainWindow.webContents.reloadIgnoringCache();
    } else {
        mainWindow.webContents.reload();
    }
}

async function openDesktopConfigurationFolder() {
    try {
        desktopConfigPath = ensureUserConfig(app.getPath('userData'));
        const error = await shell.openPath(path.dirname(desktopConfigPath));
        if (error) {
            dialog.showErrorBox('Unable to Open Configuration Folder', error);
        }
    } catch (err) {
        dialog.showErrorBox('Unable to Open Configuration Folder', err.message);
    }
}

function reloadDesktopConfiguration() {
    loadDesktopConfiguration();
    reloadWindow(false);
}

async function registerAppProtocol() {
    protocol.handle(APP_SCHEME, async(request) => {
        let requestUrl;
        try {
            requestUrl = new URL(request.url);
        } catch (err) {
            return new Response('Bad request', { status: 400 });
        }

        if (requestUrl.host !== APP_HOST) {
            return new Response('Not found', { status: 404 });
        }

        let pathname;
        try {
            pathname = decodeURIComponent(requestUrl.pathname);
        } catch (err) {
            return new Response('Bad request', { status: 400 });
        }

        if (!pathname || pathname === '/') {
            pathname = '/index.html';
        }

        const root = path.resolve(distPath);
        let filePath = path.resolve(root, pathname.replace(/^\/+/, ''));
        const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
        if (filePath !== root && !filePath.startsWith(rootPrefix)) {
            return new Response('Not found', { status: 404 });
        }

        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }
            return net.fetch(pathToFileURL(filePath).toString());
        } catch (err) {
            // Hash-routing clients may request extensionless paths. The app has
            // a single entry point, so fall back to it rather than returning a
            // broken page.
            if (!path.extname(filePath)) {
                return net.fetch(pathToFileURL(path.join(root, 'index.html')).toString());
            }
            return new Response('Not found', { status: 404 });
        }
    });
}

function registerMediaProtocol() {
    const allowedOrigins = isDev ? [APP_ORIGIN, DEV_ORIGIN] : [APP_ORIGIN];
    protocol.handle(MEDIA_SCHEME, async(request) => (
        handleMediaRequest(request, desktopHttpPolicy(), allowedOrigins)
    ));
}

function createWindow() {
    const userDataDir = app.getPath('userData');
    const savedState = loadWindowState(userDataDir);
    const bounds = restoreWindowState(
        savedState,
        screen.getAllDisplays().map((display) => display.workArea),
        screen.getPrimaryDisplay().workArea
    );
    const window = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minWidth: 800,
        minHeight: 560,
        show: false,
        backgroundColor: '#1b1b1b',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
        },
    });

    mainWindow = window;

    let stateTimer = null;
    const captureWindowState = () => {
        if (window.isDestroyed()) {
            return null;
        }
        const normal = window.getNormalBounds();
        return {
            width: normal.width,
            height: normal.height,
            x: normal.x,
            y: normal.y,
            maximized: window.isMaximized(),
        };
    };
    const saveWindowStateNow = () => {
        const state = captureWindowState();
        if (state) {
            saveWindowState(userDataDir, state).catch(() => {});
        }
    };
    const scheduleWindowStateSave = () => {
        if (stateTimer) {
            clearTimeout(stateTimer);
        }
        stateTimer = setTimeout(() => {
            stateTimer = null;
            saveWindowStateNow();
        }, 500);
    };

    window.on('resize', scheduleWindowStateSave);
    window.on('move', scheduleWindowStateSave);
    window.on('maximize', scheduleWindowStateSave);
    window.on('unmaximize', scheduleWindowStateSave);
    window.on('close', () => {
        if (stateTimer) {
            clearTimeout(stateTimer);
            stateTimer = null;
        }
        const state = captureWindowState();
        if (state) {
            try {
                saveWindowStateSync(userDataDir, state);
            } catch (err) {
                // Window state is best-effort.
            }
        }
    });
    window.once('ready-to-show', () => {
        if (savedState && savedState.maximized) {
            window.maximize();
        }
        window.show();
    });
    window.on('closed', () => {
        if (stateTimer) {
            clearTimeout(stateTimer);
            stateTimer = null;
        }
        if (mainWindow === window) {
            mainWindow = null;
        }
    });

    window.webContents.on('will-prevent-unload', (event) => {
        if (allowUnload) {
            allowUnload = false;
            event.preventDefault();
            return;
        }

        const choice = dialog.showMessageBoxSync(window, {
            type: 'question',
            buttons: ['Close', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'Kiwi IRC',
            message: process.platform === 'darwin' ? 'Close this window?' : 'Close Kiwi IRC?',
            detail: 'Active IRC connections will be disconnected.',
        });

        if (choice === 0) {
            event.preventDefault();
        }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        openExternal(url);
        return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, url) => {
        if (isAllowedNavigation(url)) {
            return;
        }
        event.preventDefault();
        openExternal(url);
    });

    window.webContents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });

    if (isDev) {
        window.loadURL(DEV_ORIGIN);
    } else {
        window.loadURL(`${APP_ORIGIN}/index.html`);
    }
}

function isAllowedNavigation(url) {
    try {
        const target = new URL(url);
        if (isDev) {
            return target.origin === DEV_ORIGIN;
        }
        return target.protocol === `${APP_SCHEME}:` && target.host === APP_HOST;
    } catch (err) {
        return false;
    }
}

function openExternal(url) {
    try {
        const target = new URL(url);
        if (['http:', 'https:', 'mailto:'].includes(target.protocol)) {
            shell.openExternal(target.href);
        }
    } catch (err) {
        // Ignore malformed or unsupported URLs.
    }
}
