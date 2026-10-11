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

    const effectiveCommand = (command === 'unknown command' && message.command)
        ? message.command.toUpperCase()
        : command.toUpperCase();

    const reactEmoji = message.tags['+draft/react'];
    const unreactEmoji = message.tags['+draft/unreact'];
    const replyId = message.tags['+reply'] || message.tags['+draft/reply'];
    const label = message.tags.label;

    if ((!reactEmoji && !unreactEmoji) || !replyId) {
        if (effectiveCommand === 'TAGMSG') {
            return;
        }
        if (next) next();
        return;
    }

    const targetNick = message.nick;
    if (!targetNick) {
        if (effectiveCommand === 'TAGMSG') {
            return;
        }
        if (next) next();
        return;
    }

    // Find the buffer this message belongs to
    // In parsedEvents 'target' is used, in rawEvents 'params[0]' is used
    let target = message.target || (message.params && message.params[0]);
    if (!target) {
        if (effectiveCommand === 'TAGMSG') {
            return;
        }
        if (next) next();
        return;
    }

    // Handle +channel-context tag for routing
    if (message.tags && message.tags['+channel-context']) {
        const contextChannel = message.tags['+channel-context'];
        const targetBuffer = network.bufferByName(contextChannel);
        if (targetBuffer && targetBuffer.isChannel() && targetBuffer.joined) {
            // Check if sender is also in the channel
            const sender = network.appState.getUser(network.id, message.nick);
            if (sender && sender.buffers[targetBuffer.id]) {
                target = contextChannel;
            }
        }
    } else if (target.toLowerCase() === client.user.nick.toLowerCase()) {
        // If we are the target then the sender is the target (direct message)
        target = message.nick;
    }

    // Handle STATUSMSG prefixes (e.g. @#channel)
    const targetGroup = network.extractTargetGroup(target);
    if (targetGroup) {
        target = targetGroup.target;
    }

    const initialBuffer = network.bufferByName(target);
    const resolved = network.resolveMessage(replyId, initialBuffer, message.nick);
    if (!resolved) {
        if (effectiveCommand === 'TAGMSG') {
            return;
        }
        if (next) next();
        return;
    }

    const { message: targetMessage, buffer } = resolved;

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
    if (effectiveCommand === 'TAGMSG') {
        return;
    }

    if (next) next();
}
