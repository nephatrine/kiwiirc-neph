'kiwi public';

import Logger from '@/libs/Logger';
import * as Misc from '@/helpers/Misc';
import * as TextFormatting from '@/helpers/TextFormatting';
import getState from '@/libs/state';

let log = Logger.namespace('GlobalErrorHandler.js');

/**
 * Report an uncaught error or promise rejection to the user.
 * This must never throw itself, or the original error would be lost.
 */
export function showUnexpectedError(err, context) {
    let message = Misc.errorMessage(err);

    try {
        log.error(`Uncaught error from ${context || 'unknown'}: ${message}`, err);
    } catch {
        // Logging must never stop us reporting the error
    }

    try {
        // The active buffer scrolls into view, so put the message there.
        // With no active buffer there is nowhere to show it.
        let buffer = getState().getActiveBuffer();
        if (!buffer) {
            return;
        }

        getState().addMessage(buffer, {
            time: Date.now(),
            nick: '*',
            message: TextFormatting.t('error_uncaught', { message: message }),
            type: 'error',
        });
    } catch {
        // Reporting must never throw
    }
}

/**
 * Catch errors that no other code handles: unhandled promise rejections on
 * the window, and Vue render/lifecycle errors.
 */
export function installGlobalErrorHandlers(vue, win) {
    let target = win || window;

    // Deliberately no preventDefault() so the browser console still shows it
    target.addEventListener('unhandledrejection', (event) => {
        showUnexpectedError(event.reason, 'promise');
    });

    if (vue && vue.config) {
        vue.config.errorHandler = (err, vm, info) => {
            showUnexpectedError(err, info || 'Vue component');
        };
    }
}
