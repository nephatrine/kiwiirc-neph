// Drop-in replacement for sockjs-client/lib/utils/event.js.
//
// sockjs-client 1.6.1 registers an `unload` listener as soon as the module
// loads. Chrome now blocks that listener behind Permissions-Policy and logs a
// violation. `pagehide` is the supported replacement for page teardown.

const random = require('sockjs-client/lib/utils/random');

const root = typeof globalThis !== 'undefined' ? globalThis : global;
const onUnload = {};
let afterUnload = false;
// Chrome packaged apps do not allow the unload event.
const isChromePackagedApp = root.chrome && root.chrome.app && root.chrome.app.runtime;

module.exports = {
    attachEvent: function(event, listener) {
        if (typeof root.addEventListener !== 'undefined') {
            root.addEventListener(event, listener, false);
        } else if (root.document && root.attachEvent) {
            // IE quirks.
            // According to: http://stevesouders.com/misc/test-postmessage.php
            // the message gets delivered only to 'document', not 'window'.
            root.document.attachEvent('on' + event, listener);
            // I get 'window' for ie8.
            root.attachEvent('on' + event, listener);
        }
    },

    detachEvent: function(event, listener) {
        if (typeof root.removeEventListener !== 'undefined') {
            root.removeEventListener(event, listener, false);
        } else if (root.document && root.detachEvent) {
            root.document.detachEvent('on' + event, listener);
            root.detachEvent('on' + event, listener);
        }
    },

    unloadAdd: function(listener) {
        if (isChromePackagedApp) {
            return null;
        }

        const ref = random.string(8);
        onUnload[ref] = listener;
        if (afterUnload) {
            setTimeout(this.triggerUnloadCallbacks, 0);
        }
        return ref;
    },

    unloadDel: function(ref) {
        if (ref in onUnload) {
            delete onUnload[ref];
        }
    },

    triggerUnloadCallbacks: function() {
        Object.keys(onUnload).forEach((ref) => {
            onUnload[ref]();
            delete onUnload[ref];
        });
    },
};

const unloadTriggered = function() {
    if (afterUnload) {
        return;
    }
    afterUnload = true;
    module.exports.triggerUnloadCallbacks();
};

if (!isChromePackagedApp) {
    module.exports.attachEvent('pagehide', unloadTriggered);
}
