const GIF_PATTERN = /(\d+)-(\d+)\|([^|]*)\|(.+?)(?=,\d+-\d+\|[^|]*\||$)/g;

export const TWITCH_PREFIXES = [
    { symbol: '~', mode: 'q' },
    { symbol: '@', mode: 'o' },
    { symbol: '%', mode: 'h' },
    { symbol: '+', mode: 'v' },
];

export function isTwitchHost(server) {
    return /(^|\.)twitch\.tv$/i.test(server || '');
}

export function twitchChannelUrl(channelName) {
    const name = String(channelName || '').trim().replace(/^[#&]/, '');
    return name ? `https://twitch.tv/${encodeURIComponent(name)}` : '';
}

function parseGifs(value) {
    const gifs = [];
    let match;

    GIF_PATTERN.lastIndex = 0;
    while ((match = GIF_PATTERN.exec(value)) !== null) {
        gifs.push({
            start: Number(match[1]),
            end: Number(match[2]),
            url: match[4],
        });

        if (match.index === GIF_PATTERN.lastIndex) {
            GIF_PATTERN.lastIndex++;
        }
    }

    return gifs;
}

export function formatTwitchMessage(text, tags) {
    if (!text || !tags) {
        return text;
    }

    const replacements = [];
    const addReplacement = (start, end, replacement) => {
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
            return;
        }
        if (start < 0 || end < start || end >= text.length) {
            return;
        }

        replacements.push({ start, end, replacement });
    };

    if (tags.emotes) {
        tags.emotes.split('/').forEach((emote) => {
            const separator = emote.indexOf(':');
            if (separator === -1) {
                return;
            }

            emote.slice(separator + 1).split(',').forEach((range) => {
                const match = /^(\d+)-(\d+)$/.exec(range.trim());
                if (!match) {
                    return;
                }

                const start = Number(match[1]);
                const end = Number(match[2]);
                const emoteText = text.slice(start, end + 1);
                if (emoteText) {
                    addReplacement(start, end, `:${emoteText}:`);
                }
            });
        });
    }

    if (tags.gifs) {
        parseGifs(tags.gifs).forEach((gif) => {
            addReplacement(gif.start, gif.end, gif.url);
        });
    }

    if (replacements.length === 0) {
        return text;
    }

    let output = text;
    let lastStart = text.length + 1;
    replacements
        .sort((a, b) => b.start - a.start)
        .forEach((replacement) => {
            // Ignore duplicate or overlapping ranges.
            if (replacement.end >= lastStart) {
                return;
            }

            output = output.slice(0, replacement.start) +
                replacement.replacement +
                output.slice(replacement.end + 1);
            lastStart = replacement.start;
        });

    return output;
}

export function twitchMessageTime(tags) {
    const timestamp = Number(tags && tags['tmi-sent-ts']);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return null;
    }

    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function isTwitchRerouted(tags) {
    if (!tags || !tags['source-room-id'] || !tags['room-id']) {
        return false;
    }

    return tags['source-room-id'] !== tags['room-id'];
}

export function isTwitchUserMessage(event) {
    return !!event &&
        !!event.nick &&
        !event.from_server &&
        (event.type === 'privmsg' || event.type === 'action');
}

export function twitchUserModes(nick, channelName, tags) {
    const modes = [];
    if (!nick || !channelName || !tags) {
        return modes;
    }

    const channelNick = channelName.replace(/^[#&]/, '').toLowerCase();
    if (nick.toLowerCase() === channelNick) {
        modes.push('q');
    }
    if (tags.mod === '1') {
        modes.push('o');
    }
    if (tags.vip === '1') {
        modes.push('h');
    }
    if (tags.subscriber === '1') {
        modes.push('v');
    }

    return modes;
}

export const TWITCH_USER_NOTICE_TYPES = {
    sub: {
        key: 'sub',
        icon: 'fa-star',
        labelKey: 'twitch_usernotice_sub',
        accent: '#9146ff',
    },
    resub: {
        key: 'resub',
        icon: 'fa-star',
        labelKey: 'twitch_usernotice_resub',
        accent: '#9146ff',
    },
    subgift: {
        key: 'subgift',
        icon: 'fa-gift',
        labelKey: 'twitch_usernotice_subgift',
        accent: '#e9196b',
    },
    submysterygift: {
        key: 'submysterygift',
        icon: 'fa-gift',
        labelKey: 'twitch_usernotice_submysterygift',
        accent: '#e9196b',
    },
    giftpaidupgrade: {
        key: 'giftpaidupgrade',
        icon: 'fa-gift',
        labelKey: 'twitch_usernotice_giftpaidupgrade',
        accent: '#e9196b',
    },
    rewardgift: {
        key: 'rewardgift',
        icon: 'fa-gift',
        labelKey: 'twitch_usernotice_rewardgift',
        accent: '#e9196b',
    },
    anongiftpaidupgrade: {
        key: 'anongiftpaidupgrade',
        icon: 'fa-gift',
        labelKey: 'twitch_usernotice_anongiftpaidupgrade',
        accent: '#e9196b',
    },
    raid: {
        key: 'raid',
        icon: 'fa-rocket',
        labelKey: 'twitch_usernotice_raid',
        accent: '#ff6a00',
    },
    unraid: {
        key: 'unraid',
        icon: 'fa-reply',
        labelKey: 'twitch_usernotice_unraid',
        accent: '#6b7280',
    },
    bitsbadgetier: {
        key: 'bitsbadgetier',
        icon: 'fa-diamond',
        labelKey: 'twitch_usernotice_bitsbadgetier',
        accent: '#00a3ff',
    },
    sharedchatnotice: {
        key: 'sharedchatnotice',
        icon: 'fa-comments',
        labelKey: 'twitch_usernotice_sharedchatnotice',
        accent: '#00b8a9',
    },
    modiversary: {
        key: 'modiversary',
        icon: 'fa-shield',
        labelKey: 'twitch_usernotice_modiversary',
        accent: '#21a179',
    },
    viewermilestone: {
        key: 'viewermilestone',
        icon: 'fa-trophy',
        labelKey: 'twitch_usernotice_viewermilestone',
        accent: '#e0a800',
    },
    event: {
        key: 'event',
        icon: 'fa-bell',
        labelKey: 'twitch_usernotice_event',
        accent: '#8b5cf6',
    },
};

export function twitchUserNoticeType(msgId) {
    const key = (msgId || '').toLowerCase();
    return TWITCH_USER_NOTICE_TYPES[key] || TWITCH_USER_NOTICE_TYPES.event;
}

function addUserNoticeDetail(details, labelKey, value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return;
    }

    details.push({
        labelKey,
        value: String(value),
    });
}

function addUserNoticeNumber(details, labelKey, value) {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number) || number <= 0) {
        return;
    }

    details.push({
        labelKey,
        value: String(number),
    });
}

export function twitchUserNoticeDetails(tags, msgId) {
    const details = [];
    if (!tags) {
        return details;
    }

    if (tags['msg-param-sub-plan-name']) {
        addUserNoticeDetail(
            details,
            'twitch_usernotice_plan',
            tags['msg-param-sub-plan-name']
        );
    } else if (tags['msg-param-sub-plan'] === 'Prime') {
        details.push({
            labelKey: 'twitch_usernotice_plan',
            valueKey: 'twitch_usernotice_prime',
        });
    } else if (['1000', '2000', '3000'].includes(tags['msg-param-sub-plan'])) {
        details.push({
            labelKey: 'twitch_usernotice_tier',
            valueKey: 'twitch_usernotice_tier_value',
            valueParams: {
                tier: Number(tags['msg-param-sub-plan']) / 1000,
            },
        });
    }

    addUserNoticeNumber(
        details,
        'twitch_usernotice_total_months',
        tags['msg-param-cumulative-months']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_months',
        tags['msg-param-months']
    );

    if (tags['msg-param-should-share-streak'] === '1') {
        addUserNoticeNumber(
            details,
            'twitch_usernotice_streak',
            tags['msg-param-streak-months']
        );
    }

    addUserNoticeDetail(
        details,
        'twitch_usernotice_recipient',
        tags['msg-param-recipient-display-name'] ||
            tags['msg-param-recipient-user-name']
    );
    addUserNoticeDetail(
        details,
        'twitch_usernotice_sender',
        tags['msg-param-sender-name'] || tags['msg-param-sender-login']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_viewers',
        tags['msg-param-viewerCount']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_bits',
        tags['msg-param-threshold']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_gift_months',
        tags['msg-param-gift-months']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_gift_count',
        tags['msg-param-mass-gift-count']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_gifts_sent',
        tags['msg-param-sender-count']
    );
    addUserNoticeDetail(
        details,
        'twitch_usernotice_promo',
        tags['msg-param-promo-name']
    );
    addUserNoticeNumber(
        details,
        'twitch_usernotice_gift_total',
        tags['msg-param-promo-gift-total']
    );

    if ((msgId || '').toLowerCase() === 'viewermilestone') {
        if (tags['msg-param-category'] === 'watch-streak') {
            addUserNoticeNumber(
                details,
                'twitch_usernotice_watch_streak',
                tags['msg-param-value']
            );
        } else {
            addUserNoticeDetail(
                details,
                'twitch_usernotice_category',
                tags['msg-param-category']
            );
            addUserNoticeDetail(
                details,
                'twitch_usernotice_value',
                tags['msg-param-value']
            );
        }
    }

    return details;
}
