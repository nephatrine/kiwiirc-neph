const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
    buildLinuxAutostartEntry,
    createAutoLaunchService,
    escapeDesktopExec,
    linuxAutostartPath,
} = require('../../desktop/electron/auto-launch');

describe('auto-launch', () => {
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
