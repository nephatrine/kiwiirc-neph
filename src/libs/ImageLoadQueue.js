'kiwi public';

const MAX_ACTIVE = 4;
const START_INTERVAL = 100;

const loadedImages = new Set();
const queue = [];
let active = 0;
let timer = null;

function pump() {
    if (timer || active >= MAX_ACTIVE || queue.length === 0) {
        return;
    }

    timer = setTimeout(() => {
        timer = null;
        const task = queue.shift();
        if (!task) {
            pump();
            return;
        }
        if (task.cancelled) {
            pump();
            return;
        }

        task.started = true;
        active += 1;
        task.start();
        pump();
    }, START_INTERVAL);
}

/**
 * Queue an image start so bursts of picker images do not hit remote servers at once.
 * The caller must call release() when the image loads or fails.
 * @param {Function} start
 * @returns {{release: Function, cancel: Function}}
 */
export function scheduleImageLoad(start) {
    const task = {
        start,
        started: false,
        released: false,
        cancelled: false,
    };

    queue.push(task);
    pump();

    return {
        release() {
            if (!task.started || task.released) {
                return;
            }
            task.released = true;
            active = Math.max(0, active - 1);
            pump();
        },
        cancel() {
            if (task.cancelled) {
                return;
            }
            task.cancelled = true;

            const idx = queue.indexOf(task);
            if (idx !== -1) {
                queue.splice(idx, 1);
            }

            if (task.started && !task.released) {
                task.released = true;
                active = Math.max(0, active - 1);
                pump();
            }
        },
    };
}

export function markImageLoaded(url) {
    if (url) {
        loadedImages.add(url);
    }
}

export function isImageLoaded(url) {
    return loadedImages.has(url);
}
