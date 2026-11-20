const fsSync = require('node:fs');
const fsp = require('node:fs/promises');
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

/**
 * Queued async log writer.
 *
 * Writes are chained so ordering is preserved, but no call blocks the main
 * process on disk I/O. `flush()` resolves once everything queued so far has
 * been written; `close()` prevents further writes.
 */
function createMainLog({ logDir, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    if (typeof logDir !== 'string' || !logDir) {
        throw new Error('invalid log directory');
    }

    // Directory creation is startup-only and must be synchronous so the first
    // write cannot race it.
    fsSync.mkdirSync(logDir, { recursive: true, mode: 0o700 });
    const filePath = path.join(logDir, 'main.log');
    const backupPath = `${filePath}.1`;

    let chain = Promise.resolve();
    let closed = false;

    async function rotateIfNeeded() {
        try {
            const stats = await fsp.stat(filePath);
            if (stats.size < maxBytes) {
                return;
            }
            await fsp.rm(backupPath, { force: true });
            await fsp.rename(filePath, backupPath);
        } catch (err) {
            // Logging must never break the app.
        }
    }

    async function appendLine(line) {
        if (closed) {
            return;
        }
        await rotateIfNeeded();
        try {
            await fsp.appendFile(filePath, line, { encoding: 'utf8', mode: 0o600 });
        } catch (err) {
            // Logging must never break the app.
        }
    }

    function write(level, ...args) {
        if (closed) {
            return;
        }
        const line = [
            new Date().toISOString(),
            `[${level}]`,
            ...args.map(formatValue),
        ].join(' ') + '\n';

        chain = chain.then(() => appendLine(line)).catch(() => {});
    }

    function flush() {
        return chain;
    }

    function close() {
        closed = true;
        return chain;
    }

    return {
        path: () => filePath,
        info: (...args) => write('INFO', ...args),
        warn: (...args) => write('WARN', ...args),
        error: (...args) => write('ERROR', ...args),
        flush,
        close,
    };
}

module.exports = {
    createMainLog,
    formatValue,
    DEFAULT_MAX_BYTES,
};
