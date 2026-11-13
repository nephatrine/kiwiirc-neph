export const LAYOUT_PRESETS = Object.freeze([
    {
        id: 'nephnet',
        label: 'NephNET',
        theme: 'NephDeck',
        messageLayout: 'cyberdeck',
        layoutLabel: 'Cyberdeck',
        useMonospace: false,
    },
    {
        id: 'aim',
        label: 'AIM',
        theme: 'NephWave',
        messageLayout: 'inline',
        layoutLabel: 'Inline',
        useMonospace: false,
    },
    {
        id: 'discord',
        label: 'Discord',
        theme: 'Catppuccin Mocha',
        messageLayout: 'modern',
        layoutLabel: 'Modern',
        useMonospace: false,
    },
    {
        id: 'irc',
        label: 'IRC',
        theme: 'Oxocarbon Dark',
        messageLayout: 'compact',
        layoutLabel: 'Traditional',
        useMonospace: true,
    },
    {
        id: 'teams',
        label: 'Teams',
        theme: 'Nord Light',
        messageLayout: 'corporate',
        layoutLabel: 'Corporate',
        useMonospace: false,
    },
]);

export function applyLayoutPreset(state, themeManager, preset) {
    if (!preset || !themeManager.findTheme(preset.theme)) {
        return false;
    }

    state.setting('buffers.messageLayout', preset.messageLayout);
    state.setting('useMonospace', preset.useMonospace);
    themeManager.setTheme(preset.theme);
    return true;
}

export function isLayoutPresetActive(state, themeManager, preset) {
    if (!preset) {
        return false;
    }

    const currentTheme = themeManager.currentTheme();
    const currentThemeName = currentTheme ? currentTheme.name : state.setting('theme');

    return currentThemeName === preset.theme &&
        state.setting('buffers.messageLayout') === preset.messageLayout &&
        !!state.setting('useMonospace') === preset.useMonospace;
}
