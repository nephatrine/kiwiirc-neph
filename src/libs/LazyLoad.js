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

export function loadEmojiPacksSettings() {
    return new Promise((resolve, reject) => {
        require.ensure([], () => {
            try {
                // eslint-disable-next-line n/global-require
                resolve(require('@/components/EmojiPacks').default);
            } catch (err) {
                reject(err);
            }
        }, reject, 'emoji-packs-settings');
    });
}
