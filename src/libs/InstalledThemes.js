'kiwi public';

export const DESKTOP_THEME_PREFIX = 'desktop-theme:';

export function themeFromDescriptor(descriptor) {
    return {
        name: DESKTOP_THEME_PREFIX + descriptor.id,
        displayName: descriptor.name || descriptor.id,
        url: descriptor.url || `kiwi-theme://${descriptor.id}`,
        mode: descriptor.mode || '',
        google_fonts: Array.isArray(descriptor.google_fonts) ?
            descriptor.google_fonts :
            [],
        installed: true,
        desktopThemeId: descriptor.id,
    };
}

export function mergeInstalledThemes(state, descriptors) {
    const current = Array.isArray(state.settings.themes) ?
        state.settings.themes :
        [];
    const configured = current.filter((theme) => !theme.installed);
    const seen = new Set();
    const installed = [];

    (Array.isArray(descriptors) ? descriptors : []).forEach((descriptor) => {
        if (!descriptor || !descriptor.id || seen.has(descriptor.id)) {
            return;
        }
        seen.add(descriptor.id);
        installed.push(themeFromDescriptor(descriptor));
    });

    const themes = configured.concat(installed);
    state.$set(state.settings, 'themes', themes);
    return themes;
}
