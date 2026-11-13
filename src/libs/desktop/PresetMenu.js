import ThemeManager from '@/libs/ThemeManager';
import {
    LAYOUT_PRESETS,
    applyLayoutPreset
} from '@/helpers/LayoutPresets';

export function initDesktopPresetMenu(state, themeManager = ThemeManager.instance()) {
    const api = typeof window !== 'undefined' &&
        window.kiwiDesktop &&
        window.kiwiDesktop.presets;

    if (!api || typeof api.onApply !== 'function') {
        return () => {};
    }

    return api.onApply((id) => {
        const preset = LAYOUT_PRESETS.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        applyLayoutPreset(state, themeManager, preset);
    });
}
