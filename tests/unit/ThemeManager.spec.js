import ThemeManager from '@/libs/ThemeManager';
import {
    LAYOUT_PRESETS,
    applyLayoutPreset,
    availableLayoutPresets,
    isLayoutPresetActive
} from '@/helpers/LayoutPresets';

function makeTheme(name, mode) {
    const theme = { name, url: 'static/themes/test' };
    if (mode) {
        theme.mode = mode;
    }
    return theme;
}

function makeManager(theme) {
    const state = {
        themes: [theme],
        setting: () => undefined,
        getSetting: (key) => (key === 'settings.themes' ? [theme] : undefined),
        $emit: () => {},
    };

    const manager = new ThemeManager(state, theme.name);
    manager.activeTheme = theme;
    return manager;
}

function mockComputedStyle(values) {
    return jest.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        getPropertyValue: (name) => (values[name] === undefined ? '' : values[name]),
    }));
}

describe('ThemeManager static helpers', () => {
    it('normalises a declared light/dark mode', () => {
        expect(ThemeManager.declaredMode({ mode: 'dark' })).toBe('dark');
        expect(ThemeManager.declaredMode({ mode: 'LIGHT' })).toBe('light');
        expect(ThemeManager.declaredMode({ mode: 'auto' })).toBeNull();
        expect(ThemeManager.declaredMode({})).toBeNull();
        expect(ThemeManager.declaredMode(null)).toBeNull();
    });

    it('classifies colours by luminance', () => {
        expect(ThemeManager.modeFromColour('#ffffff')).toBe('light');
        expect(ThemeManager.modeFromColour('#fff')).toBe('light');
        expect(ThemeManager.modeFromColour('#000000')).toBe('dark');
        expect(ThemeManager.modeFromColour('#0a0c10')).toBe('dark');
        expect(ThemeManager.modeFromColour('#fbf1c7')).toBe('light');
        expect(ThemeManager.modeFromColour('rgb(30, 30, 30)')).toBe('dark');
        expect(ThemeManager.modeFromColour('rgba(250, 250, 250, 1)')).toBe('light');
        expect(ThemeManager.modeFromColour('rgba(0, 0, 0, 0)')).toBeNull();
        expect(ThemeManager.modeFromColour('')).toBeNull();
        expect(ThemeManager.modeFromColour('not a colour')).toBeNull();
    });
});

describe('ThemeManager mode detection', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '<div class="kiwi-wrap"></div>';
        document.documentElement.style.colorScheme = '';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('resolves mode from config or name heuristic', () => {
        let manager = makeManager(makeTheme('Neutral'));
        manager.setMode('light');
        manager.guessMode(makeTheme('Neutral Dark', 'light'));
        expect(manager.themeMode()).toBe('light');
        manager.guessMode(makeTheme('Neutral Light', 'dark'));
        expect(manager.themeMode()).toBe('dark');

        manager = makeManager(makeTheme('Neutral'));
        manager.setMode('light');
        manager.guessMode(makeTheme('Neutral Dark'));
        expect(manager.themeMode()).toBe('dark');

        manager = makeManager(makeTheme('NephDeck'));
        manager.setMode('dark');
        manager.guessMode(makeTheme('NephDeck'));
        expect(manager.themeMode()).toBe('dark');
    });

    it('prefers the config mode over the measured background', () => {
        mockComputedStyle({
            '--brand-default-bg': '#fafafa',
            'background-color': 'rgb(250, 250, 250)',
        });
        const manager = makeManager(makeTheme('Some Light Theme', 'dark'));
        manager.refreshMode();
        expect(manager.themeMode()).toBe('dark');
    });

    it('measures --brand-default-bg when no mode is configured', () => {
        mockComputedStyle({ '--brand-default-bg': '#1e1e2e' });
        const manager = makeManager(makeTheme('NephDeck'));
        manager.refreshMode();
        expect(manager.themeMode()).toBe('dark');
    });

    it('detects light backgrounds', () => {
        mockComputedStyle({ '--brand-default-bg': '#fbf1c7' });
        const manager = makeManager(makeTheme('Kiwi Coffee'));
        manager.setMode('dark');
        manager.refreshMode();
        expect(manager.themeMode()).toBe('light');
    });

    it('falls back to the name when no colour can be measured', () => {
        mockComputedStyle({ '--brand-default-bg': '', 'background-color': 'rgba(0, 0, 0, 0)' });
        const manager = makeManager(makeTheme('Mystery Dark'));
        manager.setMode('light');
        manager.refreshMode();
        expect(manager.themeMode()).toBe('dark');
    });
});

describe('ThemeManager theme loading', () => {
    function makeState(theme) {
        return {
            themes: [theme],
            setting: () => undefined,
            getSetting: (key) => (key === 'settings.themes' ? [theme] : undefined),
            $emit: jest.fn(),
        };
    }

    function makeLoaded(theme) {
        const state = makeState(theme);
        return { manager: new ThemeManager(state, theme.name), state };
    }

    function lastLink() {
        const links = document.head.querySelectorAll('link[rel="stylesheet"]');
        return links[links.length - 1];
    }

    beforeEach(() => {
        jest.spyOn(window.console, 'error').mockImplementation(() => {});
        document.head.innerHTML = '';
        document.body.innerHTML = '<div class="kiwi-wrap"></div>';
        document.documentElement.style.colorScheme = '';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('builds a theme.css url and preserves the query string', () => {
        expect(ThemeManager.themeUrl({ url: 'static/themes/dark' })).toBe('static/themes/dark/theme.css');
        expect(ThemeManager.themeUrl({ url: 'static/themes/dark/' })).toBe('static/themes/dark/theme.css');
        expect(ThemeManager.themeUrl({ url: 'static/themes/dark?cb=1' })).toBe('static/themes/dark/theme.css?cb=1');
    });

    it('treats a theme named Custom like any other theme', () => {
        makeLoaded({ name: 'Custom', url: 'static/themes/custom' });

        expect(lastLink().getAttribute('href')).toBe('static/themes/custom/theme.css');
    });

    it('finds themes by name case-insensitively', () => {
        const theme = makeTheme('Neutral');
        const { manager } = makeLoaded(theme);

        expect(manager.findTheme('nEuTrAl')).toBe(theme);
        expect(manager.findTheme('missing')).toBeUndefined();
        expect(manager.findTheme('')).toBeNull();
    });

    it('injects a google fonts link when the theme asks for one', () => {
        makeLoaded(Object.assign(makeTheme('Fonty'), { google_fonts: ['Open Sans'] }));

        const link = document.head.querySelector('link[href*="fonts.googleapis.com"]');
        expect(link).not.toBeNull();
        expect(link.href).toContain('family=Open+Sans');
    });

    it('activates a loaded theme and emits theme.change on the next one', () => {
        const { manager, state } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });

        lastLink().onload();
        expect(manager.activeTheme.name).toBe('Neutral');

        manager.setTheme({ name: 'Second', url: 'static/themes/second' });
        lastLink().onload();

        expect(manager.activeTheme.name).toBe('Second');
        expect(manager.previousTheme.name).toBe('Neutral');
        expect(state.$emit).toHaveBeenCalledWith(
            'theme.change',
            expect.objectContaining({ name: 'Second' }),
            expect.objectContaining({ name: 'Neutral' })
        );
    });

    it('emits theme.failed when a stylesheet errors', () => {
        const { manager, state } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });
        lastLink().onload();

        manager.setTheme({ name: 'Broken', url: 'static/themes/broken' });
        lastLink().onerror();

        expect(state.$emit).toHaveBeenCalledWith(
            'theme.failed',
            expect.objectContaining({ name: 'Broken' }),
            expect.objectContaining({ name: 'Neutral' })
        );
    });

    it('keeps and caches the css vars element', () => {
        const { manager } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });
        const wrap = document.querySelector('.kiwi-wrap');

        expect(manager.ensureVarsElement()).toBe(wrap);
        expect(manager.ensureVarsElement()).toBe(wrap);

        // A stale cached node is re-queried once it leaves the document
        document.body.innerHTML = '<div class="kiwi-wrap fresh"></div>';
        expect(manager.ensureVarsElement()).toBe(document.querySelector('.kiwi-wrap'));
    });

    it('reads css variables through themeVar', () => {
        mockComputedStyle({ '--kiwi-accent': '  #ffb000  ' });
        const { manager } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });

        expect(manager.cssVar('--kiwi-accent')).toBe('#ffb000');
        expect(manager.themeVar('accent')).toBe('#ffb000');
    });

    it('returns an empty string when no vars element exists', () => {
        document.body.innerHTML = '';
        const { manager } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });

        expect(manager.cssVar('--kiwi-accent')).toBe('');
    });

    it('mirrors the mode onto the document colour scheme', () => {
        const { manager } = makeLoaded({ name: 'Neutral', url: 'static/themes/first' });

        manager.setMode('dark');
        expect(manager.themeMode()).toBe('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');

        manager.setMode('dark');
        expect(manager.themeMode()).toBe('dark');
    });

    it('ignores setting the already-active theme url', () => {
        const first = { name: 'Neutral', url: 'static/themes/first' };
        const { manager } = makeLoaded(first);
        lastLink().onload();
        document.head.innerHTML = '';

        manager.setTheme({ name: 'Neutral Again', url: 'static/themes/first' });

        expect(document.head.querySelector('link')).toBeNull();
    });

    it('cleans up a pending theme link that was already detached', () => {
        const first = { name: 'Neutral', url: 'static/themes/first' };
        const { manager } = makeLoaded(first);

        // The initial theme is still loading (loadingElement set) but its <link>
        // gets detached from <head> before the next setTheme() call.
        document.head.innerHTML = '';

        expect(() => manager.setTheme({ name: 'Second', url: 'static/themes/second' })).not.toThrow();
        expect(manager.loadingElement).toBe(lastLink());
        expect(manager.loadingElement.parentNode).toBe(document.head);
    });

    it('aborts on an invalid theme and restores the setting name', () => {
        const first = { name: 'Neutral', url: 'static/themes/first' };
        const { manager, state } = makeLoaded(first);
        manager.activeTheme = first;
        state.setting = jest.fn(() => 'SomethingElse');

        manager.setTheme({ name: 'Broken' });

        expect(manager.activeTheme).toBe(first);
        expect(state.setting).toHaveBeenCalledWith('theme', 'Neutral');
    });

    it('reload updates or skips the cache buster as needed', () => {
        const first = { name: 'Neutral', url: 'static/themes/first' };
        const loaded = makeLoaded(first);
        loaded.manager.activeTheme = first;
        loaded.manager.setTheme = jest.fn();

        loaded.manager.reload();

        expect(first.url).toMatch(/^static\/themes\/first\?cb=\d+$/);
        expect(loaded.manager.setTheme).toHaveBeenCalledWith('Neutral');

        const second = { name: 'Neutral', url: 'static/themes/second?cb=111' };
        const existing = makeLoaded(second);
        existing.manager.activeTheme = second;
        existing.manager.setTheme = jest.fn();

        existing.manager.reload();

        expect(second.url).toMatch(/^static\/themes\/second\?cb=\d+$/);
        expect(second.url).not.toBe('static/themes/second?cb=111');

        const empty = makeLoaded({ name: 'Neutral', url: 'static/themes/third' });
        empty.manager.currentTheme = () => null;
        empty.manager.setTheme = jest.fn();

        empty.manager.reload();

        expect(empty.manager.setTheme).not.toHaveBeenCalled();
    });
});

describe('layout presets', () => {
    function createState(settings = {}) {
        return {
            setting: jest.fn((key, value) => {
                if (typeof value !== 'undefined') {
                    return value;
                }
                return settings[key];
            }),
        };
    }

    function createThemeManager(themeName = 'NephDeck') {
        return {
            findTheme: jest.fn((name) => (
                name === themeName ? { name, url: 'static/themes/test' } : null
            )),
            setTheme: jest.fn(),
            currentTheme: jest.fn(() => (
                themeName ? { name: themeName, url: 'static/themes/test' } : null
            )),
        };
    }

    it('defines presets and lists only those with enabled themes', () => {
        expect(LAYOUT_PRESETS.map((preset) => ({
            label: preset.label,
            theme: preset.theme,
            layout: preset.messageLayout,
            monospace: preset.useMonospace,
        }))).toEqual([
            {
                label: 'NephNET',
                theme: 'NephDeck',
                layout: 'cyberdeck',
                monospace: false,
            },
            {
                label: 'AIM',
                theme: 'NephWave',
                layout: 'inline',
                monospace: false,
            },
            {
                label: 'Discord',
                theme: 'Catppuccin Mocha',
                layout: 'modern',
                monospace: false,
            },
            {
                label: 'IRC',
                theme: 'Oxocarbon Dark',
                layout: 'compact',
                monospace: true,
            },
            {
                label: 'Teams',
                theme: 'Nord Light',
                layout: 'corporate',
                monospace: false,
            },
        ]);

        const themeManager = {
            findTheme: jest.fn((name) => (
                name === 'NephDeck' || name === 'NephWave' ? { name } : null
            )),
        };

        expect(availableLayoutPresets(themeManager).map((preset) => preset.id))
            .toEqual(['nephnet', 'aim']);
    });

    it('applies theme, layout, and font settings together', () => {
        let state = createState();
        let themeManager = createThemeManager();
        const preset = LAYOUT_PRESETS[0];

        expect(applyLayoutPreset(state, themeManager, preset)).toBe(true);
        expect(state.setting).toHaveBeenCalledWith(
            'buffers.messageLayout',
            'cyberdeck'
        );
        expect(state.setting).toHaveBeenCalledWith('useMonospace', false);
        expect(themeManager.setTheme).toHaveBeenCalledWith('NephDeck');

        state = createState();
        themeManager = createThemeManager('Kiwi Dark');

        expect(applyLayoutPreset(state, themeManager, preset)).toBe(false);
        expect(state.setting).not.toHaveBeenCalled();
        expect(themeManager.setTheme).not.toHaveBeenCalled();
    });

    it('detects a matching active preset', () => {
        const preset = LAYOUT_PRESETS[0];
        const state = createState({
            'theme': 'NephDeck',
            'buffers.messageLayout': 'cyberdeck',
            'useMonospace': false,
        });
        const themeManager = createThemeManager('NephDeck');

        expect(isLayoutPresetActive(state, themeManager, preset)).toBe(true);

        state.setting.mockImplementation((key) => ({
            'theme': 'NephDeck',
            'buffers.messageLayout': 'modern',
            'useMonospace': true,
        })[key]);

        expect(isLayoutPresetActive(state, themeManager, preset)).toBe(false);
    });
});
