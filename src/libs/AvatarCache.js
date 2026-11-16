'kiwi public';

import Vue from 'vue';
import { scheduleImageLoad } from '@/libs/ImageLoadQueue';

const FAILURE_TTL_MS = 10 * 60 * 1000;
const LOAD_TIMEOUT_MS = 15 * 1000;

const states = Vue.observable({});
const pending = new Map();

function stateEntry(url) {
    let entry = states[url];
    if (!entry) {
        entry = Vue.observable({ status: 'idle', failedAt: 0 });
        Vue.set(states, url, entry);
    }
    return entry;
}

export function avatarLoadState(url) {
    if (!url) {
        return 'none';
    }

    const entry = stateEntry(url);
    if (entry.status === 'failed' &&
        Date.now() - entry.failedAt >= FAILURE_TTL_MS
    ) {
        return 'idle';
    }

    return entry.status;
}

export function requestAvatarLoad(url) {
    if (!url || avatarLoadState(url) !== 'idle') {
        return;
    }

    const entry = stateEntry(url);
    const token = {};
    entry.status = 'loading';
    entry.failedAt = 0;

    const handle = scheduleImageLoad(() => {
        let settled = false;
        let timer = null;

        const finish = (success) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            const current = pending.get(url);
            if (!current || current.token !== token) {
                return;
            }

            pending.delete(url);
            entry.status = success ? 'loaded' : 'failed';
            entry.failedAt = success ? 0 : Date.now();
            handle.release();
        };

        timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

        try {
            const image = new Image();
            image.onload = () => finish(true);
            image.onerror = () => finish(false);
            image.src = url;
        } catch {
            finish(false);
        }
    });

    pending.set(url, { handle, token });
}

export function markAvatarFailed(url) {
    if (!url) {
        return;
    }

    const current = pending.get(url);
    if (current) {
        current.handle.cancel();
        pending.delete(url);
    }

    const entry = stateEntry(url);
    entry.status = 'failed';
    entry.failedAt = Date.now();
}

export function clearAvatarCache() {
    pending.forEach((entry) => entry.handle.cancel());
    pending.clear();
    Object.keys(states).forEach((url) => {
        const entry = states[url];
        entry.status = 'idle';
        entry.failedAt = 0;
        Vue.delete(states, url);
    });
}
