import ThemeManager from '@/libs/ThemeManager';

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

    it('lets the config mode override the name heuristic', () => {
        const manager = makeManager(makeTheme('Neutral'));
        manager.setMode('light');
        manager.guessMode(makeTheme('Neutral Dark', 'light'));
        expect(manager.themeMode()).toBe('light');

        manager.guessMode(makeTheme('Neutral Light', 'dark'));
        expect(manager.themeMode()).toBe('dark');
    });

    it('falls back to the name heuristic when no mode is configured', () => {
        const manager = makeManager(makeTheme('Neutral'));
        manager.setMode('light');
        manager.guessMode(makeTheme('Neutral Dark'));
        expect(manager.themeMode()).toBe('dark');
    });

    it('leaves the mode untouched when the name matches neither', () => {
        const manager = makeManager(makeTheme('NephDeck Amber'));
        manager.setMode('dark');
        manager.guessMode(makeTheme('NephDeck Amber'));
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
        const manager = makeManager(makeTheme('NephDeck Amber'));
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
