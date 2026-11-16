'kiwi public';

export function messageHostName(message) {
    const user = message && message.user;
    if (!user) {
        return '';
    }

    const username = user.username || user.ident || '';
    const host = user.host || user.hostname || '';
    if (!username || !host) {
        return '';
    }

    return username + '@' + host;
}

export function shouldShowHostName(message, buffer) {
    if (!buffer || typeof buffer.setting !== 'function') {
        return false;
    }
    if (buffer.setting('show_realnames')) {
        return false;
    }
    if (!buffer.setting('show_hostnames')) {
        return false;
    }

    return !!messageHostName(message);
}
