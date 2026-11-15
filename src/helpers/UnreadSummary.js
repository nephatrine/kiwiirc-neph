export function unreadSummary(state) {
    let unread = 0;
    let highlights = 0;
    let errors = 0;

    if (!state || !Array.isArray(state.networks)) {
        return { unread, highlights, errors };
    }

    const badgesEnabled = typeof state.setting === 'function' ?
        state.setting('unreadBadges') :
        true;
    if (!badgesEnabled) {
        return { unread, highlights, errors };
    }

    state.networks.forEach((network) => {
        if (!network || !Array.isArray(network.buffers)) {
            return;
        }

        network.buffers.forEach((buffer) => {
            if (!buffer || typeof buffer.isSpecial !== 'function' ||
                buffer.isSpecial() ||
                (typeof buffer.setting === 'function' &&
                    buffer.setting('hide_message_counts'))
            ) {
                return;
            }

            const flags = buffer.flags || {};
            unread += Number(flags.unread) || 0;
            if (flags.highlight) {
                highlights++;
            }
            if (flags.error) {
                errors++;
            }
        });
    });

    return { unread, highlights, errors };
}
