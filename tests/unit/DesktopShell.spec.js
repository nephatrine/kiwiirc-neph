const fsSync = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
    buildLinuxAutostartEntry,
    createAutoLaunchService,
    escapeDesktopExec,
    linuxAutostartPath,
} = require('../../desktop/electron/auto-launch');
const {
    loadWindowState,
    restoreWindowState,
    saveWindowState,
    saveWindowStateSync,
    stateFilePath,
} = require('../../desktop/electron/window-state');
const {
    createMainLog,
    formatValue,
} = require('../../desktop/electron/main-log');
const {
    installNetworkIcon,
    resolveNetworkIconFile,
} = require('../../desktop/electron/network-icons');

describe('auto-launch', () => {
    const fs = fsp;
    let tempDir;

    beforeEach(async() => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-auto-launch-'));
    });

    afterEach(async() => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('quotes Exec paths and builds the Linux autostart entry', () => {
        expect(escapeDesktopExec('/opt/Kiwi IRC/kiwiirc-desktop'))
            .toBe('"/opt/Kiwi IRC/kiwiirc-desktop"');
        expect(escapeDesktopExec('/opt/a%20b'))
            .toBe('"/opt/a%%20b"');

        const entry = buildLinuxAutostartEntry('/opt/Kiwi IRC/kiwiirc-desktop');

        expect(entry).toContain('[Desktop Entry]');
        expect(entry).toContain('Name=Kiwi IRC');
        expect(entry).toContain(
            'Exec="/opt/Kiwi IRC/kiwiirc-desktop" --hidden'
        );
        expect(entry).toContain('X-GNOME-Autostart-enabled=true');
    });

    it('writes and removes the Linux file, honoring APPIMAGE', async() => {
        let service = createAutoLaunchService({
            app: {},
            platform: 'linux',
            execPath: '/opt/Kiwi IRC/kiwiirc-desktop',
            env: {
                XDG_CONFIG_HOME: tempDir,
            },
            home: tempDir,
            isPackaged: true,
        });
        const filePath = linuxAutostartPath({
            XDG_CONFIG_HOME: tempDir,
        }, tempDir);

        expect(await service.isEnabled()).toBe(false);
        await service.setEnabled(true);
        expect(await service.isEnabled()).toBe(true);
        expect(await fs.readFile(filePath, 'utf8')).toContain(
            'Exec="/opt/Kiwi IRC/kiwiirc-desktop" --hidden'
        );

        await service.setEnabled(false);
        expect(await service.isEnabled()).toBe(false);

        service = createAutoLaunchService({
            app: {},
            platform: 'linux',
            execPath: '/tmp/.mount/kiwiirc-desktop',
            env: {
                XDG_CONFIG_HOME: tempDir,
                APPIMAGE: '/opt/KiwiIRC.AppImage',
            },
            home: tempDir,
            isPackaged: true,
        });

        await service.setEnabled(true);

        expect(await fs.readFile(service.autostartPath(), 'utf8'))
            .toContain('Exec="/opt/KiwiIRC.AppImage" --hidden');
    });

    it('uses login item settings on Windows and macOS', async() => {
        let enabled = false;
        let app = {
            getLoginItemSettings: jest.fn(() => ({ openAtLogin: enabled })),
            setLoginItemSettings: jest.fn((settings) => {
                enabled = settings.openAtLogin;
            }),
        };
        let service = createAutoLaunchService({
            app,
            platform: 'win32',
            execPath: 'C:\\Program Files\\KiwiIRC\\KiwiIRC.exe',
            isPackaged: true,
        });

        expect(await service.isEnabled()).toBe(false);
        await service.setEnabled(true);
        expect(app.setLoginItemSettings).toHaveBeenCalledWith({
            openAtLogin: true,
            path: 'C:\\Program Files\\KiwiIRC\\KiwiIRC.exe',
            args: ['--hidden'],
        });
        expect(await service.isEnabled()).toBe(true);

        enabled = false;
        app = {
            getLoginItemSettings: jest.fn(() => ({ openAtLogin: enabled })),
            setLoginItemSettings: jest.fn((settings) => {
                enabled = settings.openAtLogin;
            }),
        };
        service = createAutoLaunchService({
            app,
            platform: 'darwin',
            execPath: '/Applications/KiwiIRC.app',
            isPackaged: true,
        });

        await service.setEnabled(true);
        expect(app.setLoginItemSettings).toHaveBeenCalledWith({
            openAtLogin: true,
            openAsHidden: true,
        });
        expect(await service.isEnabled()).toBe(true);
    });

    it('is unavailable in development builds', async() => {
        const service = createAutoLaunchService({
            app: {},
            platform: 'linux',
            execPath: '/opt/kiwiirc-desktop',
            env: {
                XDG_CONFIG_HOME: tempDir,
            },
            home: tempDir,
            isPackaged: false,
        });

        expect(service.isSupported()).toBe(false);
        expect(await service.isEnabled()).toBe(false);
        expect(await service.setEnabled(true)).toBe(false);
    });
});

describe('Desktop window state', () => {
    const fs = fsSync;
    const primary = { x: 0, y: 0, width: 1920, height: 1080 };
    const secondary = { x: 1920, y: 0, width: 1920, height: 1080 };
    const left = { x: -1920, y: 0, width: 1920, height: 1080 };
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-window-state-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('centers, restores, and clamps bounds across displays', () => {
        expect(restoreWindowState(null, [primary, secondary], primary)).toEqual({
            x: 320,
            y: 130,
            width: 1280,
            height: 820,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 2100,
            y: 100,
            width: 1000,
            height: 700,
        }, [primary, secondary], primary)).toEqual({
            x: 2100,
            y: 100,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: -1500,
            y: 100,
            width: 1000,
            height: 700,
        }, [left, primary], primary)).toEqual({
            x: -1500,
            y: 100,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 9000,
            y: 9000,
            width: 1000,
            height: 700,
        }, [primary, secondary], primary)).toEqual({
            x: 460,
            y: 190,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 100,
            y: 100,
            width: 4000,
            height: 3000,
            maximized: true,
        }, [primary], primary)).toEqual({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            maximized: true,
        });
    });

    it('round-trips the window state and ignores malformed files', async() => {
        await saveWindowState(userDataDir, {
            x: 10,
            y: 20,
            width: 900,
            height: 700,
            maximized: false,
        });

        expect(loadWindowState(userDataDir)).toEqual({
            x: 10,
            y: 20,
            width: 900,
            height: 700,
            maximized: false,
        });

        saveWindowStateSync(userDataDir, {
            x: 30,
            y: 40,
            width: 1000,
            height: 800,
            maximized: true,
        });
        expect(loadWindowState(userDataDir)).toEqual({
            x: 30,
            y: 40,
            width: 1000,
            height: 800,
            maximized: true,
        });

        fs.writeFileSync(stateFilePath(userDataDir), '{invalid');
        expect(loadWindowState(userDataDir)).toBe(null);
    });
});

describe('desktop main log', () => {
    const fs = fsSync;
    let logDir;

    beforeEach(() => {
        logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-main-log-'));
    });

    afterEach(() => {
        fs.rmSync(logDir, { recursive: true, force: true });
    });

    it('writes timestamped log lines and formats errors and objects', () => {
        const log = createMainLog({ logDir });

        log.info('started');
        log.warn('warning');
        log.error(new Error('boom'));

        const text = fs.readFileSync(log.path(), 'utf8');
        expect(text).toContain('[INFO] started');
        expect(text).toContain('[WARN] warning');
        expect(text).toContain('[ERROR] Error: boom');

        expect(formatValue(new Error('boom'))).toContain('Error: boom');
        expect(formatValue({ ok: true })).toBe('{"ok":true}');
    });

    it('rotates the log when it exceeds the size limit', () => {
        const log = createMainLog({
            logDir,
            maxBytes: 80,
        });

        log.info('a'.repeat(60));
        log.info('b'.repeat(60));

        expect(fs.existsSync(`${log.path()}.1`)).toBe(true);
        expect(fs.readFileSync(`${log.path()}.1`, 'utf8'))
            .toContain('a'.repeat(60));
        expect(fs.readFileSync(log.path(), 'utf8'))
            .toContain('b'.repeat(60));
    });
});

describe('desktop network icons', () => {
    const fs = fsp;
    let tempDir;
    let sourcePath;

    beforeEach(async() => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-network-icon-'));
        sourcePath = path.join(tempDir, 'source.png');
        await fs.writeFile(sourcePath, Buffer.from('89504e470d0a1a0a', 'hex'));
    });

    afterEach(async() => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('copies a selected image and resolves the saved URL', async() => {
        const result = await installNetworkIcon(tempDir, 'Test Network', sourcePath);
        const iconPath = path.join(tempDir, 'network-icons', 'test-network.png');

        expect(result.canceled).toBe(false);
        expect(result.url).toBe('kiwi-icon://network-icon/test-network.png');
        await expect(fs.readFile(iconPath)).resolves.toEqual(
            Buffer.from('89504e470d0a1a0a', 'hex')
        );

        const resolved = await resolveNetworkIconFile(tempDir, result.url);

        expect(resolved).toEqual(expect.objectContaining({
            filePath: path.join(tempDir, 'network-icons', 'test-network.png'),
            mimeType: 'image/png',
        }));
    });

    test('rejects unsupported image types and outside paths', async() => {
        const textPath = path.join(tempDir, 'icon.txt');
        await fs.writeFile(textPath, 'not an image');

        await expect(installNetworkIcon(tempDir, 'Test', textPath))
            .rejects.toThrow('Unsupported image type');

        const result = await resolveNetworkIconFile(
            tempDir,
            'kiwi-icon://network-icon/../outside.png'
        );

        expect(result).toBeNull();
    });
});
