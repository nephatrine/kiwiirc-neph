'kiwi public';

/* global require */

let json5Promise = null;
let json5Module = null;

/**
 * Get the JSON5 parser after the chunk has been loaded.
 *
 * @returns {Object|null}
 */
export function getJson5() {
    return json5Module;
}

/**
 * Load the JSON5 parser chunk.
 *
 * @returns {Promise<Object>}
 */
export function loadJson5() {
    if (json5Promise) {
        return json5Promise;
    }

    json5Promise = new Promise((resolve, reject) => {
        require.ensure(['json5'], () => {
            try {
                // eslint-disable-next-line n/global-require
                json5Module = require('json5');
                resolve(json5Module);
            } catch (err) {
                json5Promise = null;
                reject(err);
            }
        }, (err) => {
            json5Promise = null;
            reject(err);
        }, 'json5');
    });

    return json5Promise;
}
