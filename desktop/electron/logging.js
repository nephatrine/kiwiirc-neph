const LOG_MODES = {
    QUIET: 'quiet',
    CONSOLE: 'console',
    FILE: 'file',
};

function hasSwitch(commandLine, name) {
    try {
        return typeof commandLine.hasSwitch === 'function' ?
            commandLine.hasSwitch(name) :
            false;
    } catch (err) {
        return false;
    }
}

function switchValue(commandLine, name) {
    try {
        return typeof commandLine.getSwitchValue === 'function' ?
            commandLine.getSwitchValue(name) :
            '';
    } catch (err) {
        return '';
    }
}

function describeLogging(app) {
    const commandLine = app && app.commandLine ? app.commandLine : {};
    const enabled = hasSwitch(commandLine, 'enable-logging');
    const enableValue = switchValue(commandLine, 'enable-logging');

    let mode = LOG_MODES.QUIET;
    if (enabled) {
        mode = enableValue === 'file' ? LOG_MODES.FILE : LOG_MODES.CONSOLE;
    }

    return {
        mode,
        level: switchValue(commandLine, 'log-level') || 'default',
        file: switchValue(commandLine, 'log-file') || '',
        verbose: switchValue(commandLine, 'v') || '',
    };
}

/**
 * Apply Chromium logging switches without overriding an explicit user choice.
 *
 * - `--enable-logging` (console) is preserved as-is.
 * - `--log-level` and `--log-file` are only filled in when absent.
 * - Quiet defaults (`log-level=3`, `v=0`) apply only when the user asked for
 *   neither logging nor a level.
 * - `isDiagnostics` prefers file logging, but a user-provided console switch
 *   wins.
 */
function configureLogging({
    app,
    isDev = false,
    isVerbose = false,
    isDiagnostics = false,
    logFile = '',
} = {}) {
    const commandLine = app && app.commandLine ? app.commandLine : null;
    if (!commandLine) {
        return describeLogging(app);
    }

    function append(name, value) {
        try {
            commandLine.appendSwitch(name, value);
        } catch (err) {
            // Logging configuration must never break startup.
        }
    }

    const explicitEnable = hasSwitch(commandLine, 'enable-logging');
    const explicitLevel = hasSwitch(commandLine, 'log-level');
    const explicitFile = hasSwitch(commandLine, 'log-file');

    if (isDiagnostics) {
        if (!explicitEnable) {
            append('enable-logging', 'file');
        }
        if (!explicitLevel) {
            append('log-level', '0');
        }
        if (!explicitFile && !explicitEnable && logFile) {
            append('log-file', logFile);
        }
    } else if (!isDev && !isVerbose && !explicitEnable && !explicitLevel) {
        append('log-level', '3');
        append('v', '0');
    }

    return describeLogging(app);
}

module.exports = {
    LOG_MODES,
    configureLogging,
    describeLogging,
};
