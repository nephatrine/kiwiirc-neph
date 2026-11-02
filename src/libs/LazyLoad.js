'kiwi public';

/* global require */

/**
 * Load the full emoji metadata chunk.
 *
 * `require.ensure` is used instead of `import()` because Babel emits CommonJS
 * for the rest of the application, and the exports-loader depends on CommonJS
 * `exports` being available.
 *
 * @returns {Promise<Object>}
 */
export function loadEmojiData() {
    return new Promise((resolve, reject) => {
        require.ensure([], () => {
            try {
                // eslint-disable-next-line n/global-require
                resolve(require('@/res/emojiData').emojiData);
            } catch (err) {
                reject(err);
            }
        }, reject, 'emoji-data');
    });
}

let limnoriaCommandsPromise = null;
let limnoriaCommandsModule = null;

/**
 * Get the full Limnoria command table after it has been loaded.
 *
 * @returns {Object|null}
 */
export function getLimnoriaCommands() {
    return limnoriaCommandsModule;
}

/**
 * Load the full Limnoria command table chunk.
 *
 * @returns {Promise<Object>}
 */
export function loadLimnoriaCommands() {
    if (limnoriaCommandsPromise) {
        return limnoriaCommandsPromise;
    }

    limnoriaCommandsPromise = new Promise((resolve, reject) => {
        require.ensure([], () => {
            try {
                // eslint-disable-next-line n/global-require
                limnoriaCommandsModule = require('@/libs/LimnoriaCommands');
                resolve(limnoriaCommandsModule);
            } catch (err) {
                limnoriaCommandsPromise = null;
                reject(err);
            }
        }, (err) => {
            limnoriaCommandsPromise = null;
            reject(err);
        }, 'limnoria-commands');
    });

    return limnoriaCommandsPromise;
}
