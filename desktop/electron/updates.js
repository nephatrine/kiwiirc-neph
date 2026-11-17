const DEFAULT_API_URL = 'https://code.nephatrine.net/api/v1/repos/nephatrine/kiwiirc/releases/latest';
const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_STARTUP_DELAY_MS = 30000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_VERSION_LENGTH = 64;
const MAX_NAME_LENGTH = 256;
const MAX_URL_LENGTH = 2048;

function noop() {
    return undefined;
}

function cleanString(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

function bodyText(body) {
    if (Buffer.isBuffer(body)) {
        return body.toString('utf8');
    }
    if (body instanceof Uint8Array) {
        return Buffer.from(body).toString('utf8');
    }
    return String(body || '');
}

function parseVersion(value) {
    const text = cleanString(value, MAX_VERSION_LENGTH).replace(/^v/i, '');
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text);
    if (!match) {
        return null;
    }

    const base = `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] || '',
        text: match[4] ? `${base}-${match[4]}` : base,
    };
}

function comparePrerelease(left, right) {
    const leftParts = left.split('.');
    const rightParts = right.split('.');
    const length = Math.max(leftParts.length, rightParts.length);

    for (let i = 0; i < length; i += 1) {
        if (leftParts[i] === undefined) {
            return -1;
        }
        if (rightParts[i] === undefined) {
            return 1;
        }

        const leftNumeric = /^\d+$/.test(leftParts[i]);
        const rightNumeric = /^\d+$/.test(rightParts[i]);
        if (leftNumeric && rightNumeric) {
            const leftNumber = Number(leftParts[i]);
            const rightNumber = Number(rightParts[i]);
            if (leftNumber !== rightNumber) {
                return leftNumber < rightNumber ? -1 : 1;
            }
        } else if (leftNumeric !== rightNumeric) {
            return leftNumeric ? -1 : 1;
        } else if (leftParts[i] !== rightParts[i]) {
            return leftParts[i] < rightParts[i] ? -1 : 1;
        }
    }

    return 0;
}

function compareVersions(left, right) {
    const leftVersion = parseVersion(left);
    const rightVersion = parseVersion(right);
    if (!leftVersion || !rightVersion) {
        throw new Error('invalid version');
    }

    const keys = ['major', 'minor', 'patch'];
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (leftVersion[key] !== rightVersion[key]) {
            return leftVersion[key] < rightVersion[key] ? -1 : 1;
        }
    }

    if (leftVersion.prerelease === rightVersion.prerelease) {
        return 0;
    }
    if (!leftVersion.prerelease) {
        return 1;
    }
    if (!rightVersion.prerelease) {
        return -1;
    }
    return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

function isNewerVersion(latest, current) {
    return compareVersions(latest, current) > 0;
}

function safeReleaseUrl(value) {
    const text = cleanString(value, MAX_URL_LENGTH);
    if (!text) {
        return '';
    }

    try {
        const url = new URL(text);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        return url.href;
    } catch (err) {
        return '';
    }
}

function normalizeRelease(data) {
    if (!data || typeof data !== 'object' || data.draft) {
        return null;
    }

    const version = parseVersion(data.tag_name);
    const releaseUrl = safeReleaseUrl(data.html_url);
    if (!version || !releaseUrl) {
        return null;
    }

    return {
        latestVersion: version.text,
        releaseUrl,
        releaseName: cleanString(data.name, MAX_NAME_LENGTH) || `v${version.text}`,
        publishedAt: cleanString(data.published_at, 64),
    };
}

function normalizeIntervalHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) {
        return DEFAULT_INTERVAL_HOURS;
    }
    return Math.max(1, Math.min(24 * 7, Math.round(hours)));
}

function createUpdateService({
    appVersion,
    apiUrl = DEFAULT_API_URL,
    intervalHours = DEFAULT_INTERVAL_HOURS,
    startupDelayMs = DEFAULT_STARTUP_DELAY_MS,
    request,
    getAutoCheck = () => true,
    getLastNotified = () => '',
    setLastNotified = () => Promise.resolve(),
    onResult = noop,
    notify = null,
    log = {},
    now = () => Date.now(),
}) {
    if (typeof request !== 'function') {
        throw new Error('update request function is required');
    }

    const currentVersion = parseVersion(appVersion);
    if (!currentVersion) {
        throw new Error('invalid app version');
    }

    const logger = {
        info: typeof log.info === 'function' ? log.info : noop,
        warn: typeof log.warn === 'function' ? log.warn : noop,
        error: typeof log.error === 'function' ? log.error : noop,
    };

    let currentApiUrl = cleanString(apiUrl, MAX_URL_LENGTH) || DEFAULT_API_URL;
    let currentIntervalHours = normalizeIntervalHours(intervalHours);
    let started = false;
    let startupTimer = null;
    let intervalTimer = null;
    let cached = null;
    let cachedAt = 0;
    let inFlight = null;

    function intervalMs() {
        return currentIntervalHours * 60 * 60 * 1000;
    }

    async function fetchLatest() {
        const response = await request({
            url: currentApiUrl,
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            timeoutMs: REQUEST_TIMEOUT_MS,
            maxResponseBytes: MAX_RESPONSE_BYTES,
            acceptContentTypes: ['application/json'],
        });

        const statusCode = response ? Number(response.status) : 0;
        if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 300) {
            const err = new Error(`update check failed (${statusCode || 'no response'})`);
            err.statusCode = statusCode;
            throw err;
        }

        let data;
        try {
            data = JSON.parse(bodyText(response.body));
        } catch (err) {
            throw new Error('invalid update response');
        }

        const release = normalizeRelease(data);
        if (!release) {
            throw new Error('invalid update release');
        }
        return release;
    }

    async function performCheck() {
        const release = await fetchLatest();
        const checkedAt = now();
        const result = {
            currentVersion: currentVersion.text,
            latestVersion: release.latestVersion,
            updateAvailable: isNewerVersion(release.latestVersion, currentVersion.text),
            releaseUrl: release.releaseUrl,
            releaseName: release.releaseName,
            publishedAt: release.publishedAt,
            checkedAt: new Date(checkedAt).toISOString(),
        };

        cached = result;
        cachedAt = checkedAt;
        return result;
    }

    async function check({ manual = false } = {}) {
        if (!manual && cached && now() - cachedAt < intervalMs()) {
            return cached;
        }
        if (inFlight) {
            return inFlight;
        }

        inFlight = performCheck();
        let result;
        try {
            result = await inFlight;
        } finally {
            inFlight = null;
        }

        try {
            onResult(result);
        } catch (err) {
            logger.warn('Update result handler failed', err);
        }

        if (result.updateAvailable && !manual) {
            const lastNotified = getLastNotified();
            if (lastNotified !== result.latestVersion) {
                try {
                    await setLastNotified(result.latestVersion);
                } catch (err) {
                    logger.warn('Failed to save update notification state', err);
                }

                if (typeof notify === 'function') {
                    try {
                        notify(result);
                    } catch (err) {
                        logger.warn('Failed to show update notification', err);
                    }
                }
            }
        }

        return result;
    }

    function clearTimers() {
        if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = null;
        }
        if (intervalTimer) {
            clearInterval(intervalTimer);
            intervalTimer = null;
        }
    }

    function runAutomaticCheck() {
        if (!getAutoCheck()) {
            return;
        }
        check({ manual: false }).catch((err) => {
            logger.warn('Automatic update check failed', err);
        });
    }

    function schedule() {
        clearTimers();
        if (!started || !getAutoCheck()) {
            return;
        }

        startupTimer = setTimeout(() => {
            startupTimer = null;
            runAutomaticCheck();
        }, startupDelayMs);
        intervalTimer = setInterval(runAutomaticCheck, intervalMs());
    }

    function start() {
        if (started) {
            schedule();
            return;
        }
        started = true;
        schedule();
    }

    function stop() {
        started = false;
        clearTimers();
    }

    function setAutoCheck(enabled) {
        if (enabled) {
            if (started) {
                schedule();
            } else {
                start();
            }
            return;
        }
        clearTimers();
    }

    function setConfig(next = {}) {
        const config = next && typeof next === 'object' ? next : {};
        let changed = false;

        if (typeof config.apiUrl === 'string' && config.apiUrl.trim()) {
            const nextApiUrl = config.apiUrl.trim();
            if (nextApiUrl !== currentApiUrl) {
                currentApiUrl = nextApiUrl;
                changed = true;
            }
        }

        const nextIntervalHours = normalizeIntervalHours(config.checkIntervalHours);
        if (nextIntervalHours !== currentIntervalHours) {
            currentIntervalHours = nextIntervalHours;
            changed = true;
        }

        if (changed) {
            cached = null;
            cachedAt = 0;
        }
        if (started) {
            schedule();
        }
    }

    function status() {
        return cached;
    }

    return {
        check,
        start,
        stop,
        setAutoCheck,
        setConfig,
        status,
    };
}

module.exports = {
    DEFAULT_API_URL,
    DEFAULT_INTERVAL_HOURS,
    compareVersions,
    createUpdateService,
    isNewerVersion,
    normalizeRelease,
    parseVersion,
};
