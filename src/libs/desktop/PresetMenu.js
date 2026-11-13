import ThemeManager from '@/libs/ThemeManager';
import {
    LAYOUT_PRESETS,
    applyLayoutPreset,
    availableLayoutPresets
} from '@/helpers/LayoutPresets';

function presetDescriptors(themeManager) {
    return availableLayoutPresets(themeManager).map((preset) => ({
        id: preset.id,
        label: preset.label,
    }));
}

export function initDesktopPresetMenu(state, themeManager = ThemeManager.instance()) {
    const api = typeof window !== 'undefined' &&
        window.kiwiDesktop &&
        window.kiwiDesktop.presets;

    if (!api || typeof api.onApply !== 'function') {
        return () => {};
    }

    const updateAvailable = () => {
        if (typeof api.setAvailable === 'function') {
            api.setAvailable(presetDescriptors(themeManager));
        }
    };

    updateAvailable();

    let stopWatching = () => {};
    if (typeof api.setAvailable === 'function' &&
        state &&
        typeof state.$watch === 'function'
    ) {
        stopWatching = state.$watch(
            'settings.themes',
            updateAvailable,
            { deep: true }
        );
    }

    const stopApplying = api.onApply((id) => {
        const preset = LAYOUT_PRESETS.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        applyLayoutPreset(state, themeManager, preset);
    });

    return () => {
        stopApplying();
        stopWatching();
    };
}
