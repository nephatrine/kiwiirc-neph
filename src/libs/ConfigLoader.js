'kiwi public';

import { each } from '@/helpers/Utils';
import { loadJson5 } from './Json5Loader';
import Logger from './Logger';

let log = Logger.namespace('ConfigLoader');

function friendlyParseError(parseErr) {
    let errMsg = 'Config file error: ' + parseErr.message.replace('JSON5: ', '');
    // Convert "at 22:16" to "at line 22, position 16"
    errMsg = errMsg.replace(/at (\d+):(\d+)/g, (m, m1, m2) => (
        `line ${m1}, position ${m2}`
    ));
    return errMsg;
}

/**
 * Parse config text as strict JSON first, then fall back to JSON5.
 *
 * @param {string} body
 * @returns {Promise<Object>}
 */
export async function parseConfigText(body) {
    try {
        return JSON.parse(body);
    } catch (jsonErr) {
        let JSON5 = null;
        try {
            JSON5 = await loadJson5();
        } catch (loadErr) {
            log.error('Config ' + loadErr.message);
            const errMsg = 'Config file error: unable to load the JSON5 parser';
            throw errMsg;
        }

        try {
            return JSON5.parse(body);
        } catch (parseErr) {
            log.error('Config ' + parseErr.message);
            throw friendlyParseError(parseErr);
        }
    }
}

export default class ConfigLoader {
    constructor() {
        this.config = Object.create(null);
        this.valReplacements = Object.create(null);
    }

    addValueReplacement(key, value) {
        this.valReplacements[key] = value;
        return this;
    }

    async loadFromUrl(configUrl) {
        const response = await fetch(configUrl);
        const body = await response.text();
        const configObj = await parseConfigText(body);

        this.setConfig(configObj);
        return this.config;
    }

    loadFromObj(configObj) {
        return new Promise((resolve, reject) => {
            this.setConfig(configObj);
            resolve(this.config);
        });
    }

    setConfig(confObj) {
        let walkObject = (obj, target) => {
            each(obj, (_val, key) => {
                let val = _val;
                if (typeof val === 'string') {
                    val = this.insertReplacements(val);
                    target[key] = val;
                } else if (typeof val === 'object') {
                    target[key] = Array.isArray(val) ?
                        [] :
                        {};
                    walkObject(val, target[key]);
                } else {
                    target[key] = val;
                }
            });
        };

        this.config = Object.create(null);
        walkObject(confObj, this.config);
    }

    insertReplacements(input) {
        let out = input;
        let keys = Object.keys(this.valReplacements);
        for (let i = 0; i < keys.length; i++) {
            let k = keys[i];
            if (input === '{{' + k + '}}') {
                // If we have an exact match, return the exact replacement value we have as
                // it may not be a string
                return this.valReplacements[k];
            }

            out = out.replace('{{' + k + '}}', this.valReplacements[k]);
        }
        return out;
    }
}
