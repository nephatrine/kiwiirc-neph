const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 1024 * 1024;

function formatValue(value) {
    if (value instanceof Error) {
        return value.stack || value.message || String(value);
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch (err) {
        return String(value);
    }
}

function createMainLog({ logDir, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    if (typeof logDir !== 'string' || !logDir) {
        throw new Error('invalid log directory');
    }

    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
    const filePath = path.join(logDir, 'main.log');
    const backupPath = `${filePath}.1`;

    function rotateIfNeeded() {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size < maxBytes) {
                return;
            }
            fs.rmSync(backupPath, { force: true });
            fs.renameSync(filePath, backupPath);
        } catch (err) {
            // Logging must never break the app.
        }
    }

    function write(level, ...args) {
        rotateIfNeeded();
        const line = [
            new Date().toISOString(),
            `[${level}]`,
            ...args.map(formatValue),
        ].join(' ') + '\n';
        try {
            fs.appendFileSync(filePath, line, { encoding: 'utf8', mode: 0o600 });
        } catch (err) {
            // Logging must never break the app.
        }
    }

    return {
        path: () => filePath,
        info: (...args) => write('INFO', ...args),
        warn: (...args) => write('WARN', ...args),
        error: (...args) => write('ERROR', ...args),
    };
}

module.exports = {
    DEFAULT_MAX_BYTES,
    createMainLog,
    formatValue,
};
