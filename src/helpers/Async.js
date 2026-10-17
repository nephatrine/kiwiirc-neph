'kiwi public';

/** @module */

/**
 * Timing helpers that replace the lodash debounce/throttle utilities we used.
 */

/**
 * Debounce a function: defer invoking it until `wait` milliseconds have passed
 * without another call. The final call's arguments and `this` are used.
 * @param {Function} fn The function to debounce
 * @param {Number} wait The number of milliseconds to wait
 * @returns {Function} The debounced function, with a cancel() method
 */
export function debounce(fn, wait) {
    let timer = null;
    let lastArgs = null;
    let lastThis = null;

    function invoke() {
        let args = lastArgs;
        let context = lastThis;
        timer = null;
        lastArgs = null;
        lastThis = null;
        fn.apply(context, args);
    }

    function debounced(...args) {
        lastArgs = args;
        lastThis = this;
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(invoke, wait);
    }

    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = null;
        lastArgs = null;
        lastThis = null;
    };

    return debounced;
}

/**
 * Throttle a function: invoke it at most once per `wait` milliseconds, on the
 * leading edge and again on the trailing edge if it is called during the wait.
 * @param {Function} fn The function to throttle
 * @param {Number} wait The number of milliseconds to wait between calls
 * @returns {Function} The throttled function, with a cancel() method
 */
export function throttle(fn, wait) {
    let timer = null;
    let lastCall = 0;
    let lastArgs = null;
    let lastThis = null;

    function invoke() {
        let args = lastArgs;
        let context = lastThis;
        lastCall = Date.now();
        timer = null;
        lastArgs = null;
        lastThis = null;
        fn.apply(context, args);
    }

    function throttled(...args) {
        let now = Date.now();
        let remaining = wait - (now - lastCall);
        lastArgs = args;
        lastThis = this;

        if (remaining <= 0 || remaining > wait) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            lastCall = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(invoke, remaining);
        }
    }

    throttled.cancel = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = null;
        lastCall = 0;
        lastArgs = null;
        lastThis = null;
    };

    return throttled;
}
