const os = require('node:os');
const path = require('node:path');
const {
    atomicWriteFile,
    readTextFile,
    removeFile,
} = require('./file-utils');

const AUTOSTART_FILENAME = 'kiwiirc-desktop.desktop';

function escapeDesktopExec(value) {
    const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/%/g, '%%');
    return `"${escaped}"`;
}

function linuxAutostartPath(env = process.env, home = os.homedir()) {
    const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
    return path.join(configHome, 'autostart', AUTOSTART_FILENAME);
}

function buildLinuxAutostartEntry(execPath, args = ['--hidden']) {
    const command = [escapeDesktopExec(execPath), ...args].join(' ');
    return [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Kiwi IRC',
        'Comment=Kiwi IRC',
        `Exec=${command}`,
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        '',
    ].join('\n');
}

function createAutoLaunchService({
    app,
    platform,
    execPath,
    env = process.env,
    home = os.homedir(),
    isPackaged,
}) {
    const supported = !!isPackaged &&
        ['darwin', 'linux', 'win32'].includes(platform);

    function commandPath() {
        if (platform === 'linux' && env.APPIMAGE) {
            return env.APPIMAGE;
        }
        return execPath;
    }

    function autostartPath() {
        return linuxAutostartPath(env, home);
    }

    async function isEnabled() {
        if (!supported) {
            return false;
        }

        if (platform === 'linux') {
            const text = await readTextFile(autostartPath());
            if (text === null) {
                return false;
            }
            const expected = `Exec=${escapeDesktopExec(commandPath())} --hidden`;
            return text.split('\n').includes(expected);
        }

        if (platform === 'darwin') {
            return !!app.getLoginItemSettings().openAtLogin;
        }

        return !!app.getLoginItemSettings({
            path: commandPath(),
            args: ['--hidden'],
        }).openAtLogin;
    }

    async function setEnabled(enabled) {
        if (!supported) {
            return false;
        }

        if (platform === 'linux') {
            if (enabled) {
                await atomicWriteFile(
                    autostartPath(),
                    buildLinuxAutostartEntry(commandPath()),
                    0o644
                );
            } else {
                await removeFile(autostartPath());
            }
            return !!enabled;
        }

        if (platform === 'darwin') {
            app.setLoginItemSettings({
                openAtLogin: !!enabled,
                openAsHidden: !!enabled,
            });
        } else {
            app.setLoginItemSettings({
                openAtLogin: !!enabled,
                path: commandPath(),
                args: ['--hidden'],
            });
        }

        return !!enabled;
    }

    async function apply(enabled) {
        if (!supported) {
            return false;
        }
        await setEnabled(!!enabled);
        return !!enabled;
    }

    return {
        isSupported: () => supported,
        isEnabled,
        setEnabled,
        apply,
        autostartPath,
    };
}

module.exports = {
    AUTOSTART_FILENAME,
    buildLinuxAutostartEntry,
    createAutoLaunchService,
    escapeDesktopExec,
    linuxAutostartPath,
};
