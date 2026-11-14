const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 256;
const MAX_BODY_LENGTH = 2048;
const MAX_TAG_LENGTH = 256;
const DEFAULT_TTL_MS = 10000;
const MAX_TTL_MS = 60000;

function cleanString(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

function normalizeNotificationPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }

    const id = cleanString(payload.id, MAX_ID_LENGTH);
    const title = cleanString(payload.title, MAX_TITLE_LENGTH);
    const body = cleanString(payload.body, MAX_BODY_LENGTH);
    if (!id || !title || !body) {
        return null;
    }

    const tag = cleanString(payload.tag, MAX_TAG_LENGTH);
    let ttl = DEFAULT_TTL_MS;
    if (Number.isFinite(payload.ttl)) {
        ttl = Math.max(0, Math.min(MAX_TTL_MS, Math.trunc(payload.ttl)));
    }

    return {
        id,
        title,
        body,
        tag,
        ttl,
    };
}

function createNotificationService({
    Notification,
    getWindow,
    onActivate,
    onClose,
}) {
    const active = new Map();
    const tags = new Map();
    const timers = new Map();

    function isSupported() {
        return !!Notification &&
            typeof Notification.isSupported === 'function' &&
            Notification.isSupported();
    }

    function clearTimer(id) {
        const timer = timers.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.delete(id);
        }
    }

    function remove(id, reason) {
        const entry = active.get(id);
        if (!entry) {
            return false;
        }

        active.delete(id);
        clearTimer(id);
        if (entry.tag && tags.get(entry.tag) === id) {
            tags.delete(entry.tag);
        }

        if (typeof onClose === 'function') {
            onClose(id, reason);
        }

        return true;
    }

    function close(id, reason = 'manual') {
        const entry = active.get(id);
        if (!entry) {
            return false;
        }

        remove(id, reason);
        try {
            entry.notification.close();
        } catch (err) {
            // The OS may already have closed the notification.
        }

        return true;
    }

    function closeTag(tag) {
        if (!tag) {
            return;
        }

        const id = tags.get(tag);
        if (id) {
            close(id, 'replaced');
        }
    }

    function focusWindow() {
        const window = typeof getWindow === 'function' ? getWindow() : null;
        if (!window || window.isDestroyed()) {
            return;
        }

        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
        window.focus();
    }

    function show(payload) {
        if (!isSupported()) {
            return { shown: false, reason: 'unsupported' };
        }

        const normalized = normalizeNotificationPayload(payload);
        if (!normalized) {
            return { shown: false, reason: 'invalid' };
        }

        if (active.has(normalized.id)) {
            close(normalized.id, 'replaced');
        }
        closeTag(normalized.tag);

        let notification = null;
        try {
            notification = new Notification({
                title: normalized.title,
                body: normalized.body,
            });
        } catch (err) {
            return { shown: false, reason: 'failed' };
        }

        active.set(normalized.id, {
            notification,
            tag: normalized.tag,
        });
        if (normalized.tag) {
            tags.set(normalized.tag, normalized.id);
        }

        notification.on('click', () => {
            focusWindow();
            if (typeof onActivate === 'function') {
                onActivate(normalized.id);
            }
            remove(normalized.id, 'click');
            try {
                notification.close();
            } catch (err) {
                // The notification may already be closing.
            }
        });
        notification.on('close', () => {
            remove(normalized.id, 'close');
        });
        notification.on('failed', () => {
            remove(normalized.id, 'failed');
        });

        try {
            notification.show();
        } catch (err) {
            remove(normalized.id, 'failed');
            return { shown: false, reason: 'failed' };
        }

        if (normalized.ttl > 0) {
            timers.set(normalized.id, setTimeout(() => {
                close(normalized.id, 'ttl');
            }, normalized.ttl));
        }

        return {
            shown: true,
            id: normalized.id,
        };
    }

    function closeAll() {
        Array.from(active.keys()).forEach((id) => {
            close(id, 'shutdown');
        });
    }

    return {
        isSupported,
        show,
        close,
        closeAll,
    };
}

module.exports = {
    createNotificationService,
    normalizeNotificationPayload,
};
