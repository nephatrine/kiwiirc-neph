'kiwi public';

/** @module */

/**
 * Plays alert sounds
 */
export class AudioManager {
    constructor(audio) {
        this.lastPlayed = {};
        this.audio = audio;
    }

    /** Play the alert sound */
    play(type = 'notification') {
        const now = Date.now();
        const last = this.lastPlayed[type] || 0;

        // Only play a specific sound type once every 2 seconds
        if (now - last > 2000) {
            this.audio.play(type);
            this.lastPlayed[type] = now;
        }
    }

    listen(state) {
        state.$on('audio.bleep', () => {
            this.play('notification');
        });

        state.$on('audio.play', (type) => {
            this.play(type);
        });
    }

    /** Watch the Kiwi state for any message highlights and play an alert */
    watchForMessages(state) {
        state.$on('message.new', (event) => {
            let { message, buffer } = event;
            if (buffer.setting('mute_sound')) {
                return;
            }

            let ignoreTypes = [
                'connection',
                'traffic',
                'mode',
                'nick',
            ];
            if (ignoreTypes.indexOf(message.type) > -1) {
                return;
            }

            if (message.ignore || buffer.isSpecial()) {
                return;
            }

            if (message.type === 'error') {
                this.play('error');
                return;
            }

            let shouldBleep = buffer.getNetwork().nick !== message.nick && ((message.isHighlight && buffer.setting('alert_on') === 'highlight') || buffer.setting('alert_on') === 'message');
            let isActiveBuffer = state.getActiveBuffer() === buffer;
            let inFocus = isActiveBuffer && state.ui.app_has_focus;

            if (shouldBleep || (buffer.isQuery() && !inFocus)) {
                this.play('notification');
            }
        });
    }
}
