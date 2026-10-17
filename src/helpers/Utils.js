'kiwi public';

/** @module */

/**
 * A small set of collection, string and object helpers that replace the lodash
 * utilities this project used. Everything here is plain modern JavaScript so
 * that the lodash dependency is no longer needed.
 */

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
};

const RE_UNESCAPED_HTML = /[&<>"']/;
const RE_HTML_CHARS = /[&<>"']/g;
const RE_REGEXP_CHARS = /[\\^$.*+?()[\]{}|]/g;
const RE_NUMERIC_KEY = /^\d+$/;

/**
 * Read a nested value using a dotted string or an array path.
 * @param {Object} obj The object to read from
 * @param {String|Array} path The path to read
 * @returns {*} The value at the path, or undefined
 */
export function getPath(obj, path) {
    if (obj === null || typeof obj === 'undefined') {
        return undefined;
    }

    let parts = Array.isArray(path) ? path : String(path).split('.');
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
        if (current === null || typeof current === 'undefined') {
            return undefined;
        }
        current = current[parts[i]];
    }

    return current;
}

/**
 * Write a nested value using a dotted string or an array path. Missing
 * intermediate objects are created, using arrays for numeric keys.
 * @param {Object} obj The object to write to
 * @param {String|Array} path The path to write
 * @param {*} value The value to set
 * @returns {Object} The original object
 */
export function setPath(obj, path, value) {
    let parts = Array.isArray(path) ? path : String(path).split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        let key = parts[i];
        let existing = current[key];
        if (existing === null || typeof existing !== 'object') {
            current[key] = RE_NUMERIC_KEY.test(parts[i + 1]) ? [] : {};
        }
        current = current[key];
    }

    current[parts[parts.length - 1]] = value;
    return obj;
}

/**
 * Build a iteratee function from a shorthand. This mirrors the lodash shorthands
 * we relied upon: a function, a property name, a [path, value] pair, or a
 * partial object match.
 * @param {Function|String|Array|Object} [shorthand] The shorthand to resolve
 * @returns {Function} A function taking a value and returning the resolved value
 */
export function iteratee(shorthand) {
    if (shorthand === null || typeof shorthand === 'undefined') {
        return (value) => value;
    }

    if (typeof shorthand === 'function') {
        return shorthand;
    }

    if (typeof shorthand === 'string') {
        return (value) => getPath(value, shorthand);
    }

    if (Array.isArray(shorthand)) {
        let path = shorthand[0];
        let matchValue = shorthand[1];
        return (value) => getPath(value, path) === matchValue;
    }

    // Partial object match
    let keys = Object.keys(shorthand);
    return (value) => {
        if (value === null || typeof value === 'undefined') {
            return false;
        }
        return keys.every((key) => getPath(value, key) === shorthand[key]);
    };
}

/**
 * Is the collection array-like (has a numeric length)?
 * @param {*} collection
 * @returns {Boolean}
 */
function isArrayLike(collection) {
    return Array.isArray(collection) || typeof collection.length === 'number';
}

/**
 * Iterate over an array or object. Returning false from the callback stops the
 * iteration.
 * @param {Array|Object} collection The collection to iterate
 * @param {Function} fn Called with (value, key, collection)
 * @returns {Array|Object} The original collection
 */
export function each(collection, fn) {
    if (collection === null || typeof collection === 'undefined') {
        return collection;
    }

    if (isArrayLike(collection)) {
        for (let i = 0; i < collection.length; i++) {
            if (fn(collection[i], i, collection) === false) {
                break;
            }
        }
    } else {
        let keys = Object.keys(collection);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (fn(collection[key], key, collection) === false) {
                break;
            }
        }
    }

    return collection;
}

/**
 * Find the first value in an array or object that matches the shorthand.
 * @param {Array|Object} collection The collection to search
 * @param {Function|String|Array|Object} shorthand The predicate
 * @returns {*} The matching value, or undefined
 */
export function find(collection, shorthand) {
    if (collection === null || typeof collection === 'undefined') {
        return undefined;
    }

    let predicate = iteratee(shorthand);
    let result;
    let found = false;

    each(collection, (value, key, coll) => {
        if (predicate(value, key, coll)) {
            result = value;
            found = true;
            return false;
        }
        return undefined;
    });

    return found ? result : undefined;
}

/**
 * Find the index of the first value in an array that matches the shorthand.
 * @param {Array} array The array to search
 * @param {Function|String|Array|Object} shorthand The predicate
 * @returns {Number} The index, or -1
 */
export function findIndex(array, shorthand) {
    if (array === null || typeof array === 'undefined') {
        return -1;
    }

    let predicate = iteratee(shorthand);
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }

    return -1;
}

/**
 * Filter an array or object, returning an array of matching values.
 * @param {Array|Object} collection The collection to filter
 * @param {Function|String|Array|Object} shorthand The predicate
 * @returns {Array} The matching values
 */
export function filter(collection, shorthand) {
    let result = [];
    if (collection === null || typeof collection === 'undefined') {
        return result;
    }

    let predicate = iteratee(shorthand);
    each(collection, (value, key, coll) => {
        if (predicate(value, key, coll)) {
            result.push(value);
        }
    });

    return result;
}

/**
 * Is the value a plain object (created by {} or new Object)?
 * @param {*} value The value to check
 * @returns {Boolean}
 */
export function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    if (Object.prototype.toString.call(value) !== '[object Object]') {
        return false;
    }

    let proto = Object.getPrototypeOf(value);
    if (proto === null) {
        return true;
    }

    let ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
    return typeof ctor === 'function' && ctor === Object;
}

/**
 * Escape a string for safe insertion into HTML. Matches lodash's escape.
 * @param {*} str The value to escape
 * @returns {String} The escaped string
 */
export function escapeHtml(str) {
    if (str === null || typeof str === 'undefined') {
        return '';
    }

    let value = String(str);
    if (!RE_UNESCAPED_HTML.test(value)) {
        return value;
    }

    return value.replace(RE_HTML_CHARS, (char) => HTML_ESCAPES[char]);
}

/**
 * Escape the regular expression characters in a string. Matches lodash's
 * escapeRegExp.
 * @param {*} str The value to escape
 * @returns {String} The escaped string
 */
export function escapeRegExp(str) {
    if (str === null || typeof str === 'undefined') {
        return '';
    }

    return String(str).replace(RE_REGEXP_CHARS, '\\$&');
}

/**
 * Trim characters from both ends of a string. Matches lodash's trim: without
 * `chars` it trims whitespace, otherwise it trims any of the given characters.
 * @param {*} str The string to trim
 * @param {String} [chars] The characters to trim off the ends
 * @returns {String} The trimmed string
 */
export function trim(str, chars) {
    if (str === null || typeof str === 'undefined') {
        return '';
    }

    let value = String(str);
    if (chars === null || typeof chars === 'undefined' || chars === '') {
        return value.trim();
    }

    let set = String(chars).replace(RE_REGEXP_CHARS, '\\$&');
    return value.replace(new RegExp('^[' + set + ']+|[' + set + ']+$', 'g'), '');
}

/**
 * Deep clone a value. Arrays, dates and plain objects are cloned recursively;
 * everything else is returned as-is.
 * @param {*} value The value to clone
 * @returns {*} The cloned value
 */
export function deepClone(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item));
    }

    let result = Object.create(Object.getPrototypeOf(value));
    Object.keys(value).forEach((key) => {
        result[key] = deepClone(value[key]);
    });
    return result;
}

/**
 * Turn an array, array-like or object into a plain array of values.
 * @param {Array|Object} collection
 * @returns {Array}
 */
function toArray(collection) {
    if (collection === null || typeof collection === 'undefined') {
        return [];
    }
    if (Array.isArray(collection)) {
        return collection.slice();
    }
    if (typeof collection.length === 'number') {
        return Array.prototype.slice.call(collection);
    }
    return Object.values(collection);
}

/**
 * Ascending comparison used by sortBy/orderBy. Undefined values sort last.
 * @param {*} a
 * @param {*} b
 * @returns {Number}
 */
function compareAscending(a, b) {
    if (a === b) {
        return 0;
    }
    if (typeof a === 'undefined') {
        return 1;
    }
    if (typeof b === 'undefined') {
        return -1;
    }
    return a < b ? -1 : 1;
}

/**
 * Resolve a list of iteratees (or a single one) to functions.
 * @param {Array|*} iteratees
 * @returns {Array} The iteratee functions
 */
function resolveIteratees(iteratees) {
    let list = Array.isArray(iteratees) ? iteratees : [iteratees];
    if (list.length === 0) {
        return [iteratee(undefined)];
    }
    return list.map((item) => iteratee(item));
}

/**
 * Stable ascending sort of a collection by the given iteratee(s).
 * @param {Array|Object} collection The collection to sort
 * @param {Function|String|Array|Object|Array} iteratees One or more iteratees
 * @returns {Array} A new, sorted array
 */
export function sortBy(collection, iteratees) {
    let funcs = resolveIteratees(iteratees);

    return toArray(collection)
        .map((value, index) => ({ value, index }))
        .sort((a, b) => {
            for (let i = 0; i < funcs.length; i++) {
                let result = compareAscending(funcs[i](a.value), funcs[i](b.value));
                if (result) {
                    return result;
                }
            }
            return a.index - b.index;
        })
        .map((entry) => entry.value);
}

/**
 * Stable sort of a collection by the given iteratee(s) and orders.
 * @param {Array|Object} collection The collection to sort
 * @param {Function|String|Array|Object|Array} iteratees One or more iteratees
 * @param {Array|String} [orders] 'asc' or 'desc' for each iteratee
 * @returns {Array} A new, sorted array
 */
export function orderBy(collection, iteratees, orders) {
    let funcs = resolveIteratees(iteratees);
    let directions;
    if (orders === null || typeof orders === 'undefined') {
        directions = [];
    } else if (Array.isArray(orders)) {
        directions = orders;
    } else {
        directions = [orders];
    }

    return toArray(collection)
        .map((value, index) => ({ value, index }))
        .sort((a, b) => {
            for (let i = 0; i < funcs.length; i++) {
                let result = compareAscending(funcs[i](a.value), funcs[i](b.value));
                if (result) {
                    return String(directions[i]).toLowerCase() === 'desc' ? -result : result;
                }
            }
            return a.index - b.index;
        })
        .map((entry) => entry.value);
}
