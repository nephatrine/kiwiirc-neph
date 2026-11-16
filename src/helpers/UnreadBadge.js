'kiwi public';

export function unreadBadgePolicy(buffer) {
    if (!buffer || !buffer.settings) {
        return 'default';
    }

    const policy = buffer.settings.unread_badge;
    if (policy === 'hide' || policy === 'show') {
        return policy;
    }

    return 'default';
}

export function unreadBadgesDisabled(buffer) {
    return unreadBadgePolicy(buffer) === 'hide';
}

export function unreadBadgesEnabled(buffer, state) {
    const policy = unreadBadgePolicy(buffer);
    if (policy === 'hide') {
        return false;
    }
    if (policy === 'show') {
        return true;
    }

    if (!state || typeof state.setting !== 'function') {
        return true;
    }

    return state.setting('unreadBadges') !== false;
}

export function isBufferMuted(buffer) {
    return !!buffer &&
        buffer.settings &&
        buffer.settings.alert_on === 'never' &&
        buffer.settings.favorite !== true &&
        unreadBadgesDisabled(buffer);
}
