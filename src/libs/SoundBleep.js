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

        if (type === 'error') {
            this.playError();
        } else {
            this.playNotification();
        }
    }

    scheduleNote(freq, duration, startAt, gainVal) {
        const t0 = this.ctx.currentTime + startAt;
        const noteEnd = t0 + duration;

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, t0);

        gainNode.gain.setValueAtTime(0, t0);
        gainNode.gain.linearRampToValueAtTime(gainVal, t0 + this.env.attack);
        gainNode.gain.linearRampToValueAtTime(
            gainVal * this.env.sustain,
            t0 + this.env.attack + this.env.decay
        );
        gainNode.gain.setValueAtTime(gainVal * this.env.sustain, noteEnd);
        gainNode.gain.linearRampToValueAtTime(0, noteEnd + this.env.release);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start(t0);
        oscillator.stop(noteEnd + this.env.release + 0.01);
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
}
