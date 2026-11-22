const fs = require('node:fs');
const util = require('node:util');

const DEFAULT_MAX_QUEUE = 256;

/**
 * Asynchronous console writer.
 *
 * Node writes to a TTY synchronously. A Windows console in QuickEdit/selection
 * mode stops reading, so a synchronous write blocks the main thread and the
 * window stops responding. fs.write goes through the libuv threadpool: the
 * blocked write stays out of the main thread, and excess lines are dropped
 * instead of growing without bound. The file log keeps every line.
 * @param {Object} options Writer options
 * @param {Function} options.write Async write implementation
 * @param {Number} options.maxQueue Pending line limit
 * @returns {Object} Console writer
 */
function createConsoleWriter(options = {}) {
    const write = typeof options.write === 'function' ? options.write : fs.write;
    const maxQueue = Number.isFinite(options.maxQueue) && options.maxQueue > 0 ?
        Math.floor(options.maxQueue) :
        DEFAULT_MAX_QUEUE;
    const pending = [];
    let busy = false;

    function flush() {
        if (busy || pending.length === 0) {
            return;
        }

        const item = pending.shift();
        busy = true;
        try {
            write(item.fd, item.text, () => {
                busy = false;
                flush();
            });
        } catch (err) {
            busy = false;
            flush();
        }
    }

    function enqueue(fd, ...args) {
        if (typeof fd !== 'number' || fd < 0) {
            return;
        }

        if (pending.length >= maxQueue) {
            // The console is not draining. Drop the oldest line; main.log has
            // the full record.
            pending.shift();
        }

        pending.push({
            fd: fd,
            text: util.format(...args) + '\n',
        });
        flush();
    }

    return {
        write: enqueue,
    };
}

module.exports = {
    DEFAULT_MAX_QUEUE,
    createConsoleWriter,
};
