function desktopWindowVisibility() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.windowVisibility || null;
}

export function onChange(handler) {
    const visibility = desktopWindowVisibility();
    if (!visibility || typeof visibility.onChange !== 'function') {
        return () => {};
    }
    return visibility.onChange(handler);
}
