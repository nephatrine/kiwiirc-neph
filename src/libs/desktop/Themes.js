function desktopThemes() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.themes || null;
}

export function isAvailable() {
    const themes = desktopThemes();
    return !!themes &&
        typeof themes.list === 'function' &&
        typeof themes.install === 'function' &&
        typeof themes.uninstall === 'function';
}

export function list() {
    const themes = desktopThemes();
    if (!themes || typeof themes.list !== 'function') {
        return Promise.resolve([]);
    }
    return themes.list();
}

export function install() {
    const themes = desktopThemes();
    if (!themes || typeof themes.install !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return themes.install();
}

export function uninstall(id) {
    const themes = desktopThemes();
    if (!themes || typeof themes.uninstall !== 'function') {
        return Promise.resolve({ removed: false });
    }
    return themes.uninstall(id);
}
