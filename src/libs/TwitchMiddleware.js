import * as TextFormatting from '@/helpers/TextFormatting';
import { formatTwitchMessage, twitchMessageTime } from '@/helpers/Twitch';
import TwitchUserNotice from '@/components/TwitchUserNotice';

const TWITCH_COMMANDS = [
    'CLEARCHAT',
    'CLEARMSG',
    'GLOBALUSERSTATE',
    'RECONNECT',
    'ROOMSTATE',
    'USERNOTICE',
    'USERSTATE',
];

const TWITCH_NOTICE_ERROR_PREFIXES = [
    'msg_',
    'bad_',
    'whisper_',
    'usage_',
    'already_',
];

const TWITCH_NOTICE_ERROR_IDS = [
    'tos_ban',
    'unrecognized_cmd',
];

export function isTwitchNoticeError(msgId) {
    if (!msgId) {
        return false;
    }

    const id = msgId.toLowerCase();
    return TWITCH_NOTICE_ERROR_IDS.includes(id) ||
        TWITCH_NOTICE_ERROR_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function twitchChatMessages(buffer) {
    if (!buffer || !buffer.messagesObj) {
        return [];
    }
    return buffer.messagesObj.messages || [];
}

function twitchBufferFor(network, message) {
    const channel = (message.params || [])[0];
    return channel ? network.bufferByName(channel) : undefined;
}

const twitchRoomStates = new WeakMap();

function twitchRoomStateFor(buffer) {
    let state = twitchRoomStates.get(buffer);
    if (!state) {
        state = {
            emoteOnly: false,
            followersOnly: -1,
            r9k: false,
            slow: 0,
            subsOnly: false,
            roomId: '',
            lastSignature: '',
        };
        twitchRoomStates.set(buffer, state);
    }
    return state;
}

function mergeRoomState(state, tags) {
    if (typeof tags['emote-only'] !== 'undefined') {
        state.emoteOnly = tags['emote-only'] === '1';
    }
    if (typeof tags['followers-only'] !== 'undefined') {
        const value = parseInt(tags['followers-only'], 10);
        state.followersOnly = Number.isFinite(value) ? value : -1;
    }
    if (typeof tags.r9k !== 'undefined') {
        state.r9k = tags.r9k === '1';
    }
    if (typeof tags.slow !== 'undefined') {
        const value = parseInt(tags.slow, 10);
        state.slow = Number.isFinite(value) ? value : 0;
    }
    if (typeof tags['subs-only'] !== 'undefined') {
        state.subsOnly = tags['subs-only'] === '1';
    }
    if (typeof tags['room-id'] !== 'undefined') {
        state.roomId = tags['room-id'];
    }
}

function twitchRoomStateSignature(state) {
    return [
        state.emoteOnly ? '1' : '0',
        state.followersOnly,
        state.slow,
        state.subsOnly ? '1' : '0',
        state.r9k ? '1' : '0',
    ].join('|');
}

function twitchRoomModeText(state) {
    const modes = [];

    if (state.emoteOnly) {
        modes.push(TextFormatting.t('twitch_roomstate_emote_only'));
    }
    if (state.followersOnly === 0) {
        modes.push(TextFormatting.t('twitch_roomstate_followers_only'));
    } else if (state.followersOnly > 0) {
        modes.push(TextFormatting.t('twitch_roomstate_followers_only_minutes', {
            minutes: state.followersOnly,
        }));
    }
    if (state.slow > 0) {
        modes.push(TextFormatting.t('twitch_roomstate_slow', {
            seconds: state.slow,
        }));
    }
    if (state.subsOnly) {
        modes.push(TextFormatting.t('twitch_roomstate_subs_only'));
    }
    if (state.r9k) {
        modes.push(TextFormatting.t('twitch_roomstate_r9k'));
    }

    if (modes.length === 0) {
        return TextFormatting.t('twitch_roomstate_none');
    }

    return TextFormatting.t('twitch_roomstate', {
        modes: modes.join(', '),
    });
}

function handleRoomState(network, message, tags) {
    const buffer = twitchBufferFor(network, message);
    if (!buffer) {
        return;
    }

    const state = twitchRoomStateFor(buffer);
    mergeRoomState(state, tags);

    const text = twitchRoomModeText(state);
    const signature = twitchRoomStateSignature(state);
    const changed = signature !== state.lastSignature;
    let addedMessage;

    if (changed) {
        state.lastSignature = signature;
        addedMessage = network.appState.addMessage(buffer, {
            time: Date.now(),
            nick: '',
            message: TextFormatting.formatText('mode', { text }),
            type: 'mode',
            type_extra: 'twitch_roomstate',
        });
    }

    network.appState.$emit('twitch.roomstate', {
        network,
        buffer,
        state,
        tags,
        message: addedMessage,
        changed,
    });
}

function redactTwitchMessage(network, buffer, message, reason) {
    if (!message || message.is_redacted) {
        return;
    }

    message.is_redacted = true;
    message.redacted_by = 'Twitch';
    message.redaction_reason = reason;
    network.appState.$emit('message.redaction', {
        message,
        buffer,
    });
}

function twitchBanReason(tags) {
    const duration = parseInt(tags['ban-duration'], 10);
    if (Number.isFinite(duration) && duration > 0) {
        return `Timed out for ${duration} seconds`;
    }
    return 'Banned';
}

function handleClearChat(network, message, tags) {
    const buffer = twitchBufferFor(network, message);
    if (!buffer) {
        return;
    }

    const params = message.params || [];
    const targetUserId = tags['target-user-id'];
    const targetNick = (params[1] || '').replace(/^:/, '').toLowerCase();
    const hasTarget = !!(targetUserId || targetNick);
    const reason = hasTarget ? twitchBanReason(tags) : 'Chat cleared';

    twitchChatMessages(buffer).forEach((chatMessage) => {
        if (!chatMessage || (chatMessage.type !== 'privmsg' && chatMessage.type !== 'action')) {
            return;
        }

        if (targetUserId) {
            const matchesUserId = chatMessage.tags &&
                chatMessage.tags['user-id'] === targetUserId;
            const matchesNick = targetNick &&
                (chatMessage.nick || '').toLowerCase() === targetNick;
            if (!matchesUserId && !matchesNick) {
                return;
            }
        } else if (targetNick) {
            if ((chatMessage.nick || '').toLowerCase() !== targetNick) {
                return;
            }
        }

        redactTwitchMessage(network, buffer, chatMessage, reason);
    });

    network.appState.$emit('twitch.clearchat', {
        network,
        buffer,
        targetUserId,
        targetNick,
        tags,
    });
}

function handleClearMessage(network, message, tags) {
    const buffer = twitchBufferFor(network, message);
    const targetMsgId = tags['target-msg-id'];
    if (!buffer || !targetMsgId) {
        return;
    }

    const messageIds = buffer.messagesObj.messageIds || {};
    const targetMessage = messageIds[targetMsgId] ||
        twitchChatMessages(buffer).find((chatMessage) => chatMessage.irc_id === targetMsgId);
    if (targetMessage) {
        redactTwitchMessage(network, buffer, targetMessage, 'Message deleted');
    }

    network.appState.$emit('twitch.clearmsg', {
        network,
        buffer,
        targetMsgId,
        message: targetMessage,
        tags,
    });
}

export function addTwitchUserNotice(network, buffer, tags, body = '') {
    if (!network || !buffer || !tags) {
        return undefined;
    }

    const time = twitchMessageTime(tags) || new Date();
    const nick = tags.login || '';
    if (nick) {
        network.ensureTwitchUser(nick, nick, '', tags);
    }
    const msgId = (tags['msg-id'] || 'event').toLowerCase();
    const noticeMessage = {
        time,
        server_time: time,
        nick,
        message: formatTwitchMessage(body, tags),
        raw_text: body,
        type: 'twitch_usernotice',
        type_extra: msgId,
        tags,
        irc_id: tags.id,
        template: TwitchUserNotice,
    };

    const added = network.appState.addMessage(buffer, noticeMessage);

    network.appState.$emit('twitch.usernotice', {
        network,
        buffer,
        message: added || noticeMessage,
        tags,
        msgId,
    });

    return added || noticeMessage;
}

function handleUserNotice(network, message, tags) {
    const buffer = twitchBufferFor(network, message);
    if (!buffer) {
        return;
    }

    addTwitchUserNotice(network, buffer, tags, (message.params || [])[1] || '');
}

export default function twitchMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        parsedEvents.use(theMiddleware.bind(null, network));
    };
}

export function theMiddleware(network, command, message, client, next) {
    if (!message) {
        if (next) {
            next();
        }
        return;
    }

    const effectiveCommand = (command === 'unknown command' && message.command) ?
        message.command.toUpperCase() :
        command.toUpperCase();

    if (!TWITCH_COMMANDS.includes(effectiveCommand)) {
        if (next) {
            next();
        }
        return;
    }

    if (!network.hasTwitchCommands()) {
        if (next) {
            next();
        }
        return;
    }

    const tags = message.tags || {};

    if (effectiveCommand === 'GLOBALUSERSTATE' || effectiveCommand === 'USERSTATE') {
        const isGlobal = effectiveCommand === 'GLOBALUSERSTATE';
        const bufferName = isGlobal ? null : (message.params || [])[0];
        const buffer = bufferName ? network.bufferByName(bufferName) : undefined;
        const user = network.userByTwitchId(tags['user-id']) || network.currentUser();
        if (user) {
            network.applyTwitchUserTags(user, tags);
            if (buffer) {
                network.applyTwitchUserModes(buffer, user, tags);
            }
        }

        network.appState.$emit(isGlobal ? 'twitch.globaluserstate' : 'twitch.userstate', {
            network,
            buffer,
            user,
            tags,
        });
        return;
    }

    if (effectiveCommand === 'ROOMSTATE') {
        handleRoomState(network, message, tags);
        return;
    }

    if (effectiveCommand === 'CLEARCHAT') {
        handleClearChat(network, message, tags);
        return;
    }

    if (effectiveCommand === 'CLEARMSG') {
        handleClearMessage(network, message, tags);
        return;
    }

    if (effectiveCommand === 'RECONNECT') {
        const connection = network.ircClient && network.ircClient.connection;
        if (connection) {
            // Twitch asks us to reconnect before it closes the socket. Allow this
            // one reconnect even when the user has disabled automatic reconnects.
            connection.auto_reconnect = true;
        }

        network.appState.$emit('twitch.reconnect', {
            network,
            message,
        });
        return;
    }

    handleUserNotice(network, message, tags);
}
