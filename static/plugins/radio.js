kiwi.plugin('radio', (kiwi, log) => {
    'use strict';

    let SETTING_PREFIX = 'plugin-radio.';
    let DEFAULTS = {
        url: 'static/plugins/radio/stations.json',
        volume: 0.4,
        starred: [],
        active: '',
        showWave: true,
        autoPlay: false,
        forceVolume: false,
        reloadOnOpen: false,
        forceShowClose: false,
    };
    let POLL_MS = 30000;
    let STALL_CHECK_MS = 5000;
    let STALL_MS = 15000;
    let MAX_STALL_ATTEMPTS = 3;
    let MAX_NETWORK_FAILS = 3;
    let radio = null;

    let Misc = kiwi.require('helpers/Misc');
    let TextFormatting = kiwi.require('helpers/TextFormatting');
    let Utils = kiwi.require('helpers/Utils');

    kiwi.setConfigDefaults('plugin-radio', DEFAULTS);

    function setting(name, fallback) {
        try {
            let value = kiwi.state.setting(SETTING_PREFIX + name);
            return typeof value === 'undefined' ? fallback : value;
        } catch (err) {
            return fallback;
        }
    }

    function setSetting(name, value) {
        try {
            kiwi.state.setting(SETTING_PREFIX + name, value);
        } catch (err) {
            log.error('Unable to save radio setting', err);
        }
    }

    function def(object, key, value) {
        Object.defineProperty(object, key, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: value,
        });
    }

    function pageProtocol(pageHref) {
        try {
            return new URL(pageHref || window.location.href).protocol;
        } catch (err) {
            return 'http:';
        }
    }

    function acceptStreamUrl(url, pageHref) {
        let clean = Misc.sanitizeUrl(typeof url === 'string' ? url : '');
        if (!clean || !/^https?:\/\//i.test(clean)) {
            return '';
        }
        if (pageProtocol(pageHref) === 'https:' && /^http:/i.test(clean)) {
            return '';
        }
        return clean;
    }

    function acceptImageUrl(url) {
        let clean = Misc.sanitizeUrl(typeof url === 'string' ? url : '');
        if (!clean) {
            return '';
        }
        if (/^https?:\/\//i.test(clean) || clean.charAt(0) === '/') {
            return clean;
        }
        return '';
    }

    function prepareStations(list, pageHref) {
        if (!Array.isArray(list)) {
            return [];
        }

        let stations = [];
        list.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            let source = acceptStreamUrl(item.source, pageHref);
            if (!source) {
                return;
            }
            stations.push({
                name: typeof item.name === 'string' && item.name
                    ? item.name
                    : source,
                image: acceptImageUrl(item.image),
                source: source,
                description: typeof item.description === 'string'
                    ? item.description
                    : '',
                channels: typeof item.channels === 'string' ? item.channels : '',
                nowPlaying: item.nowPlaying === false
                    ? false
                    : acceptStreamUrl(item.nowPlaying, pageHref),
            });
        });
        return stations;
    }

    async function fetchStationList(url, options) {
        let opts = options || {};
        if (!url) {
            return { stations: [], error: '', missing: false };
        }

        let doFetch = opts.fetch || fetch;
        let response = await doFetch(url, { credentials: 'omit' });
        if (!response.ok) {
            if (response.status === 404 || response.status === 410) {
                return { stations: [], error: '', missing: true };
            }
            return { stations: [], error: 'load_failed', missing: false };
        }

        let text = await response.text();
        let parsed = kiwi.JSON5 ? kiwi.JSON5.parse(text) : JSON.parse(text);
        return {
            stations: prepareStations(parsed, opts.pageHref),
            error: '',
            missing: false,
        };
    }

    function statusUrlFor(streamUrl) {
        try {
            let url = new URL(streamUrl);
            url.pathname = '/status-json.xsl';
            url.search = '';
            url.hash = '';
            return url.toString();
        } catch (err) {
            return '';
        }
    }

    function fileName(value) {
        if (!value || typeof value !== 'string') {
            return '';
        }
        try {
            return new URL(value).pathname.split('/').filter(Boolean).pop() || '';
        } catch (err) {
            let parts = value.split('/');
            return parts[parts.length - 1].split('?')[0] || '';
        }
    }

    function cleanTitle(value) {
        if (typeof value !== 'string') {
            return '';
        }
        let title = value.trim();
        if (!title || title === '-') {
            return '';
        }
        return title;
    }

    function sourcesFrom(json) {
        let source = json && json.icestats && json.icestats.source;
        if (!source) {
            return [];
        }
        return Array.isArray(source) ? source : [source];
    }

    function siblingMp3(name) {
        if (/\.ogg$/i.test(name)) {
            return name.replace(/\.ogg$/i, '.mp3');
        }
        if (/^ogg/i.test(name)) {
            return name.replace(/^ogg/i, 'mp3');
        }
        return '';
    }

    function titleFromStatus(json, streamUrl) {
        let want = fileName(streamUrl).toLowerCase();
        if (!want) {
            return '';
        }
        let sources = sourcesFrom(json);
        let exact = sources.find((source) => fileName(source.listenurl).toLowerCase() === want);
        let title = cleanTitle(exact && exact.title);
        let mp3Name = siblingMp3(want);
        if (!mp3Name) {
            return title || '';
        }
        let mp3 = sources.find((source) => fileName(source.listenurl).toLowerCase() === mp3Name);
        return cleanTitle(mp3 && mp3.title) || title || '';
    }

    function nowPlayingEnabled(station) {
        return !station || station.nowPlaying !== false;
    }

    function nowPlayingUrl(station) {
        if (!station || station.nowPlaying === false) {
            return '';
        }
        if (station.nowPlaying) {
            return station.nowPlaying;
        }
        return statusUrlFor(station.source);
    }

    async function fetchNowPlaying(station, fetchImpl) {
        let url = nowPlayingUrl(station);
        if (!url) {
            return '';
        }
        let doFetch = fetchImpl || fetch;
        let response = await doFetch(url, { credentials: 'omit' });
        if (!response.ok) {
            return null;
        }
        let json = await response.json();
        if (json && json.icestats) {
            return titleFromStatus(json, station.source);
        }
        return cleanTitle(json && json.title);
    }

    function adminVolume() {
        let value = kiwi.state.getSetting('settings.plugin-radio.volume');
        return typeof value === 'number' ? value : 0.4;
    }

    function getRadio() {
        if (!radio) {
            radio = createRadio();
        }
        return radio;
    }

    function createRadio() {
        let ui = kiwi.Vue.observable({
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
            missing: false,
        });

        def(ui, 'audio', null);
        def(ui, 'audioCtx', null);
        def(ui, 'analyser', null);
        def(ui, 'waveFrame', 0);

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
            return !!setting('url', '') && !ui.missing;
        }

        function volume() {
            if (setting('forceVolume', false) && !ui.volumeUnlocked) {
                return adminVolume();
            }
            let value = setting('volume', 0.4);
            return typeof value === 'number' ? value : 0.4;
        }

        function applyVolume() {
            if (!ui.audio) {
                return;
            }
            ui.audio.volume = ui.muted ? 0 : volume();
        }

        function setPlaying(playing) {
            ui.playing = playing;
            kiwi.setMediaPlaying('radio', playing, {
                station: ui.currentName,
                title: ui.trackTitle,
                display: [ui.currentName, ui.trackTitle].filter(Boolean).join(' — '),
            });
        }

        function markFailed(name) {
            kiwi.Vue.set(ui.failed, name, true);
            setPlaying(false);
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
                setPlaying(false);
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
                    setPlaying(true);
                    if (name) {
                        kiwi.Vue.delete(ui.failed, name);
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
            if (!setting('showWave', true) || ui.analyser || !ui.audio) {
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
                artwork: artwork,
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
            let url = setting('url', '');
            if (!url) {
                ui.stations = [];
                ui.error = '';
                ui.missing = false;
                return;
            }
            ui.loading = true;
            ui.error = '';
            ui.missing = false;
            try {
                let result = await fetchStationList(url);
                if (!result.error && !result.missing) {
                    ui.stations = result.stations;
                    ui.error = '';
                    ui.missing = false;
                } else if (!ui.playing) {
                    ui.stations = result.stations;
                    ui.error = result.error;
                    ui.missing = !!result.missing;
                }
                if (!ui.currentName) {
                    ui.currentName = setting('active', '') || '';
                }
            } catch (err) {
                if (!ui.playing) {
                    ui.stations = [];
                    ui.error = 'load_failed';
                    ui.missing = false;
                }
            }
            ui.loading = false;
        }

        function play(station) {
            if (!station || !station.source) {
                return;
            }
            let useWave = !!setting('showWave', true);
            stopTrackPoll();
            stopStallWatch();
            stallAttempts = 0;
            let audio = ensureAudio(useWave);
            ui.currentName = station.name;
            setSetting('active', station.name);
            kiwi.Vue.delete(ui.failed, station.name);
            if (audio.src !== station.source) {
                audio.src = station.source;
            }
            applyVolume();
            let started = audio.play();
            if (started && started.then) {
                started.then(() => {
                    setPlaying(true);
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
            let name = ui.currentName || setting('active', '');
            let match = ui.stations.find((item) => item.name === name);
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
            let pull = function() {
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
                        setPlaying(true);
                    }
                }).catch(() => {
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
                if (gen !== stallGen || !ui.playing || !ui.audio ||
                    ui.audio.paused || recovering) {
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
                    setPlaying(true);
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
            setPlaying(false);
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
            setSetting('volume', next);
            ui.muted = false;
            applyVolume();
        }

        function toggleMute() {
            ui.muted = !ui.muted;
            applyVolume();
        }

        function isStarred(name) {
            let starred = setting('starred', []);
            return starred.indexOf(name) !== -1;
        }

        function toggleStar(name) {
            let starred = (setting('starred', []) || []).slice();
            let index = starred.indexOf(name);
            if (index === -1) {
                starred.push(name);
            } else {
                starred.splice(index, 1);
            }
            setSetting('starred', starred);
        }

        return {
            ui: ui,
            enabled: enabled,
            setting: setting,
            volume: volume,
            current: current,
            loadStations: loadStations,
            play: play,
            playCurrent: playCurrent,
            pause: pause,
            toggle: toggle,
            skip: skip,
            setVolume: setVolume,
            toggleMute: toggleMute,
            isStarred: isStarred,
            toggleStar: toggleStar,
            stopWave: stopWave,
        };
    }

    function openBrowser() {
        let radioInstance = getRadio();
        if (!radioInstance.enabled()) {
            return false;
        }
        radioInstance.ui.listOpen = true;
        if (radioInstance.setting('reloadOnOpen', false)) {
            radioInstance.loadStations();
        } else if (!radioInstance.ui.stations.length) {
            radioInstance.loadStations();
        }
        kiwi.state.$emit('active.component', RadioBrowser);
        kiwi.state.$emit('statebrowser.hide');
        return true;
    }

    const RadioBrowser = kiwi.Vue.extend({
        template: '#kiwi-radio-browser',
        data: function() {
            return {
                radio: getRadio(),
            };
        },
        computed: {
            ordered: function() {
                return this.radio.ui.stations.slice().sort((a, b) => {
                    let aStar = this.radio.isStarred(a.name) ? 0 : 1;
                    let bStar = this.radio.isStarred(b.name) ? 0 : 1;
                    if (aStar !== bStar) {
                        return aStar - bStar;
                    }
                    return a.name.localeCompare(b.name);
                });
            },
        },
        mounted: function() {
            this.radio.ui.listOpen = true;
        },
        beforeDestroy: function() {
            this.radio.ui.listOpen = false;
        },
        methods: {
            details: function(station) {
                let text = [station.description, station.channels]
                    .filter(Boolean)
                    .join(' ');
                return TextFormatting.linkifyChannels(Utils.escapeHtml(text));
            },
            close: function(reopen) {
                this.radio.ui.listOpen = false;
                this.$state.$emit('active.component', null);
                if (reopen) {
                    this.$state.$emit('statebrowser.show');
                }
            },
            onDetailsClick: function(event) {
                if (!event.target.closest('a[data-channel-name]')) {
                    return;
                }
                event.stopPropagation();
                this.openChannel(event);
            },
            openChannel: function(event) {
                let el = event.target.closest('a[data-channel-name]');
                if (!el) {
                    return;
                }
                event.preventDefault();
                let networks = this.$state.networks || [];
                let network = null;
                networks.forEach((item) => {
                    if (!network && item.state === 'connected' && item.ircClient) {
                        network = item;
                    }
                });
                if (!network || !network.ircClient) {
                    return;
                }
                let name = el.getAttribute('data-channel-name');
                if (!name) {
                    return;
                }
                this.$state.addBuffer(network.id, name);
                let buffer = this.$state.getBufferByName(network.id, name);
                if (buffer && !buffer.joined) {
                    network.ircClient.join(name);
                }
                this.$state.setActiveBuffer(network.id, name);
                if (this.$state.ui.app_width <= 550) {
                    this.close();
                }
            },
        },
    });

    let RadioControls = kiwi.Vue.extend({
        template: '#kiwi-radio-controls',
        data: function() {
            return {
                radio: getRadio(),
                waveFrame: 0,
                nameScroll: 0,
                nameObserver: null,
                trackScroll: 0,
                trackObserver: null,
            };
        },
        computed: {
            available: function() {
                return this.radio.ui.stations.length > 0 || this.radio.ui.playing;
            },
            showWave: function() {
                return this.radio.setting('showWave', true) &&
                    this.radio.ui.playing &&
                    this.radio.ui.waveReady;
            },
            nameScrollStyle: function() {
                if (!this.nameScroll) {
                    return null;
                }
                let travel = Math.max(3, this.nameScroll / 28);
                return {
                    '--kiwi-radio-scroll': this.nameScroll + 'px',
                    'animation-duration': (travel + 3) + 's',
                };
            },
            trackScrollStyle: function() {
                if (!this.trackScroll) {
                    return null;
                }
                let travel = Math.max(3, this.trackScroll / 28);
                return {
                    '--kiwi-radio-scroll': this.trackScroll + 'px',
                    'animation-duration': (travel + 3) + 's',
                };
            },
        },
        watch: {
            'available': function(show) {
                if (show) {
                    this.$nextTick(() => {
                        this.observeName();
                        this.measureName();
                    });
                }
            },
            'radio.ui.currentName': function() {
                this.measureName();
            },
            'radio.ui.trackTitle': function() {
                this.$nextTick(() => {
                    if (!this.radio.ui.trackTitle) {
                        this.trackScroll = 0;
                        this.disconnectTrackObserver();
                        return;
                    }
                    this.observeTrack();
                    this.measureTrack();
                });
            },
            'showWave': {
                immediate: true,
                handler: function(show) {
                    this.stopWave();
                    if (show) {
                        this.drawWave();
                    }
                },
            },
        },
        created: function() {
            if (!this.radio.enabled()) {
                return;
            }
            this.radio.loadStations();
            if (this.radio.setting('autoPlay', false)) {
                this.$state.$once('document.clicked', () => {
                    this.radio.playCurrent();
                });
            }
        },
        beforeDestroy: function() {
            this.stopWave();
            if (this.nameObserver) {
                this.nameObserver.disconnect();
                this.nameObserver = null;
            }
            this.disconnectTrackObserver();
        },
        methods: {
            observeName: function() {
                let track = this.$refs.nameTrack;
                if (!track || this.nameObserver || !window.ResizeObserver) {
                    return;
                }
                this.nameObserver = new ResizeObserver(() => {
                    this.measureName();
                });
                this.nameObserver.observe(track);
            },
            measureName: function() {
                this.$nextTick(() => {
                    let track = this.$refs.nameTrack;
                    let text = this.$refs.nameText;
                    if (!track || !text) {
                        this.nameScroll = 0;
                        return;
                    }
                    let overflow = text.scrollWidth - track.clientWidth;
                    this.nameScroll = overflow > 2 ? overflow : 0;
                });
            },
            observeTrack: function() {
                let track = this.$refs.trackTrack;
                if (!track || !window.ResizeObserver) {
                    return;
                }
                this.disconnectTrackObserver();
                this.trackObserver = new ResizeObserver(() => {
                    this.measureTrack();
                });
                this.trackObserver.observe(track);
            },
            measureTrack: function() {
                this.$nextTick(() => {
                    let track = this.$refs.trackTrack;
                    let text = this.$refs.trackText;
                    if (!track || !text) {
                        this.trackScroll = 0;
                        return;
                    }
                    let overflow = text.scrollWidth - track.clientWidth;
                    this.trackScroll = overflow > 2 ? overflow : 0;
                });
            },
            disconnectTrackObserver: function() {
                if (this.trackObserver) {
                    this.trackObserver.disconnect();
                    this.trackObserver = null;
                }
            },
            openList: function() {
                if (this.radio.ui.listOpen) {
                    this.radio.ui.listOpen = false;
                    this.$state.$emit('active.component', null);
                    this.$state.$emit('statebrowser.show');
                    return;
                }
                openBrowser();
            },
            onVolume: function(event) {
                this.radio.setVolume(event.target.value);
            },
            stopWave: function() {
                if (this.waveFrame) {
                    window.cancelAnimationFrame(this.waveFrame);
                    this.waveFrame = 0;
                }
            },
            drawWave: function() {
                this.stopWave();
                let canvas = this.$refs.wave;
                let analyser = this.radio.ui.analyser;
                if (!canvas || !analyser || !this.showWave) {
                    if (this.showWave) {
                        this.waveFrame = window.requestAnimationFrame(() => {
                            this.drawWave();
                        });
                    }
                    return;
                }
                let ctx = canvas.getContext('2d');
                let data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let styles = window.getComputedStyle(canvas);
                let top = styles.getPropertyValue('--brand-primary-hover').trim() || '#5ec9a6';
                let bottom = styles.getPropertyValue('--brand-primary').trim() || '#2f896b';
                let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, top);
                gradient.addColorStop(1, bottom);
                ctx.fillStyle = gradient;
                let bar = canvas.width / data.length;
                data.forEach((value, index) => {
                    let height = (value / 255) * canvas.height;
                    ctx.fillRect(index * bar, canvas.height - height, bar - 1, height);
                });
                this.waveFrame = window.requestAnimationFrame(() => {
                    this.drawWave();
                });
            },
        },
    });

    kiwi.addTranslations('radio', {
        'en-us': {
            play: 'Play',
            pause: 'Pause',
            prev: 'Previous station',
            next: 'Next station',
            stations: 'Radio Stations',
            mute: 'Mute',
            unmute: 'Unmute',
            star: 'Star station',
            unstar: 'Unstar station',
            volume: 'Volume',
            close: 'Close',
            loading: 'Loading stations…',
            load_failed: 'Unable to load stations.',
            none: 'No stations available.',
            error: 'Unable to play this station.',
        },
    });

    kiwi.addUi('browser', RadioControls);
    kiwi.registerService('radio', {
        enabled: function() {
            return getRadio().enabled();
        },
        getRadio: getRadio,
        openBrowser: openBrowser,
    });
});
