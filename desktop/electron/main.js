const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ensureUserConfig, loadDesktopConfig } = require('./desktop-config');

const APP_SCHEME = 'app';
const APP_HOST = 'kiwi';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DEV_ORIGIN = 'http://localhost:8080';
const isDev = process.argv.includes('--dev');
app.setName('KiwiIRC');
const distPath = app.isPackaged ?
    path.join(process.resourcesPath, 'dist') :
    path.resolve(__dirname, '../../dist');

protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
    },
}]);

let mainWindow = null;
let desktopConfig = null;
let desktopConfigPath = null;

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
        registerDesktopConfigIpc();
        buildApplicationMenu();
        await registerAppProtocol();
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
}

function buildApplicationMenu() {
    const template = [];

    if (process.platform === 'darwin') {
        template.push({ role: 'appMenu' });
    }

    template.push({
        label: 'File',
        submenu: [
            {
                label: 'Open Desktop Configuration',
                click: () => {
                    openDesktopConfiguration();
                },
            },
            {
                label: 'Reload Desktop Configuration',
                click: () => {
                    reloadDesktopConfiguration();
                },
            },
            { type: 'separator' },
            ...(process.platform === 'darwin' ? [] : [{ role: 'quit' }]),
        ],
    });
    template.push({ role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' });

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openDesktopConfiguration() {
    try {
        desktopConfigPath = ensureUserConfig(app.getPath('userData'));
        const error = await shell.openPath(desktopConfigPath);
        if (error) {
            dialog.showErrorBox('Unable to Open Configuration', error);
        }
    } catch (err) {
        dialog.showErrorBox('Unable to Open Configuration', err.message);
    }
}

function reloadDesktopConfiguration() {
    loadDesktopConfiguration();
    if (mainWindow) {
        mainWindow.webContents.reload();
    }
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

function createWindow() {
    const window = new BrowserWindow({
        width: 1280,
        height: 820,
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
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => {
        if (mainWindow === window) {
            mainWindow = null;
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
