function desktopPlugins() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.plugins || null;
}

export function isAvailable() {
    const plugins = desktopPlugins();
    return !!plugins &&
        typeof plugins.list === 'function' &&
        typeof plugins.install === 'function' &&
        typeof plugins.uninstall === 'function';
}

export function list() {
    const plugins = desktopPlugins();
    if (!plugins || typeof plugins.list !== 'function') {
        return Promise.resolve([]);
    }
    return plugins.list();
}

export function install() {
    const plugins = desktopPlugins();
    if (!plugins || typeof plugins.install !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return plugins.install();
}

export function uninstall(id) {
    const plugins = desktopPlugins();
    if (!plugins || typeof plugins.uninstall !== 'function') {
        return Promise.resolve({ removed: false });
    }
    return plugins.uninstall(id);
}
