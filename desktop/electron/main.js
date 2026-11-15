const {
    app,
    BrowserWindow,
    Menu,
    Notification,
    Tray,
    dialog,
    ipcMain,
    protocol,
    net,
    nativeImage,
    safeStorage,
    screen,
    session,
    shell,
} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ensureUserConfig, loadDesktopConfig } = require('./desktop-config');
const {
    THEME_SCHEME,
    installTheme,
    listThemes,
    resolveThemeFile,
    uninstallTheme,
} = require('./themes');
const {
    EMOJI_PACK_SCHEME,
    installEmojiPack,
    listEmojiPacks,
    resolveEmojiPackFile,
    uninstallEmojiPack,
} = require('./emoji-packs');
const {
    ALLOWED_EXTENSION_LIST,
    ICON_SCHEME,
    installNetworkIcon,
    resolveNetworkIconFile,
} = require('./network-icons');
const httpService = require('./http');
const { handleMediaRequest } = require('./media');
const { MEDIA_SCHEME } = require('./media-url');
const { createProfileStore, MAX_STORAGE_BYTES } = require('./profile-store');
const { createSecretStore } = require('./secrets');
const { createNotificationService } = require('./notifications');
const { createDesktopSettingsStore } = require('./desktop-settings');
const { createAutoLaunchService } = require('./auto-launch');
const { createTrayService } = require('./tray');
const { buildEditableContextMenuTemplate } = require('./spellcheck-menu');
const { createMainLog } = require('./main-log');
const { createChatLogStore } = require('./chat-log-store');
const { addEmbedReferer } = require('./embed-referer');
const { addAppFrameAncestor } = require('./twitch-embed-policy');
const {
    loadWindowState,
    restoreWindowState,
    saveWindowState,
    saveWindowStateSync,
} = require('./window-state');
const { buildPresetMenu, normalisePresetItems } = require('./preset-menu');

const APP_SCHEME = 'app';
const APP_HOST = 'kiwi';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DEV_ORIGIN = 'http://localhost:8080';
const isDev = process.argv.includes('--dev');
const isVerbose = process.argv.includes('--verbose');
if (!isDev && !isVerbose) {
    app.commandLine.appendSwitch('log-level', '3');
    app.commandLine.appendSwitch('v', '0');
}
app.setName('KiwiIRC');
if (process.platform === 'win32') {
    app.setAppUserModelId('net.nephatrine.kiwiirc');
}
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
    {
        scheme: THEME_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
    {
        scheme: EMOJI_PACK_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
    {
        scheme: ICON_SCHEME,
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
let notificationService = null;
let desktopSettingsStore = null;
let autoLaunchService = null;
let trayService = null;
let mainLog = null;
let chatLogStore = null;
let chatLogError = '';
let availablePresets = [];
let allowUnload = false;
let isQuitting = false;

function logInfo(...args) {
    if (mainLog) {
        mainLog.info(...args);
    }
}

function logWarn(...args) {
    if (mainLog) {
        mainLog.warn(...args);
    }
    console.warn(...args);
}

function logError(...args) {
    if (mainLog) {
        mainLog.error(...args);
    }
    console.error(...args);
}

process.on('uncaughtException', (err) => {
    logError('Uncaught exception', err);
});

process.on('unhandledRejection', (reason) => {
    logError('Unhandled rejection', reason);
});

app.on('render-process-gone', (event, webContents, details) => {
    logError('Renderer process gone', details);
});

app.on('child-process-gone', (event, details) => {
    logError('Child process gone', details);
});

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        showMainWindow();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            showMainWindow();
        }
    });

    app.whenReady().then(async() => {
        app.setAppLogsPath();
        try {
            mainLog = createMainLog({ logDir: app.getPath('logs') });
        } catch (err) {
            console.error('Failed to initialize main log:', err);
        }
        logInfo('Desktop starting', {
            version: app.getVersion(),
            platform: process.platform,
            packaged: app.isPackaged,
        });
        loadDesktopConfiguration();
        const userDataDir = app.getPath('userData');
        profileStore = createProfileStore(userDataDir);
        secretStore = createSecretStore({ userDataDir, safeStorage });
        desktopSettingsStore = createDesktopSettingsStore(userDataDir);
        await desktopSettingsStore.load();
        autoLaunchService = createAutoLaunchService({
            app,
            platform: process.platform,
            execPath: process.execPath,
            env: process.env,
            isPackaged: app.isPackaged,
        });
        try {
            await autoLaunchService.apply(desktopSettingsStore.get().autoLaunch);
        } catch (err) {
            logError('Failed to apply auto-launch settings', err);
        }
        configureSpellchecker(desktopSettingsStore.get());
        notificationService = createNotificationService({
            Notification,
            getWindow: () => mainWindow,
            onActivate: (id) => sendToRenderer('kiwi:notification-click', id),
            onClose: (id, reason) => {
                if (reason === 'click' || reason === 'shutdown') {
                    return;
                }
                sendToRenderer('kiwi:notification-closed', id, reason);
            },
        });
        try {
            chatLogStore = createChatLogStore(userDataDir);
            chatLogError = '';
        } catch (err) {
            chatLogError = err.message || String(err);
            logError('Failed to initialize chat log store', err);
        }
        registerDesktopConfigIpc();
        registerThemeIpc();
        registerEmojiPackIpc();
        registerNetworkIconIpc();
        registerPresetIpc();
        registerNotificationIpc();
        registerDesktopSettingsIpc();
        registerAutoLaunchIpc();
        trayService = createTrayService({
            app,
            Tray,
            Menu,
            nativeImage,
            getWindow: () => mainWindow,
            getSettings: () => desktopSettingsStore.get(),
            onChangeCloseToTray: (enabled) => {
                saveDesktopSettings({
                    closeToTray: enabled,
                }).catch((err) => {
                    logError('Failed to update desktop settings', err);
                });
            },
            onQuit: quitFromTray,
            trayIconPath: resolveDesktopIcon('tray.png'),
            badgeIconPath: resolveDesktopIcon('badge.png'),
            platform: process.platform,
        });
        if (!trayService.create()) {
            logWarn('System tray unavailable; close-to-tray is disabled.');
        }
        registerTrayIpc();
        buildApplicationMenu();
        await registerAppProtocol();
        registerThemeProtocol();
        registerEmojiPackProtocol();
        registerNetworkIconProtocol();
        registerMediaProtocol();
        registerEmbedRequestHeaders();
        registerTwitchFramePolicy();
        const startHidden = !isDev &&
            process.argv.includes('--hidden') &&
            trayService.isAvailable() &&
            desktopSettingsStore.get().closeToTray;
        createWindow(startHidden);
        if (trayService) {
            trayService.updateMenu();
        }
        registerEmbedErrorForwarding();
    }).catch((err) => {
        logError('Failed to start desktop shell', err);
        app.quit();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        isQuitting = true;
        logInfo('Quit requested');
    });

    app.on('will-quit', () => {
        logInfo('Quitting');
        cleanupDesktopServices();
    });
}

function cleanupDesktopServices() {
    if (trayService) {
        trayService.destroy();
        trayService = null;
    }

    if (notificationService) {
        notificationService.closeAll();
        notificationService = null;
    }

    if (chatLogStore) {
        try {
            chatLogStore.close();
        } catch (err) {
            // The database may already be closed.
        }
        chatLogStore = null;
    }
}

function loadDesktopConfiguration() {
    const userDataDir = app.getPath('userData');

    try {
        desktopConfigPath = ensureUserConfig(userDataDir);
    } catch (err) {
        logError('Failed to initialize desktop configuration', err);
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

    ipcMain.on('kiwi:logs-supported', (event) => {
        event.returnValue = !!chatLogStore;
    });
    ipcMain.handle('kiwi:logs-append', (event, entries) => (
        safeChatLog((store) => store.append(entries), 0)
    ));
    ipcMain.handle('kiwi:logs-search', (event, options) => (
        safeChatLog(
            (store) => store.search(options),
            { rows: [], hasMore: false }
        )
    ));
    ipcMain.handle('kiwi:logs-context', (event, options) => (
        safeChatLog(
            (store) => store.context(options),
            { rows: [], hasOlder: false, hasNewer: false }
        )
    ));
    ipcMain.handle('kiwi:logs-redact', (event, options) => (
        safeChatLog((store) => store.redact(options), 0)
    ));
    ipcMain.handle('kiwi:logs-confirm', (event, options) => (
        safeChatLog((store) => store.confirm(options), 0)
    ));
    ipcMain.handle('kiwi:logs-prune', (event, retentionDays) => (
        safeChatLog((store) => store.prune(retentionDays), 0)
    ));
    ipcMain.handle('kiwi:logs-clear', () => (
        safeChatLog((store) => store.clear(), undefined)
    ));
    ipcMain.handle('kiwi:logs-stats', () => (
        safeChatLog(
            (store) => store.stats(),
            { count: 0, oldest: 0, newest: 0, size: 0 }
        )
    ));
    ipcMain.handle('kiwi:logs-status', () => ({
        available: !!chatLogStore,
        error: chatLogError,
        searchMode: chatLogStore && typeof chatLogStore.searchMode === 'function' ?
            chatLogStore.searchMode() :
            '',
    }));

    ipcMain.handle('kiwi:http-request', (event, options) => {
        const policy = desktopHttpPolicy();
        const requestedMax = Number(options.maxResponseBytes);
        const maxResponseBytes = Number.isFinite(requestedMax) && requestedMax > 0 ?
            Math.min(policy.maxResponseBytes, Math.floor(requestedMax)) :
            policy.maxResponseBytes;
        return httpService.request(Object.assign({}, options, {
            maxResponseBytes,
            timeoutMs: policy.timeoutMs,
        }), policy);
    });

    ipcMain.handle('kiwi:http-upload', (event, options) => {
        const policy = desktopHttpPolicy();
        return httpService.upload(Object.assign({}, options, {
            maxResponseBytes: policy.maxResponseBytes,
            maxUploadBytes: policy.maxUploadBytes,
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

function registerThemeIpc() {
    ipcMain.handle('kiwi:themes-list', () => (
        listThemes(app.getPath('userData'))
    ));

    ipcMain.handle('kiwi:themes-install', async() => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Theme Archive', extensions: ['zip'] }],
        });
        if (result.canceled || !result.filePaths.length) {
            return { canceled: true };
        }

        const theme = await installTheme(
            app.getPath('userData'),
            result.filePaths[0]
        );
        return { canceled: false, theme };
    });

    ipcMain.handle('kiwi:themes-uninstall', (event, id) => (
        uninstallTheme(app.getPath('userData'), id)
    ));
}

function registerEmojiPackIpc() {
    ipcMain.handle('kiwi:emoji-packs-list', () => (
        listEmojiPacks(app.getPath('userData'))
    ));

    ipcMain.handle('kiwi:emoji-packs-install', async() => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Emoji Pack Archive', extensions: ['zip'] }],
        });
        if (result.canceled || !result.filePaths.length) {
            return { canceled: true };
        }

        const emojiPack = await installEmojiPack(
            app.getPath('userData'),
            result.filePaths[0]
        );
        return { canceled: false, emojiPack };
    });

    ipcMain.handle('kiwi:emoji-packs-uninstall', (event, id) => (
        uninstallEmojiPack(app.getPath('userData'), id)
    ));
}

function registerNetworkIconIpc() {
    ipcMain.handle('kiwi:network-icons-choose', async(event, networkName) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{
                name: 'Images',
                extensions: ALLOWED_EXTENSION_LIST,
            }],
        });
        if (result.canceled || !result.filePaths.length) {
            return { canceled: true };
        }

        return installNetworkIcon(
            app.getPath('userData'),
            networkName,
            result.filePaths[0]
        );
    });
}

function safeChatLog(callback, fallback) {
    if (!chatLogStore) {
        return fallback;
    }

    try {
        return callback(chatLogStore);
    } catch (err) {
        chatLogError = err.message || String(err);
        logError('Chat log operation failed', err);
        return fallback;
    }
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
        maxUploadBytes: positiveInteger(settings.maxUploadBytes, 256 * 1024 * 1024),
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

function registerPresetIpc() {
    ipcMain.on('kiwi:presets-available', (event, presets) => {
        if (!mainWindow || event.sender !== mainWindow.webContents) {
            return;
        }

        const nextPresets = normalisePresetItems(presets);
        if (JSON.stringify(nextPresets) === JSON.stringify(availablePresets)) {
            return;
        }

        availablePresets = nextPresets;
        buildApplicationMenu();
    });
}

function registerNotificationIpc() {
    ipcMain.on('kiwi:notification-supported', (event) => {
        event.returnValue = !!(
            notificationService && notificationService.isSupported()
        );
    });
    ipcMain.handle('kiwi:notification-show', (event, payload) => (
        notificationService ?
            notificationService.show(payload) :
            { shown: false, reason: 'unavailable' }
    ));
    ipcMain.handle('kiwi:notification-close', (event, id) => (
        notificationService ? notificationService.close(id) : false
    ));
}

function registerDesktopSettingsIpc() {
    ipcMain.handle('kiwi:desktop-settings', () => (
        desktopSettingsStore ?
            desktopSettingsStore.get() :
            {}
    ));
    ipcMain.handle('kiwi:desktop-settings-set', (event, patch) => {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new Error('invalid desktop settings');
        }

        const next = {};
        ['closeToTray', 'spellcheck'].forEach((key) => {
            if (typeof patch[key] === 'boolean') {
                next[key] = patch[key];
            }
        });
        if (!Object.keys(next).length) {
            throw new Error('invalid desktop settings');
        }

        return saveDesktopSettings(next);
    });
}

function registerTrayIpc() {
    ipcMain.on('kiwi:tray-supported', (event) => {
        event.returnValue = !!(trayService && trayService.isAvailable());
    });
    ipcMain.on('kiwi:tray-badge', (event, summary) => {
        if (trayService) {
            trayService.updateBadge(summary);
        }
    });
}

function registerAutoLaunchIpc() {
    ipcMain.handle('kiwi:auto-launch-get', async() => {
        if (!autoLaunchService || !autoLaunchService.isSupported()) {
            return {
                supported: false,
                enabled: false,
            };
        }
        return {
            supported: true,
            enabled: await autoLaunchService.isEnabled(),
        };
    });
    ipcMain.handle('kiwi:auto-launch-set', async(event, enabled) => {
        if (typeof enabled !== 'boolean') {
            throw new Error('invalid auto-launch setting');
        }
        if (!autoLaunchService || !autoLaunchService.isSupported()) {
            return {
                supported: false,
                enabled: false,
            };
        }

        await autoLaunchService.setEnabled(enabled);
        await desktopSettingsStore.set({
            autoLaunch: enabled,
        });
        return {
            supported: true,
            enabled: await autoLaunchService.isEnabled(),
        };
    });
}

function configureSpellchecker(settings) {
    try {
        const defaultSession = session.defaultSession;
        defaultSession.setSpellCheckerEnabled(!!settings.spellcheck);

        const available = defaultSession.availableSpellCheckerLanguages || [];
        const preferred = (app.getPreferredSystemLanguages() || [])
            .map((language) => String(language).replace(/_/g, '-'))
            .filter((language) => available.includes(language));
        if (preferred.length) {
            defaultSession.setSpellCheckerLanguages(preferred);
        }
    } catch (err) {
        logError('Failed to configure spellcheck', err);
    }
}

async function saveDesktopSettings(patch) {
    if (!desktopSettingsStore) {
        return {};
    }

    const settings = await desktopSettingsStore.set(patch);
    if (Object.prototype.hasOwnProperty.call(patch, 'closeToTray') && trayService) {
        trayService.setCloseToTray(settings.closeToTray);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'spellcheck')) {
        configureSpellchecker(settings);
    }
    sendToRenderer('kiwi:desktop-settings-changed', settings);
    return settings;
}

function quitFromTray() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        showMainWindow();
    }
    isQuitting = true;
    app.quit();
}

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    if (trayService) {
        trayService.updateMenu();
    }
    return true;
}

function resolveDesktopIcon(name) {
    return app.isPackaged ?
        path.join(process.resourcesPath, 'assets', name) :
        path.join(__dirname, '..', 'assets', name);
}

function sendToRenderer(channel, ...args) {
    if (!mainWindow || mainWindow.isDestroyed() ||
        !mainWindow.webContents || mainWindow.webContents.isDestroyed()
    ) {
        return;
    }
    mainWindow.webContents.send(channel, ...args);
}

function sendLayoutPreset(id) {
    sendToRenderer('kiwi:apply-preset', id);
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
        {
            label: 'Open Log Folder',
            click: () => {
                openLogFolder();
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
                label: 'Search Messages…',
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

    const presetMenu = buildPresetMenu(availablePresets, sendLayoutPreset);
    if (presetMenu) {
        template.push(presetMenu);
    }

    if (process.platform === 'darwin') {
        template.push({ role: 'windowMenu' });
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function reloadWindow(ignoreCache) {
    if (!mainWindow) {
        return;
    }

    if (notificationService) {
        notificationService.closeAll();
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

async function openLogFolder() {
    try {
        const logDir = mainLog ? path.dirname(mainLog.path()) : app.getPath('logs');
        const error = await shell.openPath(logDir);
        if (error) {
            dialog.showErrorBox('Unable to Open Log Folder', error);
        }
    } catch (err) {
        dialog.showErrorBox('Unable to Open Log Folder', err.message);
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

function registerThemeProtocol() {
    protocol.handle(THEME_SCHEME, async(request) => {
        try {
            const resolved = await resolveThemeFile(
                app.getPath('userData'),
                request.url
            );
            if (!resolved) {
                return new Response('Not found', { status: 404 });
            }

            const response = await net.fetch(
                pathToFileURL(resolved.filePath).toString()
            );
            const headers = new Headers(response.headers);
            headers.set('Content-Type', resolved.mimeType);
            return new Response(response.body, {
                status: response.status,
                headers,
            });
        } catch (err) {
            return new Response('Not found', { status: 404 });
        }
    });
}

function registerEmojiPackProtocol() {
    protocol.handle(EMOJI_PACK_SCHEME, async(request) => {
        try {
            const resolved = await resolveEmojiPackFile(
                app.getPath('userData'),
                request.url
            );
            if (!resolved) {
                return new Response('Not found', { status: 404 });
            }

            const response = await net.fetch(
                pathToFileURL(resolved.filePath).toString()
            );
            const headers = new Headers(response.headers);
            headers.set('Content-Type', resolved.mimeType);
            return new Response(response.body, {
                status: response.status,
                headers,
            });
        } catch (err) {
            return new Response('Not found', { status: 404 });
        }
    });
}

function registerNetworkIconProtocol() {
    protocol.handle(ICON_SCHEME, async(request) => {
        try {
            const resolved = await resolveNetworkIconFile(
                app.getPath('userData'),
                request.url
            );
            if (!resolved) {
                return new Response('Not found', { status: 404 });
            }

            const response = await net.fetch(
                pathToFileURL(resolved.filePath).toString()
            );
            const headers = new Headers(response.headers);
            headers.set('Content-Type', resolved.mimeType);
            return new Response(response.body, {
                status: response.status,
                headers,
            });
        } catch (err) {
            return new Response('Not found', { status: 404 });
        }
    });
}

function registerEmbedRequestHeaders() {
    session.defaultSession.webRequest.onBeforeSendHeaders(
        {
            urls: [
                'https://www.youtube.com/*',
                'https://www.youtube-nocookie.com/*',
                'https://clips.twitch.tv/*',
                'https://player.twitch.tv/*',
                'https://www.twitch.tv/*',
                'https://vimeo.com/*',
                'https://*.vimeo.com/*',
            ],
        },
        (details, callback) => {
            // Electron's callback receives a response object, not an error.
            // eslint-disable-next-line n/no-callback-literal
            callback({
                requestHeaders: addEmbedReferer(details.requestHeaders),
            });
        }
    );
}

function registerTwitchFramePolicy() {
    session.defaultSession.webRequest.onHeadersReceived(
        {
            urls: [
                'https://clips.twitch.tv/*',
                'https://player.twitch.tv/*',
                'https://www.twitch.tv/*',
            ],
        },
        (details, callback) => {
            // Electron's callback receives a response object, not an error.
            // eslint-disable-next-line n/no-callback-literal
            callback({
                responseHeaders: addAppFrameAncestor(details.responseHeaders),
            });
        }
    );
}

function registerEmbedErrorForwarding() {
    session.defaultSession.webRequest.onErrorOccurred(
        {
            urls: ['https://*/*'],
        },
        (details) => {
            if (details.resourceType !== 'subFrame' ||
                !mainWindow ||
                mainWindow.isDestroyed()) {
                return;
            }

            mainWindow.webContents.send(
                'kiwi:embed-error',
                details.url,
                details.error || ''
            );
        }
    );
}

function registerMediaProtocol() {
    const allowedOrigins = isDev ? [APP_ORIGIN, DEV_ORIGIN] : [APP_ORIGIN];
    protocol.handle(MEDIA_SCHEME, async(request) => (
        handleMediaRequest(request, desktopHttpPolicy(), allowedOrigins)
    ));
}

function createWindow(startHidden = false) {
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
            spellcheck: true,
            // IRC needs keepalives and reconnect timers to keep running while
            // the window is minimized or behind another application.
            backgroundThrottling: false,
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
    window.on('close', (event) => {
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

        if (!isQuitting && trayService && trayService.shouldHideOnClose()) {
            event.preventDefault();
            window.hide();
            trayService.updateMenu();
        }
    });
    window.on('show', () => {
        sendToRenderer('kiwi:window-visibility', true);
        if (trayService) {
            trayService.updateMenu();
        }
    });
    window.on('hide', () => {
        sendToRenderer('kiwi:window-visibility', false);
        if (trayService) {
            trayService.updateMenu();
        }
    });
    window.once('ready-to-show', () => {
        if (savedState && savedState.maximized) {
            window.maximize();
        }
        if (!startHidden) {
            window.show();
        }
    });
    window.webContents.on('did-finish-load', () => {
        sendToRenderer('kiwi:window-visibility', window.isVisible());
    });
    window.webContents.on('context-menu', (event, params) => {
        if (!params.isEditable) {
            return;
        }

        const template = buildEditableContextMenuTemplate(params, {
            replaceMisspelling: (word) => window.webContents.replaceMisspelling(word),
            addToDictionary: (word) => (
                window.webContents.session.addWordToSpellCheckerDictionary(word)
            ),
        });
        Menu.buildFromTemplate(template).popup({ window });
    });
    window.on('closed', () => {
        if (stateTimer) {
            clearTimeout(stateTimer);
            stateTimer = null;
        }
        if (notificationService) {
            notificationService.closeAll();
        }
        if (mainWindow === window) {
            mainWindow = null;
        }
        if (trayService) {
            trayService.updateMenu();
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
            logInfo('Quit confirmed');
            event.preventDefault();
        } else {
            isQuitting = false;
            logInfo('Quit canceled');
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
