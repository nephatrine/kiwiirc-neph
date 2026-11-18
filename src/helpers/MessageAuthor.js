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

export function shouldShowHostName(message, buffer, options = {}) {
    if (!buffer || typeof buffer.setting !== 'function') {
        return false;
    }

    const showRealNames = typeof options.showRealNames === 'boolean' ?
        options.showRealNames :
        buffer.setting('show_realnames');
    const showHostNames = typeof options.showHostNames === 'boolean' ?
        options.showHostNames :
        buffer.setting('show_hostnames');

    if (showRealNames || !showHostNames) {
        return false;
    }

    return !!messageHostName(message);
}
