import Vue from 'vue';
import getState from '@/libs/state';
import { def } from '@/libs/state/common';
import { fetchStationList } from './stations';
import { fetchNowPlaying, nowPlayingEnabled, POLL_MS } from './nowPlaying';

const STALL_CHECK_MS = 5000;
const STALL_MS = 15000;
const MAX_STALL_ATTEMPTS = 3;
const MAX_NETWORK_FAILS = 3;

let radio = null;

function adminVolume(state) {
    let value = state.getSetting('settings.radio.volume');
    return typeof value === 'number' ? value : 0.4;
}

export function getRadio() {
    if (!radio) {
        radio = createRadio();
    }
    return radio;
}

function createRadio() {
    let ui = Vue.observable({
        stations: [],
        error: '',
        loading: false,
        playing: false,
        muted: false,
        currentName: '',
        listOpen: false,
        volumeUnlocked: false,
        failed: {},
        waveReady: false,
        trackTitle: '',
    });

    def(ui, 'audio', null, true);
    def(ui, 'audioCtx', null, true);
    def(ui, 'analyser', null, true);
    def(ui, 'waveFrame', 0, true);
    let recovering = false;
    let trackTimer = null;
    let trackGen = 0;
    let trackNetFails = 0;
    let stallTimer = null;
    let stallGen = 0;
    let lastStreamTime = 0;
    let lastAdvanceAt = 0;
    let stallAttempts = 0;

    function enabled() {
        return !!getState().setting('radio.url');
    }

    function volume() {
        let state = getState();
        if (state.setting('radio.forceVolume') && !ui.volumeUnlocked) {
            return adminVolume(state);
        }
        let value = state.setting('radio.volume');
        return typeof value === 'number' ? value : 0.4;
    }

    function applyVolume() {
        if (!ui.audio) {
            return;
        }
        ui.audio.volume = ui.muted ? 0 : volume();
    }

    function markFailed(name) {
        Vue.set(ui.failed, name, true);
        ui.playing = false;
        stopTrackPoll();
        stopStallWatch();
        clearSession();
    }

    function ensureAudio(withWave) {
        if (ui.audio && !!ui.audio.crossOrigin !== !!withWave) {
            discardAudio();
        }
        if (ui.audio) {
            return ui.audio;
        }
        let audio = document.createElement('audio');
        audio.playsInline = true;
        audio.setAttribute('playsinline', '');
        if (withWave) {
            audio.crossOrigin = 'anonymous';
        }
        audio.setAttribute('aria-hidden', 'true');
        audio.style.position = 'fixed';
        audio.style.left = '-9999px';
        audio.style.width = '1px';
        audio.style.height = '1px';
        audio.style.opacity = '0';
        audio.addEventListener('error', () => {
            if (recovering) {
                return;
            }
            if (audio.crossOrigin) {
                recoverWithoutWave();
                return;
            }
            if (ui.currentName) {
                markFailed(ui.currentName);
            }
        });
        audio.addEventListener('pause', () => {
            ui.playing = false;
            clearSession();
        });
        document.body.appendChild(audio);
        ui.audio = audio;
        return audio;
    }

    function stopWave() {
        if (ui.waveFrame) {
            window.cancelAnimationFrame(ui.waveFrame);
            ui.waveFrame = 0;
        }
    }

    function discardAudio() {
        ui.waveReady = false;
        ui.analyser = null;
        if (ui.audioCtx && ui.audioCtx.close) {
            ui.audioCtx.close();
        }
        ui.audioCtx = null;
        if (ui.audio && ui.audio.parentNode) {
            ui.audio.parentNode.removeChild(ui.audio);
        }
        ui.audio = null;
    }

    function recoverWithoutWave() {
        if (recovering) {
            return;
        }
        recovering = true;
        let src = ui.audio && (ui.audio.currentSrc || ui.audio.src);
        let name = ui.currentName;
        discardAudio();
        if (!src) {
            recovering = false;
            return;
        }
        let audio = ensureAudio(false);
        audio.src = src;
        applyVolume();
        let started = audio.play();
        if (started && started.then) {
            started.then(() => {
                recovering = false;
                ui.playing = true;
                if (name) {
                    Vue.delete(ui.failed, name);
                }
                startTrackPoll(current());
                startStallWatch();
            }).catch(() => {
                recovering = false;
                if (name) {
                    markFailed(name);
                }
            });
        } else {
            recovering = false;
        }
    }

    function attachWave() {
        if (!getState().setting('radio.showWave') || ui.analyser || !ui.audio) {
            return;
        }
        if (!ui.audio.crossOrigin) {
            return;
        }
        let AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return;
        }
        try {
            let ctx = ui.audioCtx || new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            let source = ctx.createMediaElementSource(ui.audio);
            let analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            ui.audioCtx = ctx;
            ui.analyser = analyser;
            ui.waveReady = true;
        } catch (err) {
            ui.analyser = null;
            ui.waveReady = false;
        }
    }

    function setSession(station) {
        let session = navigator.mediaSession;
        if (!session || typeof window.MediaMetadata !== 'function') {
            return;
        }
        let artwork = (station.image && /^https?:\/\//i.test(station.image))
            ? [{ src: station.image }]
            : [];
        session.metadata = new window.MediaMetadata({
            title: ui.trackTitle || station.name,
            artist: ui.trackTitle ? station.name : '',
            artwork,
        });
        session.playbackState = 'playing';
        try {
            session.setActionHandler('play', () => {
                playCurrent();
            });
            session.setActionHandler('pause', () => {
                pause();
            });
            session.setActionHandler('previoustrack', () => {
                skip(-1);
            });
            session.setActionHandler('nexttrack', () => {
                skip(1);
            });
        } catch (err) {
            // Some browsers reject an action they do not support.
        }
    }

    function clearSession() {
        let session = navigator.mediaSession;
        if (!session) {
            return;
        }
        session.metadata = null;
        session.playbackState = 'none';
        ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((action) => {
            try {
                session.setActionHandler(action, null);
            } catch (err) {
                // Ignore unsupported media session actions.
            }
        });
    }

    function current() {
        return ui.stations.find((station) => station.name === ui.currentName) || null;
    }

    async function loadStations() {
        let url = getState().setting('radio.url');
        if (!url) {
            ui.stations = [];
            ui.error = '';
            return;
        }
        ui.loading = true;
        ui.error = '';
        try {
            let result = await fetchStationList(url);
            if (!result.error || !ui.playing) {
                ui.stations = result.stations;
                ui.error = result.error;
            }
            if (!ui.currentName) {
                ui.currentName = getState().setting('radio.active') || '';
            }
        } catch (err) {
            if (!ui.playing) {
                ui.stations = [];
                ui.error = 'radio_load_failed';
            }
        }
        ui.loading = false;
    }

    function play(station) {
        if (!station || !station.source) {
            return;
        }
        let useWave = !!getState().setting('radio.showWave');
        stopTrackPoll();
        stopStallWatch();
        stallAttempts = 0;
        let audio = ensureAudio(useWave);
        ui.currentName = station.name;
        getState().setting('radio.active', station.name);
        Vue.delete(ui.failed, station.name);
        if (audio.src !== station.source) {
            audio.src = station.source;
        }
        applyVolume();
        let started = audio.play();
        if (started && started.then) {
            started.then(() => {
                ui.playing = true;
                if (useWave) {
                    attachWave();
                }
                setSession(station);
                startTrackPoll(station);
                startStallWatch();
            }).catch(() => {
                if (useWave && audio.crossOrigin) {
                    recoverWithoutWave();
                    return;
                }
                markFailed(station.name);
            });
        }
    }

    function playCurrent() {
        let station = current();
        if (station) {
            play(station);
            return;
        }
        let name = ui.currentName || getState().setting('radio.active');
        let match = ui.stations.find((stationItem) => stationItem.name === name);
        if (match) {
            play(match);
        }
    }

    function stopTrackPoll() {
        trackGen += 1;
        trackNetFails = 0;
        if (trackTimer) {
            clearInterval(trackTimer);
            trackTimer = null;
        }
        ui.trackTitle = '';
    }

    function startTrackPoll(station) {
        stopTrackPoll();
        if (!station || !nowPlayingEnabled(station)) {
            return;
        }
        let gen = trackGen;
        let pull = () => {
            fetchNowPlaying(station).then((title) => {
                if (gen !== trackGen || !ui.playing) {
                    return;
                }
                if (title === null) {
                    stopTrackPoll();
                    return;
                }
                trackNetFails = 0;
                if (title !== ui.trackTitle) {
                    ui.trackTitle = title || '';
                    setSession(station);
                }
            }).catch(() => {
                // A single network hiccup is transient, but an endpoint
                // that blocks every poll is not, so stop after a few.
                trackNetFails += 1;
                if (trackNetFails >= MAX_NETWORK_FAILS) {
                    stopTrackPoll();
                }
            });
        };
        pull();
        trackTimer = setInterval(pull, POLL_MS);
    }

    function stopStallWatch() {
        stallGen += 1;
        if (stallTimer) {
            clearInterval(stallTimer);
            stallTimer = null;
        }
    }

    function startStallWatch() {
        stopStallWatch();
        let gen = stallGen;
        lastStreamTime = ui.audio ? ui.audio.currentTime : 0;
        lastAdvanceAt = Date.now();
        stallTimer = setInterval(() => {
            if (gen !== stallGen || !ui.playing || !ui.audio || ui.audio.paused || recovering) {
                return;
            }
            let time = ui.audio.currentTime;
            let now = Date.now();
            if (time > lastStreamTime) {
                lastStreamTime = time;
                lastAdvanceAt = now;
                stallAttempts = 0;
                return;
            }
            if (now - lastAdvanceAt >= STALL_MS) {
                reconnect();
            }
        }, STALL_CHECK_MS);
    }

    function reconnect() {
        let station = current();
        if (!station || !ui.audio) {
            return;
        }
        stallAttempts += 1;
        if (stallAttempts > MAX_STALL_ATTEMPTS) {
            markFailed(station.name);
            return;
        }
        stopStallWatch();
        let audio = ui.audio;
        audio.load();
        let restarted = audio.play();
        if (restarted && restarted.then) {
            restarted.then(() => {
                ui.playing = true;
                setSession(station);
                startStallWatch();
            }).catch(() => {
                recoverWithoutWave();
            });
        }
    }

    function pause() {
        if (ui.audio) {
            ui.audio.pause();
        }
        ui.playing = false;
        stopTrackPoll();
        stopStallWatch();
        stopWave();
        clearSession();
    }

    function toggle() {
        if (ui.playing) {
            pause();
        } else {
            playCurrent();
        }
    }

    function skip(step) {
        if (!ui.stations.length) {
            return;
        }
        let index = ui.stations.findIndex((station) => station.name === ui.currentName);
        if (index < 0) {
            index = 0;
        }
        let next = (index + step + ui.stations.length) % ui.stations.length;
        play(ui.stations[next]);
    }

    function setVolume(value) {
        let next = Math.min(1, Math.max(0, Number(value)));
        ui.volumeUnlocked = true;
        getState().setting('radio.volume', next);
        ui.muted = false;
        applyVolume();
    }

    function toggleMute() {
        ui.muted = !ui.muted;
        applyVolume();
    }

    function isStarred(name) {
        let starred = getState().setting('radio.starred') || [];
        return starred.indexOf(name) !== -1;
    }

    function toggleStar(name) {
        let starred = (getState().setting('radio.starred') || []).slice();
        let index = starred.indexOf(name);
        if (index === -1) {
            starred.push(name);
        } else {
            starred.splice(index, 1);
        }
        getState().setting('radio.starred', starred);
    }

    return {
        ui,
        enabled,
        volume,
        current,
        loadStations,
        play,
        playCurrent,
        pause,
        toggle,
        skip,
        setVolume,
        toggleMute,
        isStarred,
        toggleStar,
        stopWave,
    };
}
