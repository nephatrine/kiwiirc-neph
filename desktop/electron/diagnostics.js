const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_LAG_INTERVAL_MS = 250;
const DEFAULT_LAG_WARN_MS = 1000;
const MAX_LAG_SAMPLES = 20;
const MAX_EVENTS = 50;
const MAX_SNAPSHOTS = 20;
const SNAPSHOT_PREFIX = 'freeze-';

function safeCall(target, method, fallback = null) {
    try {
        if (!target || typeof target[method] !== 'function') {
            return fallback;
        }
        return target[method]();
    } catch (err) {
        return fallback;
    }
}

function safeBoolean(target, property) {
    try {
        return target && typeof target[property] === 'boolean' ?
            target[property] :
            null;
    } catch (err) {
        return null;
    }
}

function shortString(value, limit = 60) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.length > limit ? value.slice(0, limit) : value;
}

/**
 * Low-risk freeze diagnostics for the Electron shell.
 *
 * Captures main-loop stalls, renderer hang events, renderer heartbeats, and
 * renderer-reported events. Snapshots contain timings and process metrics only,
 * never message text, nicknames, or credentials.
 */
function createDiagnostics({
    app = null,
    userDataDir = '',
    log = {},
    now = () => Date.now(),
    lagIntervalMs = DEFAULT_LAG_INTERVAL_MS,
    lagWarnMs = DEFAULT_LAG_WARN_MS,
} = {}) {
    const logInfo = typeof log.info === 'function' ? log.info : () => {};
    const logWarn = typeof log.warn === 'function' ? log.warn : () => {};

    const windows = new Map();
    const hangs = new Map();
    const lagSamples = [];
    let events = [];
    let timer = null;
    let lastTick = 0;
    let maxLagMs = 0;
    let snapshotSeq = 0;
    let started = false;

    function processMetrics() {
        if (!app || typeof app.getAppMetrics !== 'function') {
            return [];
        }
        try {
            return app.getAppMetrics().map((metric) => ({
                pid: metric.pid,
                type: metric.type,
                cpuPercent: metric.cpu ? metric.cpu.percentCPUUsage : 0,
                memory: metric.memory ? { ...metric.memory } : null,
            }));
        } catch (err) {
            return [];
        }
    }

    function windowInfo(entry) {
        const at = now();
        const wc = entry.win.webContents;
        const hangStarted = hangs.get(entry.id);
        return {
            id: entry.id,
            url: safeCall(wc, 'getURL', '') || '',
            title: safeCall(wc, 'getTitle', '') || '',
            visible: safeCall(entry.win, 'isVisible', null),
            focused: safeCall(entry.win, 'isFocused', null),
            phase: entry.phase || 'unknown',
            lastBeatAgoMs: entry.lastBeatAt ? at - entry.lastBeatAt : null,
            hangForMs: hangStarted ? at - hangStarted : 0,
        };
    }

    function snapshotPayload(reason) {
        return {
            at: new Date(now()).toISOString(),
            reason: reason || 'manual',
            app: {
                version: safeCall(app, 'getVersion', '') || '',
                packaged: safeBoolean(app, 'isPackaged'),
                platform: process.platform,
                electron: process.versions.electron,
                chrome: process.versions.chrome,
            },
            mainLoop: {
                maxLagMs,
                recentLagMs: lagSamples.slice(),
            },
            processes: processMetrics(),
            windows: Array.from(windows.values()).map(windowInfo),
            events: events.slice(),
        };
    }

    async function pruneSnapshots(dir) {
        try {
            const files = (await fs.readdir(dir))
                .filter((name) => name.startsWith(SNAPSHOT_PREFIX))
                .sort();
            const excess = files.length - MAX_SNAPSHOTS;
            await Promise.all(files.slice(0, Math.max(0, excess)).map(
                (name) => fs.rm(path.join(dir, name), { force: true })
            ));
        } catch (err) {
            // Pruning is best-effort.
        }
    }

    async function snapshotNow(reason = 'manual') {
        if (!userDataDir) {
            return null;
        }

        snapshotSeq += 1;
        const at = now();
        const stamp = new Date(at).toISOString().replace(/[:.]/g, '-');
        const fileName = `${SNAPSHOT_PREFIX}${stamp}-${snapshotSeq}.json`;
        const dir = path.join(userDataDir, 'diagnostics');

        try {
            await fs.mkdir(dir, { recursive: true, mode: 0o700 });
            const filePath = path.join(dir, fileName);
            await fs.writeFile(
                filePath,
                JSON.stringify(snapshotPayload(reason), null, 2),
                { mode: 0o600 }
            );
            await pruneSnapshots(dir);
            logWarn('Wrote diagnostics snapshot', {
                reason,
                file: fileName,
                maxLagMs,
            });
            return filePath;
        } catch (err) {
            logWarn('Failed to write diagnostics snapshot', {
                reason,
                error: err && err.message ? err.message : String(err),
            });
            return null;
        }
    }

    function recordEvent(senderId, payload) {
        const entry = windows.get(senderId);
        const data = payload && typeof payload === 'object' ? payload : {};
        const type = shortString(data.type) || 'event';
        const event = {
            at: now(),
            type,
            phase: shortString(data.phase) || (entry ? entry.phase : 'unknown'),
        };
        if (Number.isFinite(data.durationMs)) {
            event.durationMs = Math.max(0, Math.round(data.durationMs));
        }
        if (data.channel) {
            event.channel = shortString(data.channel);
        }

        events.push(event);
        if (events.length > MAX_EVENTS) {
            events = events.slice(events.length - MAX_EVENTS);
        }

        if (entry && type === 'phase') {
            entry.phase = event.phase;
        }
        if (type === 'longtask' && event.durationMs >= 250) {
            logWarn('Renderer long task', {
                windowId: senderId,
                phase: event.phase,
                durationMs: event.durationMs,
            });
        }
        if (type === 'sync-ipc' && event.durationMs >= 50) {
            logWarn('Slow synchronous IPC', {
                windowId: senderId,
                channel: event.channel,
                durationMs: event.durationMs,
            });
        }
    }

    function recordBeat(senderId, payload) {
        const entry = windows.get(senderId);
        if (!entry) {
            return;
        }
        entry.lastBeatAt = now();
        if (payload && typeof payload.phase === 'string') {
            entry.phase = shortString(payload.phase);
        }
    }

    function checkLag() {
        const at = now();
        if (!lastTick) {
            lastTick = at;
            return 0;
        }

        const lagMs = Math.max(0, at - lastTick - lagIntervalMs);
        lastTick = at;
        lagSamples.push(lagMs);
        if (lagSamples.length > MAX_LAG_SAMPLES) {
            lagSamples.shift();
        }
        if (lagMs > maxLagMs) {
            maxLagMs = lagMs;
        }
        if (lagMs >= lagWarnMs) {
            logWarn('Main process event loop blocked', {
                lagMs,
                windowCount: windows.size,
            });
            snapshotNow('event-loop-lag');
        }
        return lagMs;
    }

    function attachWindow(win) {
        if (!win || !win.webContents) {
            return () => {};
        }

        const wc = win.webContents;
        const id = wc.id;
        const entry = {
            id,
            win,
            phase: 'start',
            lastBeatAt: 0,
        };
        windows.set(id, entry);

        const onUnresponsive = () => {
            hangs.set(id, now());
            logWarn('Window became unresponsive', {
                windowId: id,
                phase: entry.phase,
                url: safeCall(wc, 'getURL', '') || '',
            });
            snapshotNow('unresponsive');
        };
        const onResponsive = () => {
            const startedAt = hangs.get(id);
            hangs.delete(id);
            logInfo('Window responsive again', {
                windowId: id,
                durationMs: startedAt ? now() - startedAt : null,
            });
        };
        const onDestroyed = () => {
            windows.delete(id);
            hangs.delete(id);
        };

        wc.on('unresponsive', onUnresponsive);
        wc.on('responsive', onResponsive);
        wc.on('destroyed', onDestroyed);
        win.on('closed', onDestroyed);

        return () => {
            wc.removeListener('unresponsive', onUnresponsive);
            wc.removeListener('responsive', onResponsive);
            wc.removeListener('destroyed', onDestroyed);
            win.removeListener('closed', onDestroyed);
            windows.delete(id);
            hangs.delete(id);
        };
    }

    function start() {
        if (started) {
            return;
        }
        started = true;
        lastTick = now();
        timer = setInterval(checkLag, lagIntervalMs);
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        started = false;
    }

    function status() {
        return {
            started,
            maxLagMs,
            recentLagMs: lagSamples.slice(),
            windows: Array.from(windows.values()).map(windowInfo),
        };
    }

    return {
        attachWindow,
        checkLag,
        recordBeat,
        recordEvent,
        snapshotNow,
        start,
        status,
        stop,
    };
}

module.exports = {
    createDiagnostics,
    DEFAULT_LAG_INTERVAL_MS,
    DEFAULT_LAG_WARN_MS,
};
