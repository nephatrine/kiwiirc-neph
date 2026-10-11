export class SoundBleep {
    constructor() {
        this.ctx = null;
        this.env = {
            attack: 0.01,
            decay: 0.05,
            sustain: 0.2,
            release: 0.15,
        };
    }

    init() {
        if (this.ctx) {
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.ctx = new AudioContext();
        }
    }

    play(type = 'notification') {
        this.init();

        if (!this.ctx) {
            return;
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        switch (type) {
        case 'error':
            this.playError();
            break;
        case 'message':
            this.playMessage();
            break;
        case 'startup':
            this.playStartup();
            break;
        default:
            this.playNotification();
        }
    }

    scheduleNote(freq, duration, startAt, gainVal, options = {}) {
        const t0 = this.ctx.currentTime + startAt;
        const noteEnd = t0 + duration;
        const env = options.env || this.env;

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = options.type || 'sine';
        oscillator.frequency.setValueAtTime(freq, t0);

        gainNode.gain.setValueAtTime(0, t0);
        gainNode.gain.linearRampToValueAtTime(gainVal, t0 + env.attack);
        gainNode.gain.linearRampToValueAtTime(
            gainVal * env.sustain,
            t0 + env.attack + env.decay
        );
        gainNode.gain.setValueAtTime(gainVal * env.sustain, noteEnd);
        gainNode.gain.linearRampToValueAtTime(0, noteEnd + env.release);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start(t0);
        oscillator.stop(noteEnd + env.release + 0.01);
    }

    playNotification() {
        // Ascending sine tones
        this.scheduleNote(660, 0.08, 0, 0.5);
        this.scheduleNote(880, 0.2, 0.07, 0.58);
    }

    playError() {
        // Descending sine tones
        this.scheduleNote(330, 0.14, 0, 0.65);
        this.scheduleNote(247, 0.2, 0.08, 0.7);
    }

    playMessage() {
        // Soft high ping (smolgroot message medium)
        const env = { attack: 0.01, decay: 0.04, sustain: 0.3, release: 0.08 };
        this.scheduleNote(1318, 0.07, 0, 0.35, { env });
        this.scheduleNote(1047, 0.15, 0.08, 0.4, { env });
    }

    playStartup() {
        // Chiptune arpeggio (smolgroot eightBit medium)
        const env = { attack: 0.003, decay: 0.015, sustain: 0.4, release: 0.015 };
        const opts = { type: 'square', env };
        this.scheduleNote(523.25, 0.04, 0, 0.35, opts);
        this.scheduleNote(659.26, 0.04, 0.06, 0.38, opts);
        this.scheduleNote(783.99, 0.04, 0.12, 0.4, opts);
        this.scheduleNote(1046.5, 0.12, 0.18, 0.45, opts);
    }
}
