'kiwi public';

import Vue from 'vue';

/**
 * Adds the +draft/react IRCv3 spec to irc-framework
 */
export default function reactionMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        rawEvents.use(theMiddleware.bind(null, network));
    };
}

export function theMiddleware(network, command, message, rawLine, client, next) {
    const reactEmoji = message.tags['+draft/react'];
    const unreactEmoji = message.tags['+draft/unreact'];
    const replyId = message.tags['+reply'] || message.tags['+draft/reply'];

    if ((!reactEmoji && !unreactEmoji) || !replyId) {
        if (next) next();
        return;
    }

    const targetNick = message.nick;
    if (!targetNick) {
        if (next) next();
        return;
    }

    // Find the buffer this message belongs to
    // If we are params[0] then the target is the sender (direct message)
    let target = (message.params[0].toLowerCase() === client.user.nick.toLowerCase()) ?
        message.nick :
        message.params[0];

    // Handle STATUSMSG prefixes (e.g. @#channel)
    const targetGroup = network.extractTargetGroup(target);
    if (targetGroup) {
        target = targetGroup.target;
    }

    const buffer = network.bufferByName(target);
    if (!buffer) {
        if (next) next();
        return;
    }

    const targetMessage = buffer.messagesObj.messageIds[replyId];
    if (!targetMessage) {
        if (next) next();
        return;
    }

    const emoji = reactEmoji || unreactEmoji;
    const isReacting = !!reactEmoji;

    if (!targetMessage.reactions[emoji]) {
        if (!isReacting) {
            // Trying to unreact to something that doesn't exist
            if (command === 'TAGMSG') {
                return;
            }
            if (next) next();
            return;
        }
        Vue.set(targetMessage.reactions, emoji, {
            count: 0,
            users: [],
            reacted: false,
        });
    }

    const reaction = targetMessage.reactions[emoji];
    const userIdx = reaction.users.indexOf(targetNick);

    if (isReacting && userIdx === -1) {
        reaction.users.push(targetNick);
        reaction.count++;
    } else if (!isReacting && userIdx !== -1) {
        reaction.users.splice(userIdx, 1);
        reaction.count--;
    }

    // Update the 'reacted' status if this is our nick
    if (targetNick.toLowerCase() === client.user.nick.toLowerCase()) {
        reaction.reacted = isReacting;
    }

    // Clean up empty reaction groups
    if (reaction.count <= 0) {
        Vue.delete(targetMessage.reactions, emoji);
    }

    network.appState.$emit('message.reaction', {
        message: targetMessage,
        buffer: buffer,
    });

    // If it's a TAGMSG, we've handled it completely
    if (command === 'TAGMSG') {
        return;
    }

    if (next) next();
}
