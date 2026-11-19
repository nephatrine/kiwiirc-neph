import {
    LAYOUT_PRESETS,
    applyLayoutPreset,
    availableLayoutPresets,
    isLayoutPresetActive
} from '@/helpers/LayoutPresets';

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

describe('layout presets', () => {
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
