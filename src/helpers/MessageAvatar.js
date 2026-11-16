'kiwi public';

const MESSAGE_TYPES = ['privmsg', 'action', 'notice', 'message'];

export function shouldDisplayAvatar(message, buffer, options = {}) {
    const showWithoutUser = options.showWithoutUser === true;
    const repeat = options.repeat === true;

    if (!message || MESSAGE_TYPES.indexOf(message.type) === -1) {
        return false;
    }

    if (!message.user && (!showWithoutUser || !message.nick)) {
        return false;
    }

    if (!buffer || buffer.isServer() || buffer.isSpecial()) {
        return false;
    }

    if (repeat) {
        return false;
    }

    return true;
}
