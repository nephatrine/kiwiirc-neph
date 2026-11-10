function desktopEmojiPacks() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.emojiPacks || null;
}

export function isAvailable() {
    const emojiPacks = desktopEmojiPacks();
    return !!emojiPacks &&
        typeof emojiPacks.list === 'function' &&
        typeof emojiPacks.install === 'function' &&
        typeof emojiPacks.uninstall === 'function';
}

export function list() {
    const emojiPacks = desktopEmojiPacks();
    if (!emojiPacks || typeof emojiPacks.list !== 'function') {
        return Promise.resolve([]);
    }
    return emojiPacks.list();
}

export function install() {
    const emojiPacks = desktopEmojiPacks();
    if (!emojiPacks || typeof emojiPacks.install !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return emojiPacks.install();
}

export function uninstall(id) {
    const emojiPacks = desktopEmojiPacks();
    if (!emojiPacks || typeof emojiPacks.uninstall !== 'function') {
        return Promise.resolve({ removed: false });
    }
    return emojiPacks.uninstall(id);
}
