'kiwi public';

import Vue from 'vue';

/**
 * Apply a reaction (or unreaction) to a message object.
 * This logic is used by both the middleware (incoming events) and BufferState (local echo).
 *
 * @param {Object} message The reactive Message object
 * @param {String} nick The nick of the user reacting
 * @param {String} emoji The emoji character
 * @param {Boolean} isReacting True to add, false to remove
 * @param {Object} options Additional options { isPending: boolean }
 */
export function applyReaction(message, nick, emoji, isReacting, options = {}) {
    const isPending = !!options.isPending;

    if (!message.reactions[emoji]) {
        if (!isReacting) {
            // Trying to unreact to something that doesn't exist
            return;
        }
        Vue.set(message.reactions, emoji, {
            count: 0,
            users: [],
            reacted: false,
            pending_nicks: [],
        });
    }

    const reaction = message.reactions[emoji];
    const nickUpper = nick.toUpperCase();
    const userIdx = reaction.users.findIndex((u) => u.toUpperCase() === nickUpper);
    const pendingIdx = reaction.pending_nicks
        ? reaction.pending_nicks.findIndex((u) => u.toUpperCase() === nickUpper)
        : -1;

    if (isReacting) {
        if (userIdx === -1) {
            reaction.users.push(nick);
            reaction.count++;
        }

        if (isPending) {
            if (!reaction.pending_nicks) {
                Vue.set(reaction, 'pending_nicks', []);
            }
            if (pendingIdx === -1) {
                reaction.pending_nicks.push(nick);
            }
        } else if (pendingIdx !== -1) {
            reaction.pending_nicks.splice(pendingIdx, 1);
        }
    } else {
        if (userIdx !== -1) {
            reaction.users.splice(userIdx, 1);
            reaction.count--;
        }

        if (isPending) {
            if (!reaction.pending_nicks) {
                Vue.set(reaction, 'pending_nicks', []);
            }
            if (pendingIdx === -1) {
                reaction.pending_nicks.push(nick);
            }
        } else if (pendingIdx !== -1) {
            reaction.pending_nicks.splice(pendingIdx, 1);
        }
    }

    // Clean up empty reaction groups
    if (reaction.count <= 0 && (!reaction.pending_nicks || reaction.pending_nicks.length === 0)) {
        Vue.delete(message.reactions, emoji);
    }
}
