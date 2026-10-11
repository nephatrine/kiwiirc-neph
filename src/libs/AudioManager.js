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

        state.$on('audio.play', (type, network) => {
            if (type === 'startup' && network) {
                const serverBuffer = network.serverBuffer();
                if (serverBuffer && serverBuffer.setting('mute_sound')) {
                    return;
                }
            }
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

            if (message.ignore || buffer.isSpecial() || !message.is_new) {
                return;
            }

            if (message.type === 'error') {
                this.play('error');
                return;
            }

            const network = buffer.getNetwork();
            const isSelf = network && network.nick === message.nick;
            if (isSelf) {
                return;
            }

            const isActiveBuffer = state.getActiveBuffer() === buffer;
            const inFocus = isActiveBuffer && state.ui.app_has_focus;

            if (inFocus) {
                return;
            }

            const alertOn = buffer.setting('alert_on');
            if (message.isHighlight && (alertOn === 'highlight' || alertOn === 'message')) {
                this.play('notification');
            } else if (alertOn === 'message' || buffer.isQuery()) {
                this.play('message');
            }
        });
    }
}
