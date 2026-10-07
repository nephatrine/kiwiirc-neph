'kiwi public';

import * as Reactions from '@/helpers/Reactions';

/**
 * Adds the +draft/react IRCv3 spec to irc-framework
 */
export default function reactionMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        parsedEvents.use(theMiddleware.bind(null, network));
    };
}

export function theMiddleware(network, command, message, client, next) {
    if (!message || !message.tags) {
        if (next) next();
        return;
    }

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
    // In parsedEvents 'target' is used, in rawEvents 'params[0]' is used
    let target = message.target || (message.params && message.params[0]);
    if (!target) {
        if (next) next();
        return;
    }

    // If we are the target then the sender is the target (direct message)
    if (target.toLowerCase() === client.user.nick.toLowerCase()) {
        target = message.nick;
    }

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

    let targetMessage = buffer.messagesObj.messageIds[replyId];
    if (!targetMessage) {
        // If not found in the official ID map, it might still be in the batching queue
        // (common during history playback)
        const queue = buffer.addMessageBatch.queue();
        targetMessage = queue.find((m) => m.irc_id === replyId);
    }

    if (!targetMessage) {
        if (next) next();
        return;
    }

    const emoji = reactEmoji || unreactEmoji;
    const isReacting = !!reactEmoji;

    // If this is an echo of our own reaction, handle promotion
    if (targetNick.toLowerCase() === client.user.nick.toLowerCase()) {
        if (label) {
            network.appState.promotePendingLabel(network.id, label);
        } else {
            // Normal incoming reaction or Scenario 2 (echo without label)
            Reactions.applyReaction(
                targetMessage,
                targetNick,
                emoji,
                isReacting,
                { isPending: false }
            );
        }
    } else {
        // Normal incoming reaction from another user
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
    if (command.toUpperCase() === 'TAGMSG') {
        return;
    }

    if (next) next();
}
