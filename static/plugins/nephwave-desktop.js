kiwi.plugin('nephwave-desktop', (kiwi, log) => {
    'use strict';

    let THEME_PREFIX = 'nephwave';
    let SETTING_PREFIX = 'plugin-nephwave.';
    let DEFAULT_PRESET = 'vapor';
    let DEFAULT_CRT = true;
    let DEFAULT_SOUNDS = false;
    let PRESETS = [
        { key: 'vapor', name: 'Vapour-Net' },
        { key: 'teal', name: 'Classic 98' },
        { key: 'platinum', name: 'Platinum 68K' },
        { key: 'be', name: 'BeAesthetic' },
    ];
    let BODY_CLASSES = [
        'nephwave-active',
        'nephwave-startup',
        'nephwave-statebrowser',
        'nephwave-minimized',
        'nephwave-crt-on',
        'nephwave-crt-off',
        'nephwave-sounds-on',
        'nephwave-sounds-off',
        'nephwave-glitch',
    ];

    let chromeRoot = null;
    let startMenu = null;
    let startButton = null;
    let aboutModal = null;
    let shutdownModal = null;
    let messengerTask = null;
    let radioTask = null;
    let radioMenuItem = null;
    let nowPlayingEl = null;
    let clockEl = null;
    let presetLabel = null;
    let crtMenuLabel = null;
    let soundsMenuLabel = null;
    let statusElements = [];
    let statusText = null;
    let clockTimer = null;
    let lastFocus = null;
    let lastClickSoundAt = 0;
    let lastGlitchAt = 0;
    let audioCtx = null;
    let failedTheme = '';
    let active = false;
    let minimized = false;
    let preset = DEFAULT_PRESET;
    let crt = DEFAULT_CRT;
    let sounds = DEFAULT_SOUNDS;

    function makeEl(tag, className, text) {
        let el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (typeof text === 'string') {
            el.textContent = text;
        }
        return el;
    }

    function closest(el, selector) {
        let node = el;
        while (node && node !== document) {
            if (node.nodeType === 1 && node.matches && node.matches(selector)) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function currentThemeName() {
        try {
            if (kiwi.themes && kiwi.themes.activeTheme && kiwi.themes.activeTheme.name) {
                return kiwi.themes.activeTheme.name.toLowerCase();
            }
            let selected = kiwi.state.setting('theme');
            if (typeof selected === 'string' && selected) {
                return selected.toLowerCase();
            }
        } catch (err) {
            return '';
        }
        try {
            if (kiwi.themes && typeof kiwi.themes.currentTheme === 'function') {
                let theme = kiwi.themes.currentTheme();
                return theme && theme.name ? theme.name.toLowerCase() : '';
            }
        } catch (err) {
            return '';
        }
        return '';
    }

    function isNephWave() {
        return currentThemeName().indexOf(THEME_PREFIX) === 0;
    }

    function normalizePreset(value) {
        for (let i = 0; i < PRESETS.length; i += 1) {
            if (PRESETS[i].key === value) {
                return value;
            }
        }
        return DEFAULT_PRESET;
    }

    function presetName(value) {
        for (let i = 0; i < PRESETS.length; i += 1) {
            if (PRESETS[i].key === value) {
                return PRESETS[i].name;
            }
        }
        return PRESETS[0].name;
    }

    function readSetting(name, fallback) {
        try {
            let value = kiwi.state.setting(SETTING_PREFIX + name);
            return typeof value === 'undefined' ? fallback : value;
        } catch (err) {
            return fallback;
        }
    }

    function writeSetting(name, value) {
        try {
            kiwi.state.setting(SETTING_PREFIX + name, value);
        } catch (err) {
            log.error('Unable to save NephWave setting', err);
        }
    }

    function boolSetting(value, fallback) {
        return typeof value === 'boolean' ? value : fallback;
    }

    /* ---- UI earcons: synthesized, no files, muted by default ---- */
    function initAudio() {
        try {
            if (!audioCtx) {
                let Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) {
                    return;
                }
                audioCtx = new Ctx();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        } catch (err) {
            audioCtx = null;
        }
    }

    function playClick() {
        if (!sounds) {
            return;
        }
        initAudio();
        if (!audioCtx) {
            return;
        }
        try {
            let now = audioCtx.currentTime;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(130, now + 0.035);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } catch (err) { /* ignore */ }
    }

    function playBeep(freq, length) {
        if (!sounds) {
            return;
        }
        initAudio();
        if (!audioCtx) {
            return;
        }
        try {
            let now = audioCtx.currentTime;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq || 880, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (length || 0.08));
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + (length || 0.08));
        } catch (err) { /* ignore */ }
    }

    function playPowerDown() {
        if (!sounds) {
            return;
        }
        initAudio();
        if (!audioCtx) {
            return;
        }
        try {
            let now = audioCtx.currentTime;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.38);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.42);
        } catch (err) { /* ignore */ }
    }

    /* ---- Theme preference state ---- */
    function applyPreset(value, persist) {
        preset = normalizePreset(value);
        let body = document.body;
        PRESETS.forEach((item) => {
            body.classList.remove('nephwave-preset-' + item.key);
        });
        body.classList.add('nephwave-preset-' + preset);
        if (presetLabel) {
            presetLabel.textContent = presetName(preset);
        }
        if (chromeRoot) {
            let items = chromeRoot.querySelectorAll('.nephwave-preset-item');
            for (let i = 0; i < items.length; i += 1) {
                items[i].setAttribute(
                    'aria-checked',
                    items[i].getAttribute('data-preset') === preset ? 'true' : 'false'
                );
            }
        }
        if (persist) {
            writeSetting('preset', preset);
        }
    }

    function cyclePreset() {
        let index = 0;
        for (let i = 0; i < PRESETS.length; i += 1) {
            if (PRESETS[i].key === preset) {
                index = i;
                break;
            }
        }
        applyPreset(PRESETS[(index + 1) % PRESETS.length].key, true);
    }

    function applyCrt(persist) {
        document.body.classList.toggle('nephwave-crt-on', crt);
        document.body.classList.toggle('nephwave-crt-off', !crt);
        if (crtMenuLabel) {
            crtMenuLabel.textContent = crt ? 'On' : 'Off';
        }
        if (chromeRoot) {
            let button = chromeRoot.querySelector('.nephwave-tray-btn--crt');
            if (button) {
                button.setAttribute('aria-pressed', crt ? 'true' : 'false');
                button.classList.toggle('nephwave-tray-btn--active', crt);
            }
        }
        if (persist) {
            writeSetting('crt', crt);
        }
    }

    function applySounds(persist) {
        document.body.classList.toggle('nephwave-sounds-on', sounds);
        document.body.classList.toggle('nephwave-sounds-off', !sounds);
        if (soundsMenuLabel) {
            soundsMenuLabel.textContent = sounds ? 'On' : 'Off';
        }
        if (chromeRoot) {
            let button = chromeRoot.querySelector('.nephwave-tray-btn--sounds');
            if (button) {
                let icon = button.querySelector('i');
                if (icon) {
                    icon.className = 'bx ' + (sounds ? 'bx-volume-full' : 'bx-volume-mute');
                }
                button.setAttribute('aria-pressed', sounds ? 'true' : 'false');
                button.classList.toggle('nephwave-tray-btn--active', sounds);
            }
        }
        if (persist) {
            writeSetting('sounds', sounds);
        }
    }

    function toggleCrt() {
        crt = !crt;
        applyCrt(true);
    }

    function toggleSounds() {
        sounds = !sounds;
        applySounds(true);
        if (sounds) {
            playBeep(980, 0.06);
        }
    }

    /* ---- Live chrome readouts ---- */
    function pad(value) {
        return value < 10 ? '0' + value : String(value);
    }

    function updateClock() {
        if (!clockEl) {
            return;
        }
        let now = new Date();
        let hour = now.getHours();
        let suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        clockEl.textContent = hour + ':' + pad(now.getMinutes()) + ' ' + suffix;
    }

    function updatePresence() {
        if (!document.body) {
            return;
        }
        document.body.classList.toggle(
            'nephwave-startup',
            !!document.querySelector('.kiwi-startup-common, .kiwi-personal')
        );
        document.body.classList.toggle(
            'nephwave-statebrowser',
            !!document.querySelector('.kiwi-statebrowser')
        );
    }

    function activeNetwork() {
        try {
            if (kiwi.state && typeof kiwi.state.getActiveNetwork === 'function') {
                return kiwi.state.getActiveNetwork();
            }
        } catch (err) { /* ignore */ }
        return null;
    }

    function updateStatus() {
        let mode = 'offline';
        let label = 'OFFLINE';
        let network = activeNetwork();
        if (network && network.state === 'connected') {
            mode = 'online';
            label = 'ONLINE';
        } else if (network && network.state === 'connecting') {
            mode = 'connecting';
            label = 'DIALING';
        }
        statusElements.forEach((el) => {
            el.classList.remove(
                'nephwave-status--online',
                'nephwave-status--connecting',
                'nephwave-status--offline'
            );
            el.classList.add('nephwave-status--' + mode);
            el.setAttribute('aria-label', 'Connection: ' + label);
        });
        if (statusText) {
            statusText.textContent = label;
        }
    }

    function updateNowPlaying() {
        if (!nowPlayingEl) {
            return;
        }
        let text = '';
        try {
            text = typeof kiwi.getMediaDisplay === 'function'
                ? kiwi.getMediaDisplay('radio')
                : '';
        } catch (err) {
            text = '';
        }
        nowPlayingEl.hidden = !text;
        nowPlayingEl.textContent = text;
        nowPlayingEl.setAttribute('title', text);
    }

    function radioService() {
        try {
            return typeof kiwi.getService === 'function'
                ? kiwi.getService('radio')
                : null;
        } catch (err) {
            return null;
        }
    }

    function radioEnabled() {
        let service = radioService();
        return !!(service && typeof service.enabled === 'function' && service.enabled());
    }

    function updateAvailability() {
        let available = radioEnabled();
        if (radioTask) {
            radioTask.hidden = !available;
        }
        if (radioMenuItem) {
            radioMenuItem.hidden = !available;
        }
    }

    function updateAll() {
        updateClock();
        updatePresence();
        updateAvailability();
        updateStatus();
        updateNowPlaying();
        updateTaskStates();
    }

    function startClock() {
        if (clockTimer) {
            return;
        }
        updateAll();
        clockTimer = window.setInterval(updateAll, 1000);
    }

    function stopClock() {
        if (clockTimer) {
            window.clearInterval(clockTimer);
            clockTimer = null;
        }
    }

    /* ---- Messenger minimize / restore ---- */
    function isStartupScreen() {
        return !!document.querySelector('.kiwi-startup-common, .kiwi-personal');
    }

    function isRadioPickerOpen() {
        return !!document.querySelector('.kiwi-radio-browser');
    }

    function isNarrowView() {
        if (typeof window.matchMedia === 'function') {
            return window.matchMedia('(max-width: 769px)').matches;
        }
        return window.innerWidth <= 769;
    }

    function updateTaskStates() {
        let radioOpen = isRadioPickerOpen();
        let narrow = isNarrowView();
        let messengerActive = !minimized && (narrow || !radioOpen);
        let radioActive = !minimized && !narrow && radioOpen;

        if (messengerTask) {
            messengerTask.classList.toggle('nephwave-task--active', messengerActive);
            messengerTask.setAttribute(
                'title',
                minimized ? 'Restore NephWave Messenger' : 'Focus the message input'
            );
            messengerTask.setAttribute(
                'aria-label',
                minimized ? 'Restore NephWave Messenger' : 'Focus the message input'
            );
        }
        if (radioTask) {
            radioTask.classList.toggle('nephwave-task--active', radioActive);
        }
    }

    function minimizeApp() {
        if (isStartupScreen()) {
            return;
        }
        minimized = true;
        hideStartMenu();
        hideModals();
        document.body.classList.add('nephwave-minimized');
        updateTaskStates();
        scheduleLayoutInsets();
        if (messengerTask) {
            messengerTask.focus();
        }
    }

    function restoreApp() {
        if (!minimized) {
            return;
        }
        minimized = false;
        document.body.classList.remove('nephwave-minimized');
        updateTaskStates();
        scheduleLayoutInsets();
    }

    function closeActivePanels() {
        let radioOpen = isRadioPickerOpen();
        let panelOpen = radioOpen ||
            !!document.querySelector('.kiwi-appsettings, .kiwi-networksettings');
        if (!panelOpen) {
            return;
        }
        kiwi.state.$emit('active.component', null);
        if (radioOpen && !isNarrowView()) {
            kiwi.state.$emit('statebrowser.show');
        }
    }

    function handleMessengerTask() {
        if (minimized) {
            restoreApp();
        }
        closeActivePanels();
        updateTaskStates();
        window.setTimeout(() => {
            updateTaskStates();
            focusTerminal();
        }, 0);
    }

    /* ---- Start menu and dialogs ---- */
    function setStartExpanded(expanded) {
        if (startButton) {
            startButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    function hideStartMenu() {
        if (startMenu) {
            startMenu.hidden = true;
        }
        setStartExpanded(false);
    }

    function toggleStartMenu() {
        if (!startMenu) {
            return;
        }
        startMenu.hidden = !startMenu.hidden;
        setStartExpanded(!startMenu.hidden);
        if (!startMenu.hidden) {
            let first = startMenu.querySelector('button');
            if (first) {
                first.focus();
            }
        }
    }

    function hideModals() {
        [aboutModal, shutdownModal].forEach((modal) => {
            if (modal) {
                modal.hidden = true;
            }
        });
    }

    function showModal(modal) {
        if (!modal) {
            return;
        }
        hideStartMenu();
        hideModals();
        lastFocus = document.activeElement;
        modal.hidden = false;
        let first = modal.querySelector('button');
        if (first) {
            first.focus();
        }
    }

    function closeModals() {
        hideModals();
        if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus();
        }
        lastFocus = null;
    }

    function openSettings() {
        if (minimized) {
            restoreApp();
        }
        hideStartMenu();
        hideModals();
        let AppSettings = null;
        try {
            AppSettings = kiwi.require('components/AppSettings');
        } catch (err) {
            AppSettings = null;
        }
        if (AppSettings) {
            kiwi.state.$emit('active.component', AppSettings);
        }
    }

    function openRadio() {
        if (minimized) {
            restoreApp();
        }
        hideStartMenu();
        hideModals();
        if (!radioEnabled()) {
            updateTaskStates();
            return;
        }
        if (isRadioPickerOpen()) {
            updateTaskStates();
            return;
        }
        let service = radioService();
        if (service && typeof service.openBrowser === 'function') {
            service.openBrowser();
            window.setTimeout(updateTaskStates, 0);
        }
    }

    function focusTerminal() {
        if (minimized) {
            restoreApp();
        }
        hideStartMenu();
        let input = document.querySelector(
            '.kiwi-controlinput input, .kiwi-controlinput textarea'
        );
        if (input) {
            input.focus();
        }
    }

    function switchTheme() {
        hideStartMenu();
        hideModals();
        playPowerDown();
        let themes = [];
        try {
            themes = kiwi.themes.availableThemes() || [];
        } catch (err) {
            themes = [];
        }
        let target = null;
        for (let i = 0; i < themes.length; i += 1) {
            if (themes[i].name.toLowerCase() === 'kiwi dark') {
                target = themes[i];
                break;
            }
        }
        if (!target) {
            for (let j = 0; j < themes.length; j += 1) {
                if (themes[j].name.toLowerCase().indexOf(THEME_PREFIX) !== 0) {
                    target = themes[j];
                    break;
                }
            }
        }
        if (target && kiwi.themes && typeof kiwi.themes.setTheme === 'function') {
            kiwi.themes.setTheme(target.name);
        }
    }

    function handleAction(action) {
        switch (action) {
        case 'cycle-preset':
            cyclePreset();
            break;
        case 'crt':
            toggleCrt();
            break;
        case 'sounds':
            toggleSounds();
            break;
        case 'about':
            showModal(aboutModal);
            break;
        case 'settings':
            openSettings();
            break;
        case 'radio':
            openRadio();
            break;
        case 'messenger':
            handleMessengerTask();
            break;
        case 'minimize-app':
            minimizeApp();
            break;
        case 'shutdown':
            showModal(shutdownModal);
            break;
        case 'close-modal':
            closeModals();
            break;
        case 'exit':
            switchTheme();
            break;
        default:
            break;
        }
    }

    function onChromeClick(event) {
        let button = closest(event.target, 'button');
        if (!button) {
            return;
        }
        playClick();
        if (button === startButton) {
            toggleStartMenu();
            return;
        }
        let presetKey = button.getAttribute('data-preset');
        if (presetKey) {
            applyPreset(presetKey, true);
            hideStartMenu();
            return;
        }
        let action = button.getAttribute('data-action');
        if (action) {
            handleAction(action);
        }
    }

    function onDocumentClick(event) {
        if (!active || !document.body.classList.contains('nephwave-active')) {
            return;
        }
        let target = event.target;
        if (
            startMenu &&
            !startMenu.hidden &&
            !closest(target, '.nephwave-startmenu') &&
            !closest(target, '.nephwave-start')
        ) {
            hideStartMenu();
        }
        if (!sounds || closest(target, '.nephwave-chrome')) {
            return;
        }
        let now = Date.now();
        if (now - lastClickSoundAt < 40) {
            return;
        }
        let hit = closest(
            target,
            '.u-button, .kiwi-statebrowser-channel, ' +
            '.kiwi-statebrowser-network-header, .kiwi-header-option a, ' +
            '.kiwi-controlinput-button, .kiwi-radio-controls a, ' +
            '.kiwi-radio-browser-station, .kiwi-radio-browser-close'
        );
        if (hit) {
            lastClickSoundAt = now;
            playClick();
        }
    }

    function onDocumentKeydown(event) {
        if (event.key !== 'Escape') {
            return;
        }
        if (aboutModal && !aboutModal.hidden) {
            closeModals();
            return;
        }
        if (shutdownModal && !shutdownModal.hidden) {
            closeModals();
            return;
        }
        if (startMenu && !startMenu.hidden) {
            hideStartMenu();
        }
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function onMessage(event) {
        if (!active || !event || !event.message || !event.message.isHighlight) {
            return;
        }
        if (prefersReducedMotion()) {
            return;
        }
        let now = Date.now();
        if (now - lastGlitchAt < 1500) {
            return;
        }
        lastGlitchAt = now;
        document.body.classList.add('nephwave-glitch');
        window.setTimeout(() => {
            document.body.classList.remove('nephwave-glitch');
        }, 180);
    }

    function onActiveComponent() {
        window.setTimeout(updateTaskStates, 0);
    }

    function addDocumentListeners() {
        document.addEventListener('click', onDocumentClick, true);
        document.addEventListener('keydown', onDocumentKeydown);
        window.addEventListener('resize', updateLayoutInsets);
        kiwi.on('message.new', onMessage);
        kiwi.on('active.component', onActiveComponent);
    }

    function removeDocumentListeners() {
        document.removeEventListener('click', onDocumentClick, true);
        document.removeEventListener('keydown', onDocumentKeydown);
        window.removeEventListener('resize', updateLayoutInsets);
        kiwi.off('message.new', onMessage);
        kiwi.off('active.component', onActiveComponent);
    }

    function updateLayoutInsets() {
        if (typeof kiwi.setLayoutInsets !== 'function') {
            return;
        }
        let bezel = chromeRoot && !chromeRoot.hidden && !minimized ?
            chromeRoot.querySelector('.nephwave-bezel') :
            null;
        if (!bezel) {
            kiwi.clearLayoutInsets('nephwave-desktop');
            return;
        }

        let rect = bezel.getBoundingClientRect();
        kiwi.setLayoutInsets('nephwave-desktop', {
            top: Math.max(0, rect.top),
            right: Math.max(0, window.innerWidth - rect.right),
            bottom: Math.max(0, window.innerHeight - rect.bottom),
            left: Math.max(0, rect.left),
        });
    }

    function scheduleLayoutInsets() {
        window.requestAnimationFrame(updateLayoutInsets);
    }

    /* ---- Chrome construction ---- */
    function buildChrome() {
        if (chromeRoot) {
            return;
        }

        chromeRoot = makeEl('div', 'nephwave-chrome');
        chromeRoot.hidden = true;

        chromeRoot.innerHTML =
            '<div class="nephwave-titlebar">' +
                '<div class="nephwave-brand">' +
                    '<img class="nephwave-logo" src="static/nephnet.svg" alt="" aria-hidden="true">' +
                    '<span class="nephwave-brand-name">NephWave Messenger</span>' +
                '</div>' +
                '<div class="nephwave-title-actions">' +
                    '<button type="button" class="nephwave-title-btn" ' +
                        'data-action="settings" title="Control Panel" ' +
                        'aria-label="Open Control Panel"><i class="bx bx-cog"></i></button>' +
                    '<button type="button" class="nephwave-title-btn nephwave-title-btn--minimize" ' +
                        'data-action="minimize-app" title="Minimize" ' +
                        'aria-label="Minimize NephWave Messenger">' +
                        '<i class="bx bx-minus"></i></button>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-menubar">' +
                '<button type="button" class="nephwave-menu-btn" ' +
                    'data-action="cycle-preset" title="Cycle theme preset">' +
                    'Theme: <span class="nephwave-preset-label">Vapour-Net</span></button>' +
                '<button type="button" class="nephwave-menu-btn" ' +
                    'data-action="about">About</button>' +
                '<div class="nephwave-menubar-status nephwave-status nephwave-status--offline">' +
                    '<span class="nephwave-status-dot"></span>' +
                    '<span class="nephwave-status-text">OFFLINE</span>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-bezel"></div>' +
            '<div class="nephwave-taskbar">' +
                '<button type="button" class="nephwave-start" aria-expanded="false">' +
                    '<span class="nephwave-start-logo">' +
                        '<span></span><span></span><span></span><span></span>' +
                    '</span>' +
                    '<span>Start</span>' +
                '</button>' +
                '<div class="nephwave-tasks">' +
                    '<button type="button" class="nephwave-task nephwave-task--messenger ' +
                        'nephwave-task--active" data-action="messenger" ' +
                        'title="Focus the message input" ' +
                        'aria-label="Focus the message input">' +
                        '<i class="bx bx-conversation"></i>' +
                        '<span>NephWave Messenger</span></button>' +
                    '<button type="button" class="nephwave-task nephwave-task--radio" ' +
                        'data-action="radio" hidden title="Open radio stations">' +
                        '<i class="bx bx-music"></i>' +
                        '<span>NephWave FM</span></button>' +
                '</div>' +
                '<div class="nephwave-tray">' +
                    '<button type="button" class="nephwave-tray-btn nephwave-tray-btn--crt" ' +
                        'data-action="crt" title="Toggle CRT scanlines" ' +
                        'aria-label="Toggle CRT scanlines" aria-pressed="true">' +
                        '<i class="bx bx-desktop"></i></button>' +
                    '<button type="button" class="nephwave-tray-btn nephwave-tray-btn--sounds" ' +
                        'data-action="sounds" title="Toggle UI sounds" ' +
                        'aria-label="Toggle UI sounds" aria-pressed="false">' +
                        '<i class="bx bx-volume-mute"></i></button>' +
                    '<span class="nephwave-nowplaying" hidden></span>' +
                    '<span class="nephwave-tray-status nephwave-status nephwave-status--offline">' +
                        '<span class="nephwave-status-dot"></span></span>' +
                    '<span class="nephwave-clock">--:-- --</span>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-startmenu" hidden>' +
                '<div class="nephwave-startmenu-banner">NEPHWAVE</div>' +
                '<div class="nephwave-startmenu-body">' +
                    '<button type="button" class="nephwave-menu-item" data-action="settings">' +
                        '<i class="bx bx-cog"></i><span>Control Panel</span></button>' +
                    '<button type="button" class="nephwave-menu-item" data-action="radio">' +
                        '<i class="bx bx-music"></i><span>Radio Stations</span></button>' +
                    '<div class="nephwave-menu-sep"></div>' +
                    '<div class="nephwave-menu-label">Theme Presets</div>' +
                    '<button type="button" class="nephwave-menu-item nephwave-preset-item" ' +
                        'data-preset="vapor" aria-checked="true">' +
                        '<span>Vapour-Net</span>' +
                        '<span class="nephwave-preset-check">&#10003;</span></button>' +
                    '<button type="button" class="nephwave-menu-item nephwave-preset-item" ' +
                        'data-preset="teal" aria-checked="false">' +
                        '<span>Classic 98</span>' +
                        '<span class="nephwave-preset-check">&#10003;</span></button>' +
                    '<button type="button" class="nephwave-menu-item nephwave-preset-item" ' +
                        'data-preset="platinum" aria-checked="false">' +
                        '<span>Platinum 68K</span>' +
                        '<span class="nephwave-preset-check">&#10003;</span></button>' +
                    '<button type="button" class="nephwave-menu-item nephwave-preset-item" ' +
                        'data-preset="be" aria-checked="false">' +
                        '<span>BeAesthetic</span>' +
                        '<span class="nephwave-preset-check">&#10003;</span></button>' +
                    '<div class="nephwave-menu-sep"></div>' +
                    '<button type="button" class="nephwave-menu-item" data-action="crt">' +
                        '<i class="bx bx-desktop"></i><span>CRT Scanlines</span>' +
                        '<span class="nephwave-crt-menu-label">On</span></button>' +
                    '<button type="button" class="nephwave-menu-item" data-action="sounds">' +
                        '<i class="bx bx-volume-full"></i><span>UI Sounds</span>' +
                        '<span class="nephwave-sounds-menu-label">Off</span></button>' +
                    '<div class="nephwave-menu-sep"></div>' +
                    '<button type="button" class="nephwave-menu-item" data-action="about">' +
                        '<i class="bx bx-info-circle"></i><span>About NephWave</span></button>' +
                    '<button type="button" class="nephwave-menu-item" data-action="shutdown">' +
                        '<i class="bx bx-power-off"></i><span>Shut Down...</span></button>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-modal nephwave-modal--about" hidden>' +
                '<div class="nephwave-dialog" role="dialog" aria-modal="true" ' +
                    'aria-labelledby="nephwave-about-title">' +
                    '<div class="nephwave-dialog-title">' +
                        '<span id="nephwave-about-title">About NephWave</span>' +
                        '<button type="button" class="nephwave-dialog-close" ' +
                            'data-action="close-modal" aria-label="Close">&#10005;</button>' +
                    '</div>' +
                    '<div class="nephwave-dialog-body">' +
                        '<h3>NephWave Messenger</h3>' +
                        '<p>A Windows 98-inspired retro computing KiwiIRC theme.</p>' +
                        '<p><strong>Presets:</strong><ul><li>Vapour-Net</li><li>Classic 98</li>' +
                            '<li>Platinum 68K</li><li>BeAesthetic</li></ul></p>' +
                        '<p>Use the <strong>Start Menu</strong> to access theme settings.</p>' +
                        '<p>Use the <strongTaskbar</strong> to minimize and restore the messenger.</p>' +
                    '</div>' +
                    '<div class="nephwave-dialog-actions">' +
                        '<button type="button" class="nephwave-btn nephwave-btn--primary" ' +
                            'data-action="close-modal">OK</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-modal nephwave-modal--shutdown" hidden>' +
                '<div class="nephwave-dialog" role="dialog" aria-modal="true" ' +
                    'aria-labelledby="nephwave-shutdown-title">' +
                    '<div class="nephwave-dialog-title">' +
                        '<span id="nephwave-shutdown-title">Shut Down NephWave</span>' +
                        '<button type="button" class="nephwave-dialog-close" ' +
                            'data-action="close-modal" aria-label="Close">&#10005;</button>' +
                    '</div>' +
                    '<div class="nephwave-dialog-body">' +
                        '<h3>Switch themes?</h3>' +
                        '<p>Leave the NephWave desktop and return to Kiwi Dark?</p>' +
                    '</div>' +
                    '<div class="nephwave-dialog-actions">' +
                        '<button type="button" class="nephwave-btn" ' +
                            'data-action="close-modal">Stay in NephWave</button>' +
                        '<button type="button" class="nephwave-btn nephwave-btn--primary" ' +
                            'data-action="exit">Switch to Kiwi Dark</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="nephwave-crt" aria-hidden="true"></div>';

        document.body.appendChild(chromeRoot);

        startMenu = chromeRoot.querySelector('.nephwave-startmenu');
        startButton = chromeRoot.querySelector('.nephwave-start');
        aboutModal = chromeRoot.querySelector('.nephwave-modal--about');
        shutdownModal = chromeRoot.querySelector('.nephwave-modal--shutdown');
        messengerTask = chromeRoot.querySelector('.nephwave-task--messenger');
        radioTask = chromeRoot.querySelector('.nephwave-task--radio');
        radioMenuItem = chromeRoot.querySelector(
            '.nephwave-startmenu [data-action="radio"]'
        );
        nowPlayingEl = chromeRoot.querySelector('.nephwave-nowplaying');
        clockEl = chromeRoot.querySelector('.nephwave-clock');
        presetLabel = chromeRoot.querySelector('.nephwave-preset-label');
        crtMenuLabel = chromeRoot.querySelector('.nephwave-crt-menu-label');
        soundsMenuLabel = chromeRoot.querySelector('.nephwave-sounds-menu-label');
        statusElements = [
            chromeRoot.querySelector('.nephwave-menubar-status'),
            chromeRoot.querySelector('.nephwave-tray-status'),
        ];
        statusText = chromeRoot.querySelector('.nephwave-status-text');

        chromeRoot.addEventListener('click', onChromeClick);
    }

    /* ---- Activation ---- */
    function activate() {
        if (!document.body || (failedTheme && failedTheme === currentThemeName())) {
            return;
        }
        if (!chromeRoot) {
            buildChrome();
        }

        preset = normalizePreset(readSetting('preset', DEFAULT_PRESET));
        crt = boolSetting(readSetting('crt', DEFAULT_CRT), DEFAULT_CRT);
        sounds = boolSetting(readSetting('sounds', DEFAULT_SOUNDS), DEFAULT_SOUNDS);

        minimized = false;
        document.body.classList.remove('nephwave-minimized');
        applyPreset(preset, false);
        applyCrt(false);
        applySounds(false);
        updateTaskStates();

        document.body.classList.add('nephwave-active');
        updatePresence();
        updateAvailability();
        updateAll();

        if (chromeRoot) {
            chromeRoot.hidden = false;
        }
        if (!active) {
            active = true;
            addDocumentListeners();
        }
        startClock();
        scheduleLayoutInsets();
    }

    function deactivate() {
        active = false;
        minimized = false;
        removeDocumentListeners();
        if (typeof kiwi.clearLayoutInsets === 'function') {
            kiwi.clearLayoutInsets('nephwave-desktop');
        }
        stopClock();
        hideStartMenu();
        hideModals();
        if (chromeRoot) {
            chromeRoot.hidden = true;
        }
        if (document.body) {
            BODY_CLASSES.forEach((className) => {
                document.body.classList.remove(className);
            });
            PRESETS.forEach((item) => {
                document.body.classList.remove('nephwave-preset-' + item.key);
            });
        }
    }

    function syncTheme() {
        if (isNephWave()) {
            activate();
        } else {
            deactivate();
        }
    }

    syncTheme();
    kiwi.on('theme.change', () => {
        failedTheme = '';
        syncTheme();
    });
    kiwi.on('theme.failed', (theme) => {
        if (theme && typeof theme.name === 'string' &&
            theme.name.toLowerCase().indexOf(THEME_PREFIX) === 0) {
            failedTheme = theme.name.toLowerCase();
            deactivate();
        }
    });

    /* The initial theme stylesheet may still be loading when plugins start.
     * Retry a few times and once more after the page load so a saved NephWave
     * selection activates even though ThemeManager does not emit theme.change
     * for the initial theme. */
    window.setTimeout(syncTheme, 100);
    window.setTimeout(syncTheme, 500);
    window.setTimeout(syncTheme, 1500);
    window.addEventListener('load', syncTheme);
});
