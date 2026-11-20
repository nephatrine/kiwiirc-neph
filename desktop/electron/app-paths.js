const path = require('node:path');

const APP_NAME = 'KiwiIRC';

/**
 * Chromium verbose log path for the desktop shell.
 *
 * Uses `appData` (not `userData`) so it never initialises the per-app profile
 * directory before `app.setName()` has run.
 */
function chromiumLogFile(app) {
    try {
        return path.join(app.getPath('appData'), APP_NAME, 'chrome_debug.log');
    } catch (err) {
        return '';
    }
}

module.exports = {
    APP_NAME,
    chromiumLogFile,
};
