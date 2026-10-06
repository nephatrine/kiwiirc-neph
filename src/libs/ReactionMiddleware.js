'kiwi public';

import * as Reactions from '@/helpers/Reactions';

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
    const label = message.tags.label;

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

    // If this is an echo of our own reaction with a label, clear the pending state
    if (label && targetNick.toLowerCase() === client.user.nick.toLowerCase()) {
        const pending = buffer.messagesObj.pendingReactions[label];
        if (pending) {
            Reactions.applyReaction(
                targetMessage,
                targetNick,
                emoji,
                isReacting,
                { isPending: false }
            );
            delete buffer.messagesObj.pendingReactions[label];
        } else {
            // Echo from another client, or local echo already timed out
            Reactions.applyReaction(
                targetMessage,
                targetNick,
                emoji,
                isReacting,
                { isPending: false }
            );
        }
    } else {
        // Normal incoming reaction or Scenario C (echo without label)
        Reactions.applyReaction(
            targetMessage,
            targetNick,
            emoji,
            isReacting,
            { isPending: false }
        );
    }

    // Update the 'reacted' status if this is our nick
    if (targetNick.toLowerCase() === client.user.nick.toLowerCase()) {
        if (targetMessage.reactions[emoji]) {
            targetMessage.reactions[emoji].reacted = isReacting;
        }
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
