'kiwi public';

export const DESKTOP_PLUGIN_PREFIX = 'desktop-plugin:';

export function pluginFromDescriptor(descriptor) {
    return {
        name: DESKTOP_PLUGIN_PREFIX + descriptor.id,
        url: descriptor.url,
        installed: true,
        desktopPluginId: descriptor.id,
        displayName: descriptor.name || descriptor.id,
        description: descriptor.description || '',
        version: descriptor.version || '',
    };
}

export function mergeInstalledPlugins(state, descriptors) {
    const current = Array.isArray(state.settings.plugins) ?
        state.settings.plugins :
        [];
    const configured = current.filter((plugin) => (
        plugin &&
        !plugin.installed &&
        typeof plugin.name === 'string' &&
        typeof plugin.url === 'string'
    ));
    const seen = new Set();
    const installed = [];

    (Array.isArray(descriptors) ? descriptors : []).forEach((descriptor) => {
        if (!descriptor || !descriptor.id || seen.has(descriptor.id)) {
            return;
        }
        seen.add(descriptor.id);
        installed.push(pluginFromDescriptor(descriptor));
    });

    const plugins = configured.concat(installed);
    state.$set(state.settings, 'plugins', plugins);
    return plugins;
}
