/** @module */

import Vue from 'vue';
import { def } from './common';
import batchedAdd from '../batchedAdd';
import * as bufferTools from '../bufferTools';
import * as TextFormatting from '@/helpers/TextFormatting';
import * as Reactions from '@/helpers/Reactions';
import * as Misc from '@/helpers/Misc';
import { TWITCH_PREFIXES, twitchChannelUrl, twitchUserModes } from '@/helpers/Twitch';
import { each, find } from '@/helpers/Utils';

let nextBufferId = 0;

const HISTORY_MAX_RETRIES = 3;
const HISTORY_RETRY_BASE_MS = 3000;
const HISTORY_RETRY_MAX_MS = 12000;
const READ_MARKER_THROTTLE_MS = 1000;
const READ_MARKER_CONFIRM_TIMEOUT_MS = 15000;
const CHAT_MESSAGE_TYPES = ['privmsg', 'notice', 'action', 'message'];

function hasServerTimestamp(message) {
    return !!message &&
        !!message.server_time &&
        !!message.tags &&
        typeof message.tags.time !== 'undefined';
}

function buildMessageReference(message, refTypes) {
    if (!message) {
        return null;
    }

    if (refTypes.includes('msgid') && message.irc_id) {
        return message.irc_id;
    }

    if (refTypes.includes('timestamp') && hasServerTimestamp(message)) {
        return new Date(message.server_time);
    }

    return null;
}

function historyMessageTime(message) {
    return (message && (message.server_time || message.time)) || 0;
}

/** The IRC buffer instance */
export default class BufferState {
    constructor(name, networkid, state, messageDict) {
        // Enumerable properties that become reactive under Vue
        this.id = nextBufferId++;
        this.networkid = networkid;
        this.name = name;
        this.topics = [];
        this.topic_by = '';
        this.topic_when = 0;
        this.key = '';
        this.joined = false;
        this.enabled = true;
        this.created_at = null;
        this.users = Object.create(null);
        this.modes = Object.create(null);
        this.flags = {
            unread: 0,
            highlight: false,
            has_opened: false,
            channel_badkey: false,
            chathistory_available: true,
            requested_modes: false,
            requested_banlist: false,
            requested_invitelist: false,
            is_visible: false,
            is_requesting_chathistory: false,
            error: false,
            last_read_authoritative: 0,
            names_received: false,
            marker_received: false,
            motd_history_done: false,
            context_loading: false,
            context_has_older: false,
            context_has_newer: false,
        };
        this.settings = { };
        this.metadata = {};
        this.lastMetadataFetch = 0;
        this.last_read = 0;
        this.active_tab = null;
        this.active_timeout = null;
        this.message_count = 0;
        this.current_input = '';
        this.input_history = [];
        this.input_history_pos = 0;
        this.show_input = true;
        this.latest_messages = [];
        this.replying_to = null;
        this.historySegments = [];
        this.historyGaps = [];
        this.historyGapExhausted = {};
        this.contextOnly = false;
        this.contextTarget = '';
        this.contextOlderRowId = 0;
        this.contextNewerRowId = 0;

        // Counter for chathistory requests. While this value is 0, it means that this buffer is
        // still loading messages
        this.chathistory_request_count = 0;

        Vue.observable(this);

        // Some non-enumerable properties (vues $watch won't cover these properties)
        def(this, 'state', state, false);
        def(this, 'messageDict', messageDict, false);

        let messagesObj = {
            networkid: this.networkid,
            buffer: this.name,
            messages: [],
            messageIds: Object.create(null),
            messageLabels: Object.create(null),
            pendingReactions: Object.create(null),
            pendingRedactions: Object.create(null),
        };
        this.messageDict.push(messagesObj);
        def(this, 'messagesObj', messagesObj, false);

        def(this, 'isMessageTrimming', true, true);
        def(this, 'historyJumpTarget', null, true);
        def(this, 'historyContextLoading', false, true);
        def(this, 'contextRowIds', Object.create(null), false);
        def(this, 'addMessageBatch', createMessageBatch(this), false);
        def(this, 'addUserBatch', createUserBatch(this), false);
        def(this, 'chathistory_retry_timeout', null, true);
        def(this, 'chathistory_pending_requests', 0, true);
        def(this, 'read_marker_timeout', null, true);
        def(this, 'read_marker_pending', null, true);
        def(this, 'read_marker_pending_timer', null, true);

        // poll who to update away status if away-notify is not enabled
        if (this.isChannel() || this.isQuery()) {
            maybeStartWhoLoop(this);
        }

        // When the network re-connects, we reset the chathistory request counter.
        // This will make the `getLoadingState()` stay as 'loading' while the chathistory reloads.
        function onNetworkConnecting(event) {
            if (event.network === this.getNetwork()) {
                this.resetHistoryForReconnect();
            }
        }

        function onNetworkMotd(event, network) {
            if (network === this.getNetwork() && !this.flags.motd_history_done) {
                this.flags.motd_history_done = true;
                this.initHistory();
            }
        }

        // Clean up the previous event and itself when the buffer is closed.
        function onBufferClose(event) {
            if (event.buffer === this) {
                if (this.active_timeout) {
                    clearTimeout(this.active_timeout);
                    this.active_timeout = null;
                }
                this.clearHistoryRetry();
                this.clearReadMarkerTimeout();
                this.clearReadMarkerPending();
                this.state.$off('network.connecting', onNetworkConnectingBound);
                this.state.$off('buffer.close', onBufferCloseBound);
                this.state.$off('irc.motd', onNetworkMotdBound);
            }
        }

        const onNetworkConnectingBound = onNetworkConnecting.bind(this);
        const onBufferCloseBound = onBufferClose.bind(this);
        const onNetworkMotdBound = onNetworkMotd.bind(this);

        state.$on('network.connecting', onNetworkConnectingBound);
        state.$on('buffer.close', onBufferCloseBound);
        state.$on('irc.motd', onNetworkMotdBound);

        if (this.getNetwork()?.state === 'connected') {
            this.initHistory();
            this.flags.motd_history_done = true;
        }
    }

    resetHistoryForReconnect() {
        if (this.active_timeout) {
            clearTimeout(this.active_timeout);
            this.active_timeout = null;
        }
        this.chathistory_pending_requests = 0;
        this.clearHistoryRetry();
        this.clearReadMarkerTimeout();
        this.clearReadMarkerPending();
        this.chathistory_request_count = 0;
        this.flags.is_requesting_chathistory = false;
        this.flags.chathistory_available = true;
        this.flags.names_received = false;
        this.flags.marker_received = false;
        this.flags.motd_history_done = false;
    }

    clearReadMarkerTimeout() {
        if (this.read_marker_timeout) {
            clearTimeout(this.read_marker_timeout);
            this.read_marker_timeout = null;
        }
    }

    clearReadMarkerPending() {
        if (this.read_marker_pending_timer) {
            clearTimeout(this.read_marker_pending_timer);
            this.read_marker_pending_timer = null;
        }
        this.read_marker_pending = null;
    }

    clearHistoryRetry() {
        if (this.chathistory_retry_timeout) {
            clearTimeout(this.chathistory_retry_timeout);
            this.chathistory_retry_timeout = null;
        }
        this.updateHistoryLoadingState();
    }

    updateHistoryLoadingState() {
        this.flags.is_requesting_chathistory =
            this.chathistory_pending_requests > 0 ||
            !!this.chathistory_retry_timeout;
    }

    initHistory() {
        const network = this.getNetwork();
        if (!network) {
            return;
        }

        const ircClient = network.ircClient;
        const hasReadMarker = network.hasCap('draft/read-marker');

        if (this.isQuery()) {
            if (hasReadMarker) {
                // For queries, we wait for the MARKREAD echo to establish the boundary.
                // Request the current marker now using the middleware helper.
                ircClient.readMarker.get(this.name);

                // Safety fallback timer (2 seconds) for the marker handshake
                setTimeout(() => {
                    if (!this.flags.marker_received) {
                        this.flags.marker_received = true;
                        this.maybeRequestHistory();
                    }
                }, 2000);
            } else {
                // Fallback for servers without read-marker support.
                this.flags.marker_received = true;
                this.maybeRequestHistory();
            }
            this.initUserStatus();
        } else if (this.isChannel()) {
            // For channels, we rely on the network-wide isReadyForHistory signal,
            // which depends on names_received.
        }
    }

    maybeRequestHistory() {
        const network = this.getNetwork();
        if (!network || this.chathistory_request_count > 0) {
            return;
        }

        const hasChathistory = network.ircClient.chathistory.isSupported();
        if (!hasChathistory) {
            return;
        }

        // We only request history when the entire network is ready (all member lists populated)
        // to ensure that security guards (+channel-context, block_pms) have full context.
        if (!network.isReadyForHistory) {
            return;
        }

        const autoHistory = this.setting('auto_request_history');
        let shouldRequest = false;

        if (this.isChannel()) {
            // All channels are ready because network.isReadyForHistory is true
            shouldRequest = ['all', 'channels'].includes(autoHistory);
        } else if (this.isQuery() && this.flags.marker_received) {
            shouldRequest = ['all', 'queries'].includes(autoHistory);
        }

        if (shouldRequest) {
            this.requestLatestScrollback();
        }
    }

    initUserStatus() {
        const network = this.getNetwork();
        if (!network || !this.isQuery() || network.isTwitch()) {
            return;
        }

        // Fetch metadata for the query partner (away status, realname, host)
        network.ircClient.who(this.name);
    }

    get topic() {
        if (this.topics[0]) {
            return this.topics[0];
        }

        const network = this.getNetwork();
        if (network && this.isChannel() && network.isTwitch()) {
            return twitchChannelUrl(this.name);
        }

        return '';
    }

    set topic(newVal) {
        const maxLength = 5;
        this.topics.unshift(newVal);
        if (this.topics.length > maxLength) {
            this.topics.length = maxLength;
        }
    }

    get isVisible() {
        return this.flag('is_visible');
    }

    set isVisible(_newVal) {
        let newVal = _newVal;

        if (this.active_tab && this.active_tab !== 'messages') {
            // Prevent newVal from being true if we are on a tabbed buffer
            // and the active tab is not 'messages'
            newVal = false;
        }

        this.flag('is_visible', newVal);

        if (newVal) {
            this.flag('unread', 0);
            this.flag('highlight', false);
            this.flag('error', false);
            this.markAsRead(true);

            return;
        }

        // Buffer is no longer visible
        if (this.active_timeout || this.read_marker_timeout) {
            this.markAsRead(false);
        }
    }

    getNetwork() {
        return this.state.getNetwork(this.networkid);
    }

    avatarUrl(size = 64) {
        const iconToken = this.metadata.avatar;
        if (!iconToken || typeof iconToken !== 'string') {
            return '';
        }

        const sanitized = Misc.sanitizeUrl(iconToken);
        return sanitized.replace('{size}', size.toString());
    }

    getMessages() {
        let bufMessages = find(this.messageDict, {
            networkid: this.networkid,
            buffer: this.name,
        });

        return bufMessages ?
            bufMessages.messages :
            [];
    }

    allMessages() {
        return this.getMessages().concat(this.addMessageBatch.queue());
    }

    getLastMessage() {
        let messages = this.getMessages();
        if (messages.length === 0) {
            return undefined;
        }
        return messages[messages.length - 1];
    }

    findLogResultMessage(result = {}) {
        if (!result) {
            return null;
        }
        if (result.irc_id && this.messagesObj.messageIds[result.irc_id]) {
            return this.messagesObj.messageIds[result.irc_id];
        }

        const serverTime = Number(result.server_time) || 0;
        const localTime = Number(result.time) || 0;
        const wantedRaw = result.raw_text || result.message || '';

        return this.allMessages().find((message) => {
            const time = historyMessageTime(message);
            if (serverTime && message.server_time && message.server_time !== serverTime) {
                return false;
            }
            if (!serverTime && localTime && Math.abs(time - localTime) > 2000) {
                return false;
            }
            if (result.nick && message.nick !== result.nick) {
                return false;
            }
            if (wantedRaw &&
                message.raw_text !== wantedRaw &&
                message.message !== result.message
            ) {
                return false;
            }
            return true;
        }) || null;
    }

    historyReferenceForResult(result = {}) {
        const history = this.getNetwork()?.ircClient?.chathistory;
        if (!history) {
            return null;
        }

        const refTypes = history.supportedRefTypes();
        if (refTypes.includes('msgid') && result.irc_id) {
            return result.irc_id;
        }
        if (refTypes.includes('timestamp')) {
            const time = Number(result.server_time) || Number(result.time) || 0;
            if (time) {
                return new Date(time);
            }
        }
        return null;
    }

    historyReferenceForMessage(message) {
        const history = this.getNetwork()?.ircClient?.chathistory;
        if (!history || !message) {
            return null;
        }

        const refTypes = history.supportedRefTypes();
        if (refTypes.includes('msgid') && message.irc_id) {
            return message.irc_id;
        }
        if (refTypes.includes('timestamp') && message.server_time) {
            return new Date(message.server_time);
        }
        return null;
    }

    addHistorySegment(segment = {}) {
        const start = Number(segment.start);
        const end = Number(segment.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return;
        }

        const next = this.historySegments
            .map((item) => ({ ...item }))
            .concat({
                start: Math.min(start, end),
                end: Math.max(start, end),
                firstId: segment.firstId || '',
                lastId: segment.lastId || '',
                kind: segment.kind || 'history',
            })
            .sort((a, b) => (a.start - b.start) || (a.end - b.end));

        const merged = [];
        next.forEach((item) => {
            const last = merged[merged.length - 1];
            if (last && item.start <= last.end) {
                if (item.end > last.end) {
                    last.end = item.end;
                    last.lastId = item.lastId || last.lastId;
                }
                if (item.start < last.start) {
                    last.start = item.start;
                    last.firstId = item.firstId || last.firstId;
                }
                if (!last.firstId) {
                    last.firstId = item.firstId;
                }
                if (item.kind === 'live') {
                    last.kind = 'live';
                }
            } else {
                merged.push({ ...item });
            }
        });

        this.historySegments = merged;
        this.refreshHistoryGaps();
    }

    refreshHistoryGaps() {
        const segments = this.historySegments
            .slice()
            .sort((a, b) => (a.start - b.start) || (a.end - b.end));
        const gaps = [];

        for (let i = 1; i < segments.length; i++) {
            const older = segments[i - 1];
            const newer = segments[i];
            if (older.end < newer.start) {
                const key = `${older.start}:${older.end}:${newer.start}:${newer.end}`;
                gaps.push({
                    key,
                    older,
                    newer,
                    from: older.end,
                    to: newer.start,
                    exhaustedOlder: !!this.historyGapExhausted[`${key}:older`],
                    exhaustedNewer: !!this.historyGapExhausted[`${key}:newer`],
                });
            }
        }

        this.historyGaps = gaps;
    }

    connectHistoryWindow(segment, direction) {
        const sorted = this.historySegments
            .slice()
            .sort((a, b) => a.start - b.start);
        let adjacent = null;

        if (direction === 'before') {
            adjacent = sorted.find((item) => item.start >= segment.end);
        } else if (direction === 'after') {
            adjacent = sorted.slice().reverse().find((item) => item.end <= segment.start);
        }

        if (!adjacent) {
            this.addHistorySegment(segment);
            return;
        }

        const merged = direction === 'before' ?
            {
                start: segment.start,
                end: adjacent.end,
                firstId: segment.firstId,
                lastId: adjacent.lastId,
                kind: adjacent.kind,
            } :
            {
                start: adjacent.start,
                end: segment.end,
                firstId: adjacent.firstId,
                lastId: segment.lastId,
                kind: adjacent.kind,
            };

        this.historySegments = this.historySegments.filter((item) => (
            item !== adjacent
        ));
        this.addHistorySegment(merged);
    }

    noteHistoryWindow(start, end, direction = 'around') {
        const from = Number(start);
        const to = Number(end);
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
            return;
        }

        const messages = this.allMessages().filter((message) => {
            const time = historyMessageTime(message);
            return time >= Math.min(from, to) && time <= Math.max(from, to);
        });
        if (!messages.length) {
            return;
        }

        const sorted = messages.slice().sort((a, b) => (
            historyMessageTime(a) - historyMessageTime(b)
        ));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const segment = {
            start: historyMessageTime(first),
            end: historyMessageTime(last),
            firstId: first.id,
            lastId: last.id,
            kind: 'history',
        };

        if (direction === 'before' || direction === 'after') {
            this.connectHistoryWindow(segment, direction);
        } else {
            this.addHistorySegment(segment);
        }
    }

    noteLiveMessage(message) {
        if (!message || message.is_history) {
            return;
        }

        const time = historyMessageTime(message);
        if (!time) {
            return;
        }

        const live = this.historySegments.find((segment) => segment.kind === 'live');
        if (!live) {
            this.addHistorySegment({
                start: time,
                end: time,
                firstId: message.id,
                lastId: message.id,
                kind: 'live',
            });
            return;
        }

        live.start = Math.min(live.start, time);
        live.end = Math.max(live.end, time);
        live.firstId = live.firstId || message.id;
        live.lastId = message.id;
        this.historySegments = this.historySegments
            .slice()
            .sort((a, b) => (a.start - b.start) || (a.end - b.end));
        this.refreshHistoryGaps();
    }

    syncHistorySegments() {
        const messages = this.allMessages();
        const next = [];

        this.historySegments.forEach((segment) => {
            const inRange = messages.filter((message) => {
                const time = historyMessageTime(message);
                return time >= segment.start && time <= segment.end;
            });
            if (!inRange.length) {
                return;
            }

            const sorted = inRange.slice().sort((a, b) => (
                historyMessageTime(a) - historyMessageTime(b)
            ));
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            next.push({
                ...segment,
                start: historyMessageTime(first),
                end: historyMessageTime(last),
                firstId: first.id,
                lastId: last.id,
            });
        });

        this.historySegments = next;
        this.refreshHistoryGaps();
    }

    markHistoryGapExhausted(gap, direction) {
        if (!gap || !gap.key) {
            return;
        }
        Vue.set(this.historyGapExhausted, `${gap.key}:${direction}`, true);
        this.refreshHistoryGaps();
    }

    requestHistoryGap(gap, direction) {
        const history = this.getNetwork()?.ircClient?.chathistory;
        if (!history || !history.isSupported() || this.historyContextLoading) {
            return Promise.resolve(false);
        }

        const boundaryId = direction === 'older' ?
            gap.newer.firstId :
            gap.older.lastId;
        const boundary = boundaryId ? this.messagesObj.messageIds[boundaryId] : null;
        const ref = this.historyReferenceForMessage(boundary);
        if (!ref) {
            return Promise.resolve(false);
        }

        const func = direction === 'older' ? 'before' : 'after';
        const beforeCount = this.allMessages().length;
        this.historyContextLoading = true;
        this.isMessageTrimming = false;

        return getBufferHistory(this, func, ref)
            .then(() => {
                const added = this.allMessages().length > beforeCount;
                if (!added && !this.chathistory_retry_timeout) {
                    this.markHistoryGapExhausted(gap, direction);
                }
                this.syncHistorySegments();
                return added;
            })
            .catch(() => false)
            .finally(() => {
                this.historyContextLoading = false;
            });
    }

    waitForTargetMessage(result, attempt = 0) {
        const target = this.findLogResultMessage(result);
        if (target && this.messagesObj.messageIds[target.id]) {
            return Promise.resolve(target);
        }

        if (!this.addMessageBatch.queue().length || attempt >= 20) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.waitForTargetMessage(result, attempt + 1));
            }, 100);
        });
    }

    jumpToMessage(result = {}) {
        const loaded = this.findLogResultMessage(result);
        if (loaded) {
            this.state.$nextTick(() => this.scrollToMessage(loaded.id));
            return Promise.resolve(true);
        }

        const history = this.getNetwork()?.ircClient?.chathistory;
        if (!history || !history.isSupported() || this.historyContextLoading) {
            return Promise.resolve(false);
        }

        const ref = this.historyReferenceForResult(result);
        if (!ref) {
            return Promise.resolve(false);
        }

        this.historyJumpTarget = result;
        this.historyContextLoading = true;
        this.isMessageTrimming = false;

        return getBufferHistory(this, 'around', ref)
            .then(() => this.waitForTargetMessage(result))
            .then((target) => {
                if (!target) {
                    this.historyJumpTarget = null;
                    return false;
                }

                this.state.$nextTick(() => {
                    this.scrollToMessage(target.id);
                    setTimeout(() => {
                        if (this.historyJumpTarget === result) {
                            this.historyJumpTarget = null;
                        }
                    }, 1000);
                });
                return true;
            })
            .catch(() => {
                this.historyJumpTarget = null;
                return false;
            })
            .finally(() => {
                this.historyContextLoading = false;
            });
    }

    clearMessages() {
        this.messagesObj.messages.forEach((m) => {
            if (m.irc_id) {
                this.getNetwork().reroute_map.delete(m.irc_id);
            }
        });
        this.messagesObj.messages.splice(0, this.messagesObj.messages.length);
        this.messagesObj.messageIds = Object.create(null);
        this.historySegments = [];
        this.historyGaps = [];
        this.historyGapExhausted = {};
        this.contextOlderRowId = 0;
        this.contextNewerRowId = 0;
        Object.keys(this.contextRowIds).forEach((key) => {
            delete this.contextRowIds[key];
        });
    }

    // Remove a block of messages between a time (server-time) range. Inclusive.
    clearMessageRange(startTime, endTime) {
        this.messagesObj.messages = this.messagesObj.messages.filter((message) => {
            if (message.server_time < startTime || message.server_time > endTime) {
                return true;
            }

            // This message will be removed
            delete this.messagesObj.messageIds[message.id];
            if (message.irc_id) {
                delete this.messagesObj.messageIds[message.irc_id];
                this.getNetwork().reroute_map.delete(message.irc_id);
            }
            return false;
        });

        // Mark that something changed
        this.message_count++;
        this.syncHistorySegments();
    }

    isServer() {
        return this.name === '*';
    }

    isRaw() {
        return this.name === '*raw';
    }

    isChannel() {
        let chanPrefixes = this.getNetwork().supports('CHANTYPES') || ['#', '&'];
        return chanPrefixes.indexOf(this.name[0]) > -1;
    }

    isQuery() {
        let chanPrefixes = this.getNetwork().supports('CHANTYPES') || ['#', '&'];
        return chanPrefixes.indexOf(this.name[0]) === -1 &&
            !this.isSpecial() &&
            !this.isServer();
    }

    isSpecial() {
        // Special buffer names (Usually controller queries, like *status or *raw).
        // Server buffer '*' is not included in this classification.
        let name = this.name;
        return name[0] === '*' && name.length > 1;
    }

    isUserAnOp(nick) {
        let user = this.state.getUser(this.networkid, nick);
        if (!user) {
            return false;
        }

        let userBufferInfo = user.buffers[this.id];
        if (!userBufferInfo) {
            return false;
        }

        let modes = userBufferInfo.modes;
        let opModes = ['Y', 'y', 'q', 'a', 'o', 'h'];
        let hasOp = find(modes, (mode) => opModes.indexOf(mode.toLowerCase()) > -1);

        return !!hasOp;
    }

    userModes(user) {
        const info = user && user.buffers ? user.buffers[this.id] : undefined;
        let modes = info ?
            (info.modes || []).concat(info.twitch_modes || []) :
            [];

        const network = this.getNetwork();
        if (user && this.isChannel() &&
            network && network.isTwitch && network.isTwitch()
        ) {
            twitchUserModes(user.nick, this.name, {}).forEach((mode) => {
                if (!modes.includes(mode)) {
                    modes.push(mode);
                }
            });
        }

        return modes;
    }

    userPrefixes() {
        const network = this.getNetwork();
        if (network && network.isTwitch && network.isTwitch()) {
            return TWITCH_PREFIXES;
        }

        return (network && network.supports('PREFIX')) || [];
    }

    /**
     * Get a users prefix symbol on a buffer from its modes
     * @param {Object} user The user object
     */
    userModePrefix(user) {
        let modes = this.userModes(user);
        if (modes.length === 0) {
            return '';
        }

        let prefixes = this.userPrefixes();
        // Filter and map all prefixes found in the users buffer modes, maintaining rank order
        let symbols = [];
        prefixes.forEach((p) => {
            if (modes.indexOf(p.mode) > -1) {
                symbols.push(p.symbol);
            }
        });

        return symbols.join('');
    }

    /**
     * Get a users mode on a buffer
     * @param user {Object} The user object
     */
    userMode(user) {
        let modes = this.userModes(user);
        if (modes.length === 0) {
            return '';
        }

        // if there is only one mode just return it
        if (modes.length === 1) {
            return modes[0];
        }

        // Find the first (highest) prefix in the users buffer modes
        let prefix = find(this.userPrefixes(), (p) => modes.indexOf(p.mode) > -1);

        return prefix ?
            prefix.mode :
            '';
    }

    setting(name, val) {
        if (typeof val !== 'undefined') {
            this.state.$set(this.settings, name, val);
            return val;
        }

        // Check the buffer specific settings before reverting to global settings
        let result = this.settings[name];
        if (typeof result !== 'undefined') {
            return result;
        }

        // Settings that belong to the network (capability-dependent options
        // and desktop notifications) fall back to that network before the
        // global buffer defaults.
        let network = this.getNetwork();
        if (network && network.settings &&
            typeof network.settings[name] !== 'undefined'
        ) {
            return network.settings[name];
        }

        // Special default for the *raw buffer scrollback size
        if (name === 'scrollback_size' && this.isRaw()) {
            let rawSize = network ? network.setting('raw_scrollback_size') : 0;
            return rawSize || 500;
        }

        return this.state.setting('buffers.' + name);
    }

    rename(newName) {
        let network = this.getNetwork();
        if (!network) {
            return;
        }

        let oldName = this.name;
        let oldNameLower = network.caseLower(oldName);
        let wasActive = this.state.getActiveBuffer() === this;

        this.name = newName;
        if (wasActive) {
            // Updating the name directly avoids recording this same buffer in
            // the back-history under its old name.
            this.state.ui.active_buffer = newName;
        }

        // Update any name-keyed references that would otherwise point at the
        // old channel.
        let lastActive = this.state.ui.last_active_buffers;
        if (Array.isArray(lastActive)) {
            lastActive.forEach((entry) => {
                if (entry.networkid === network.id &&
                    network.caseLower(entry.bufferName || '') === oldNameLower
                ) {
                    entry.bufferName = newName;
                }
            });
        }

        let metadataSubs = network.active_metadata_subs;
        if (metadataSubs) {
            Object.keys(metadataSubs).forEach((key) => {
                if (network.caseLower(key) !== oldNameLower || key === newName) {
                    return;
                }

                this.state.$set(metadataSubs, newName, metadataSubs[key]);
                delete metadataSubs[key];
            });
        }

        let metadataTargets = network.metadata_label_targets;
        if (metadataTargets && typeof metadataTargets.forEach === 'function') {
            metadataTargets.forEach((target, label) => {
                if (network.caseLower(target) === oldNameLower) {
                    metadataTargets.set(label, newName);
                }
            });
        }

        // update the buffer name on our messages
        let bufferMessages = find(this.messageDict, { networkid: network.id, buffer: oldName });
        if (bufferMessages) {
            bufferMessages.buffer = newName;
        }
    }

    flag(name, val) {
        if (typeof val !== 'undefined') {
            this.state.$set(this.flags, name, val);
            return val;
        }

        return this.flags[name];
    }

    getReferenceMessage(direction = 'backward', refTypes = ['msgid', 'timestamp'], options = {}) {
        const includePending = options.includePending !== false;
        const messages = this.getMessages();
        const queue = this.addMessageBatch.queue();
        const allMessages = [...messages, ...queue];
        const validMessages = allMessages.filter((m) => (
            CHAT_MESSAGE_TYPES.includes(m.type) &&
            (includePending || !m.is_pending) &&
            !!buildMessageReference(m, refTypes)
        ));

        if (validMessages.length === 0) {
            return null;
        }

        if (direction === 'backward') {
            return validMessages.reduce((earliest, current) => (
                (earliest.time < current.time) ? earliest : current
            ));
        }

        return validMessages.reduce((latest, current) => (
            (current.time >= latest.time) ? current : latest
        ));
    }

    getHistoryReference(direction = 'backward') {
        const network = this.getNetwork();
        const history = network && network.ircClient && network.ircClient.chathistory;
        const refTypes = history && typeof history.supportedRefTypes === 'function' ?
            history.supportedRefTypes() :
            ['msgid', 'timestamp'];
        return this.getReferenceMessage(direction, refTypes, { includePending: true });
    }

    getReadMarkerMessage() {
        return this.getReferenceMessage(
            'forward',
            ['timestamp'],
            { includePending: false }
        );
    }

    getMessageByServerTime(serverTime) {
        if (!serverTime) {
            return null;
        }

        const messages = this.getMessages();
        const queue = this.addMessageBatch.queue();
        const matches = [...messages, ...queue].filter((m) => (
            CHAT_MESSAGE_TYPES.includes(m.type) &&
            m.server_time === serverTime
        ));

        if (matches.length === 0) {
            return null;
        }

        return matches.reduce((latest, current) => (
            (current.time >= latest.time) ? current : latest
        ));
    }

    localTimeForServerMarker(serverTime) {
        const message = this.getMessageByServerTime(serverTime);
        if (message) {
            return message.time;
        }

        const network = this.getNetwork();
        return network ? network.timeToLocal(serverTime) : serverTime;
    }

    requestScrollback(_direction) {
        if (this.flags.is_requesting_chathistory) {
            return;
        }

        let history = this.getNetwork().ircClient.chathistory;
        if (!history.isSupported()) {
            return;
        }

        let direction = _direction || 'backward';
        let chathistoryFuncName = (direction === 'backward') ? 'before' : 'after';
        let supportedTypes = history.supportedRefTypes();

        let targetMessage = this.getHistoryReference(direction);

        let ref = null;
        if (targetMessage) {
            if (supportedTypes.includes('msgid') && targetMessage.irc_id) {
                ref = targetMessage.irc_id;
            } else if (supportedTypes.includes('timestamp') && targetMessage.server_time) {
                ref = new Date(targetMessage.server_time);
            }
        } else if (direction === 'backward') {
            // No messages yet, but we are requesting scrollback.
            // This can happen if manually clicking load more on an empty buffer.
            if (supportedTypes.includes('timestamp')) {
                ref = new Date();
            } else {
                // if server only supports msgid, we can't really paginate from "now"
                // without a msgid unless we use latest *
                this.requestLatestScrollback();
                return;
            }
        }

        if (!ref) {
            return;
        }

        getBufferHistory(this, chathistoryFuncName, ref);
    }

    requestLatestScrollback() {
        if (this.flags.is_requesting_chathistory) {
            return;
        }

        let history = this.getNetwork().ircClient.chathistory;
        if (!history.isSupported()) {
            return;
        }

        let lastMessage = this.getHistoryReference('forward');
        let supportedTypes = history.supportedRefTypes();

        if (lastMessage && supportedTypes.includes('msgid') && lastMessage.irc_id) {
            getBufferHistory(this, 'latest', lastMessage.irc_id);
        } else if (lastMessage && supportedTypes.includes('timestamp') && lastMessage.server_time) {
            getBufferHistory(this, 'latest', new Date(lastMessage.server_time));
        } else {
            getBufferHistory(this, 'latest', '*');
        }
    }

    markAsRead(delayed) {
        if (this.active_timeout) {
            clearTimeout(this.active_timeout);
            this.active_timeout = null;
        }
        this.clearReadMarkerTimeout();

        if (delayed) {
            this.active_timeout = setTimeout(
                this.markAsRead.bind(this),
                10000,
                false
            );
            return;
        }

        const network = this.getNetwork();
        if (!network) {
            return;
        }

        // Without read-marker support the local clock is all we have.
        if (this.name[0] === '*' || !network.hasCap('draft/read-marker')) {
            this.last_read = Date.now();
            return;
        }

        const markerMessage = this.getReadMarkerMessage();
        const markerTime = markerMessage ? markerMessage.server_time : 0;

        if (!markerTime) {
            if (this.flags.last_read_authoritative) {
                this.last_read = this.localTimeForServerMarker(
                    this.flags.last_read_authoritative
                );
            }
            return;
        }

        if (this.read_marker_pending &&
            this.read_marker_pending.serverTime >= markerTime
        ) {
            this.last_read = this.read_marker_pending.localTime;
            return;
        }

        if (markerTime <= this.flags.last_read_authoritative) {
            this.last_read = this.localTimeForServerMarker(
                this.flags.last_read_authoritative
            );
            return;
        }

        // Optimistically show the exact local time of the message being
        // marked. Reusing the timestamp here avoids clock-offset drift when
        // the server echo arrives.
        this.last_read = markerMessage.time;
        const label = network.ircClient.readMarker.set(
            this.name,
            new Date(markerTime)
        );

        this.clearReadMarkerPending();
        const pending = {
            label: label || '',
            serverTime: markerTime,
            localTime: markerMessage.time,
        };
        this.read_marker_pending = pending;
        this.read_marker_pending_timer = setTimeout(() => {
            if (this.read_marker_pending === pending) {
                this.read_marker_pending = null;
                this.read_marker_pending_timer = null;
            }
        }, READ_MARKER_CONFIRM_TIMEOUT_MS);
    }

    markAsReadSoon() {
        const network = this.getNetwork();
        if (!network || this.name[0] === '*' ||
            !network.hasCap('draft/read-marker')
        ) {
            return;
        }

        // Throttle so a busy buffer sends at most one marker per window.
        if (this.read_marker_timeout) {
            return;
        }

        this.read_marker_timeout = setTimeout(() => {
            this.read_marker_timeout = null;
            this.markAsRead(false);
        }, READ_MARKER_THROTTLE_MS);
    }

    noteVisibleMessage(message) {
        const network = this.getNetwork();
        if (!network) {
            return;
        }

        if (this.name[0] !== '*' && network.hasCap('draft/read-marker')) {
            if (hasServerTimestamp(message)) {
                this.last_read = message.time;
                this.markAsReadSoon();
            }
            return;
        }

        this.last_read = message.time;
    }

    applyServerReadMarker(serverTime, label) {
        const network = this.getNetwork();
        if (!network) {
            return;
        }

        if (!serverTime) {
            // MARKREAD * means the server has no stored marker. Do not treat
            // the current local clock as an authoritative read position.
            if (this.read_marker_pending) {
                return;
            }
            this.flags.last_read_authoritative = 0;
            if (this.isVisible) {
                this.markAsReadSoon();
            }
            return;
        }

        const pending = this.read_marker_pending;
        const labelMatches = !!(pending && label &&
            pending.label && label === pending.label);
        const sameTime = !!(pending && serverTime === pending.serverTime);

        if (pending) {
            if ((labelMatches || sameTime) && serverTime === pending.serverTime) {
                this.clearReadMarkerPending();
                this.flags.last_read_authoritative = serverTime;
                this.last_read = pending.localTime;
                this.flags.unread = 0;
                this.flags.highlight = false;
                return;
            }

            if (!labelMatches && !sameTime && serverTime < pending.serverTime) {
                // A stale server marker must not undo a newer marker that is
                // still awaiting confirmation.
                return;
            }

            this.clearReadMarkerPending();
        }

        if (serverTime < this.flags.last_read_authoritative) {
            // Read markers only move forward; ignore late or stale markers.
            return;
        }

        const authoritative = serverTime;
        this.flags.last_read_authoritative = authoritative;
        this.last_read = this.localTimeForServerMarker(authoritative);
        this.flags.unread = 0;
        this.flags.highlight = false;

        if (this.isVisible) {
            const marker = this.getReadMarkerMessage();
            if (marker && marker.server_time > authoritative) {
                this.markAsReadSoon();
            }
        }
    }

    readMarkerFailed(label) {
        const network = this.getNetwork();
        if (!network) {
            return;
        }

        const pending = this.read_marker_pending;
        if (pending && label && pending.label && label !== pending.label) {
            // A failure for a different request must not clear this one.
            return;
        }

        this.clearReadMarkerPending();

        if (this.flags.last_read_authoritative) {
            this.last_read = this.localTimeForServerMarker(
                this.flags.last_read_authoritative
            );
        } else {
            this.last_read = 0;
        }
    }

    incrementFlag(flagName) {
        this.flags[flagName] = (this.flags[flagName] || 0) + 1;
    }

    addUser(user) {
        this.addUserBatch(user);
    }

    hasNick(nick) {
        const network = this.getNetwork();
        if (!network) {
            return false;
        }

        let nickUpper = network.caseUpper(nick);
        return (
            nickUpper in this.users
            || this.addUserBatch.queue().some((u) => network.caseUpper(u.nick) === nickUpper)
            || (this.isQuery() && network.caseCompare(this.name, nick))
        );
    }

    hasMode(mode) {
        return Object.keys(this.modes).indexOf(mode) > -1;
    }

    shouldShareTyping() {
        let network = this.getNetwork();
        if (!this.setting('share_typing')) {
            // Feature disabled
            return false;
        }
        if (!this.isChannel() && !this.isQuery()) {
            // Qnly share tying with channels and queries
            return false;
        }
        if (this.isChannel() && !this.joined) {
            // Channel is in an unjoined state
            return false;
        }
        if (this.hasMode('m') && !this.userMode(network.currentUser())) {
            // Channel is moderated (+m) and we do not have a user mode +v or above
            return false;
        }
        return true;
    }

    banUser(user) {
        if (!user.username || !user.host) {
            return;
        }

        let banMask = user.createBanMask();
        this.getNetwork().ircClient.raw('MODE', this.name, '+b', banMask);
    }

    kickUser(user, _reason) {
        let reason = _reason || this.state.setting('buffers.default_kick_reason');
        this.getNetwork().ircClient.raw('KICK', this.name, user.nick, reason);
    }

    banKickUser(user, reason) {
        this.banUser(user);
        this.kickUser(user, reason);
    }

    removeUser(nick) {
        const network = this.getNetwork();
        let userObj = this.state.getUser(this.networkid, nick);

        // A user could be queued to be added, so make sure it's not there as it
        // would just be added again. Eg. user joins/parts during a flood
        let userQueue = this.addUserBatch.queue();
        let userIdx = userQueue.indexOf(userObj);
        while (userIdx > -1) {
            userQueue.splice(userIdx, 1);
            userIdx = userQueue.indexOf(userObj);
        }

        this.state.$delete(this.users, network ? network.caseUpper(nick) : nick.toUpperCase());

        if (userObj) {
            delete userObj.buffers[this.id];
        }
    }

    clearUsers() {
        // Users could be queued to be added, so make sure to clear them as they
        // would just be added again. Eg. user joins/parts during a flood
        this.addUserBatch && this.addUserBatch.queue().splice(0);

        each(this.users, (userObj, nick) => {
            delete userObj.buffers[this.id];
        });

        this.state.$set(this, 'users', {});
    }

    addMessage(message) {
        this.addMessageBatch(message);
    }

    updateLatestMessages(message) {
        if (!['privmsg', 'notice'].includes(message.type)) {
            return;
        }

        const isNewer = (msg) => this.latest_messages[0].time <= msg.time &&
            this.latest_messages[0].instance_num < msg.instance_num;

        if (!this.latest_messages[0] || isNewer(message)) {
            this.latest_messages.unshift(message);
        }

        if (this.latest_messages.length > 5) {
            // restrict array to 5 elements
            this.latest_messages.length = 5;
        }
    }

    getLatestMessage() {
        return this.latest_messages[0];
    }

    say(message, opts = {}) {
        let network = this.getNetwork();
        let tags = opts.tags || {};
        let outgoingTarget = this.name;

        const replyTag = network.replyTagName();
        if (this.replying_to && this.replying_to.irc_id && replyTag) {
            tags[replyTag] = this.replying_to.irc_id;

            // If replying to a rerouted message, we must target the protocol_target
            // and include the +channel-context tag to maintain the thread
            if (
                this.replying_to.is_rerouted &&
                this.replying_to.protocol_target &&
                !network.isTwitch()
            ) {
                outgoingTarget = this.replying_to.protocol_target;
                if (network.supportsTag('+channel-context')) {
                    tags['+channel-context'] = this.name;
                }
            }
        }

        let newMessage = {
            time: Date.now(),
            nick: network.nick,
            message: message,
            tags: tags,
            type: opts.type || 'privmsg',
            is_rerouted: !!tags['+channel-context'],
        };

        this.state.addMessage(this, newMessage);

        let fnNames = {
            privmsg: 'say',
            action: 'action',
            notice: 'notice',
            tagmsg: 'tagmsg',
        };
        let fnName = fnNames[opts.type] || 'say';
        network.ircClient[fnName](outgoingTarget, message, tags);

        this.replying_to = null;
    }

    react(message, emoji) {
        let network = this.getNetwork();
        if (!network.supportsTag('+draft/react') || !message.irc_id) {
            return;
        }

        let isReacting = true;
        let tags = {
            '+reply': message.irc_id,
        };

        // If we have already reacted with this emoji, unreact it
        if (message.reactions[emoji] && message.reactions[emoji].reacted) {
            tags['+draft/unreact'] = emoji;
            isReacting = false;
        } else {
            tags['+draft/react'] = emoji;
            isReacting = true;
        }

        let hasEcho = network.hasCap('echo-message');
        let hasLabel = network.hasCap('labeled-response');

        if (hasLabel) {
            const label = Misc.generateLabel();
            tags.label = label;
            this.messagesObj.pendingReactions[label] = {
                message,
                emoji,
                isReacting,
            };

            // Local echo with pending status
            Reactions.applyReaction(message, network.nick, emoji, isReacting, { isPending: true });

            // Set a timeout to revert the pending state if no confirm arrives
            setTimeout(() => {
                if (this.messagesObj.pendingReactions[label]) {
                    this.state.revertPendingLabel(this.networkid, label);
                }
            }, 60000);
        } else if (hasEcho) {
            // Case 2: heuristic pending
            Reactions.applyReaction(message, network.nick, emoji, isReacting, { isPending: true });
            setTimeout(() => {
                // Heuristic timeout - we can't reliably revert because we don't have a label
                // but we can mark it as non-pending.
                Reactions.applyReaction(
                    message,
                    network.nick,
                    emoji,
                    isReacting,
                    { isPending: false }
                );
            }, 60000);
        } else {
            // Case 1: immediate local echo
            Reactions.applyReaction(message, network.nick, emoji, isReacting, { isPending: false });
        }

        // Use protocol_target if the message was rerouted
        const outgoingTarget = message.protocol_target || this.name;
        network.ircClient.tagmsg(outgoingTarget, tags);
    }

    redact(message, reason) {
        let network = this.getNetwork();
        if (!network.hasCap('draft/message-redaction') || !message.irc_id || message.type === 'tagmsg') {
            return;
        }

        if (!message.is_redacted) {
            message.closeEmbed?.();
        }

        let tags = {};
        let hasEcho = network.hasCap('echo-message');
        let hasLabel = network.hasCap('labeled-response');

        if (hasLabel) {
            const label = Misc.generateLabel();
            tags.label = label;
            this.messagesObj.pendingRedactions[label] = {
                message,
                reason,
            };

            // Local update with pending status
            message.is_redacted = true;
            message.redacted_by = network.nick;
            message.redaction_reason = reason;
            message.is_pending = true;

            // Set a timeout to revert the pending state if no confirm arrives
            setTimeout(() => {
                if (this.messagesObj.pendingRedactions[label]) {
                    this.state.revertPendingLabel(this.networkid, label);
                }
            }, 60000);
        } else if (hasEcho) {
            // Case 2: heuristic pending
            message.is_redacted = true;
            message.redacted_by = network.nick;
            message.redaction_reason = reason;
            message.is_pending = true;

            setTimeout(() => {
                if (message.is_pending) {
                    message.is_redacted = false;
                    message.redacted_by = '';
                    message.redaction_reason = '';
                    message.is_pending = false;

                    this.state.addMessage(this, {
                        time: Date.now(),
                        nick: '*',
                        message: TextFormatting.t('error_confirm_timeout'),
                        type: 'error',
                    });
                }
            }, 60000);
        } else {
            // Case 1: Immediate local update
            message.is_redacted = true;
            message.redacted_by = network.nick;
            message.redaction_reason = reason;
            message.is_pending = false;
            this.state.$emit('message.redaction', {
                networkId: this.networkid,
                ircId: message.irc_id,
                buffer: this,
                message,
                redactedBy: network.nick,
                redactionReason: reason,
                redactedAt: Date.now(),
            });
        }

        // Use protocol_target if the message was rerouted
        const outgoingTarget = message.protocol_target || this.name;
        let ircMessage = new network.ircClient.Message('REDACT', outgoingTarget, message.irc_id);
        if (reason) {
            ircMessage.params.push(reason);
        }
        if (Object.keys(tags).length > 0) {
            ircMessage.tags = tags;
        }

        network.ircClient.raw(ircMessage);
    }

    join() {
        if (!this.isChannel()) {
            return;
        }

        let network = this.getNetwork();
        network.ircClient.join(this.name, this.key || '');
    }

    part(reason) {
        if (!this.isChannel()) {
            return;
        }

        let network = this.getNetwork();
        network.ircClient.part(this.name, reason || '');
    }

    scrollToMessage(id) {
        this.state.$emit('messagelist.scrollto', { id: id });
    }

    getLoadingState() {
        const networkState = this.getNetwork().state;
        const historySupport = !!this.getNetwork().ircClient.chathistory.isSupported();
        const messagesInBatchQueue = this.addMessageBatch.queue().length;
        // Hack; We need to make vue aware that we depend on message_count in order to
        // update the loading state.
        // eslint-disable-next-line no-unused-vars
        const messageCount = this.message_count;

        if (networkState === 'disconnected') {
            return 'disconnected';
        } else if (networkState === 'connecting') {
            return 'connecting';
        } else if (
            networkState === 'connected' &&
            this.enabled &&
            (
                historySupport &&
                (this.flags.is_requesting_chathistory ||
                    // If chathistory is supported then a request will always be made when first
                    // joining a channel. If request_count===0 then we're still waiting for it
                    // to happen.
                    this.chathistory_request_count === 0 ||
                    // keep in loading state while the batch is being processed
                    messagesInBatchQueue > 0
                )
            )
        ) {
            return 'loading';
        }
        return 'done';
    }

    isReady() {
        return this.getLoadingState() === 'done';
    }
}

/**
 * Batch up floods of addUsers for a huge performance gain.
 * Generally happens when reconnecting to a BNC
 */
function createUserBatch(bufferState) {
    let addSingleUser = (u) => {
        const network = bufferState.getNetwork();
        const key = network ? network.caseUpper(u.nick) : u.nick.toUpperCase();
        bufferState.state.$set(bufferState.users, key, u);
    };
    let addMultipleUsers = (users) => {
        const network = bufferState.getNetwork();
        let o = Object.assign(Object.create(null), bufferState.users);
        users.forEach((u) => {
            o[network ? network.caseUpper(u.nick) : u.nick.toUpperCase()] = u;
        });
        bufferState.users = o;
    };

    return batchedAdd(addSingleUser, addMultipleUsers, 2);
}

/**
 * batch up floods of new messages for a huge performance gain
 */
function createMessageBatch(bufferState) {
    let addSingleMessage = (newMessage) => {
        if (bufferState.messagesObj.messageIds[newMessage.id]) {
            return;
        }
        if (newMessage.irc_id && bufferState.messagesObj.messageIds[newMessage.irc_id]) {
            return;
        }
        bufferState.updateLatestMessages(newMessage);
        bufferState.messagesObj.messages.push(newMessage);
        bufferState.messagesObj.messageIds[newMessage.id] = newMessage;
        if (newMessage.irc_id) {
            bufferState.messagesObj.messageIds[newMessage.irc_id] = newMessage;
        }
        if (newMessage.tags && newMessage.tags.label) {
            bufferState.messagesObj.messageLabels[newMessage.tags.label] = newMessage;
        }
        bufferState.noteLiveMessage(newMessage);
        if (bufferState.isMessageTrimming) {
            trimMessages();
        }
        bufferTools.orderedMessages(bufferState, { inPlace: true, noFilter: true });
        bufferState.message_count++;
    };
    let addMultipleMessages = (newMessages) => {
        let toAdd = newMessages.filter((msg) => {
            let hasId = !!bufferState.messagesObj.messageIds[msg.id];
            let hasIrcId = msg.irc_id && !!bufferState.messagesObj.messageIds[msg.irc_id];
            return !hasId && !hasIrcId;
        });
        if (toAdd.length > 0) {
            bufferState.messagesObj.messages = bufferState.messagesObj.messages.concat(toAdd);
            toAdd.forEach((msg) => {
                bufferState.updateLatestMessages(msg);
                bufferState.messagesObj.messageIds[msg.id] = msg;
                if (msg.irc_id) {
                    bufferState.messagesObj.messageIds[msg.irc_id] = msg;
                }
                if (msg.tags && msg.tags.label) {
                    bufferState.messagesObj.messageLabels[msg.tags.label] = msg;
                }
                bufferState.noteLiveMessage(msg);
            });
            if (bufferState.isMessageTrimming) {
                trimMessages();
            }
            bufferTools.orderedMessages(bufferState, { inPlace: true, noFilter: true });
        }
        // Trigger Vue's reactivity on the buffer whether messages were added or not, just in case
        // anything was depending on the batch queue which has now been emptied.
        bufferState.message_count++;
    };
    let trimMessages = () => {
        if (bufferState.historyJumpTarget || bufferState.historyContextLoading) {
            return;
        }

        let scrollbackSize = bufferState.setting('scrollback_size');
        let length = bufferState.messagesObj.messages.length;
        if (length > scrollbackSize) {
            let removed = bufferState.messagesObj.messages.splice(0, length - scrollbackSize);
            removed.forEach((msg) => {
                delete bufferState.messagesObj.messageIds[msg.id];
                if (msg.irc_id) {
                    delete bufferState.messagesObj.messageIds[msg.irc_id];
                    bufferState.getNetwork().reroute_map.delete(msg.irc_id);
                }
                if (msg.tags && msg.tags.label) {
                    delete bufferState.messagesObj.messageLabels[msg.tags.label];
                }
            });
            bufferState.syncHistorySegments();
        }
    };

    return batchedAdd(addSingleMessage, addMultipleMessages, 4);
}

// Update our user list status every 30seconds to get each users current away status
function maybeStartWhoLoop(bufferState) {
    let network = bufferState.state.getNetwork(bufferState.networkid);

    if (!network || network.isTwitch()) {
        return;
    }

    if (network.state === 'connected') {
        // network is connected start the loop if its needed
        nextLoop();
    } else {
        // Network is not coonnected. Wait until it is
        let on001 = (command, event, eventNetwork) => {
            if (eventNetwork === network) {
                bufferState.state.$off('irc.raw.001', on001);
                nextLoop();
            }
        };
        bufferState.state.$on('irc.raw.001', on001);
    }

    function nextLoop() {
        setTimeout(updateWhoStatusLoop, 30000);
    }

    function updateWhoStatusLoop() {
        network = bufferState.state.getNetwork(bufferState.networkid);

        // Make sure the network still exists
        if (!network || network.isTwitch()) {
            return;
        }

        // Make sure the buffer still exists
        if (!network.bufferByName(bufferState.name)) {
            return;
        }

        let whoLoop = bufferState.setting('who_loop');
        let canWho = bufferState.isQuery() || bufferState.joined;
        let hasAwayNotify = network.hasCap('away-notify');
        let networkConnected = network.state === 'connected';

        if (whoLoop && networkConnected && canWho && !hasAwayNotify) {
            network.ircClient.who(bufferState.name);
        }
        nextLoop();
    }
}

function getBufferHistory(buffer, chathistoryFuncName, time, depth = 0, attempt = 0) {
    const network = buffer.getNetwork();
    if (!network || !network.ircClient) {
        return Promise.resolve();
    }

    let ircClient = network.ircClient;
    if (!ircClient.chathistory.isSupported()) {
        return Promise.resolve();
    }

    const connectionGeneration = network.connection_generation;
    const isCurrentConnection = () => {
        const current = buffer.getNetwork();
        return current === network &&
            current.connection_generation === connectionGeneration;
    };

    buffer.chathistory_pending_requests += 1;
    buffer.updateHistoryLoadingState();
    buffer.chathistory_request_count += 1;
    let existingMessageIds = Object.assign({}, buffer.messagesObj.messageIds);

    return ircClient.chathistory[chathistoryFuncName](buffer.name, time).then((event) => {
        if (!isCurrentConnection()) {
            return undefined;
        }

        if (!event) {
            buffer.flag('chathistory_available', false);
            return undefined;
        }

        if (event.error === 'timeout') {
            // A timeout means the request may have been rate limited or the
            // server may still be busy. Keep manual loading available and try
            // the same request again after a short backoff.
            buffer.flag('chathistory_available', true);

            if (attempt < HISTORY_MAX_RETRIES && isCurrentConnection()) {
                const delay = Math.min(
                    HISTORY_RETRY_BASE_MS * (2 ** attempt),
                    HISTORY_RETRY_MAX_MS
                );

                buffer.clearHistoryRetry();
                buffer.chathistory_retry_timeout = setTimeout(() => {
                    buffer.chathistory_retry_timeout = null;
                    if (isCurrentConnection() && network.state === 'connected') {
                        getBufferHistory(buffer, chathistoryFuncName, time, depth, attempt + 1);
                    }
                }, delay);
            } else {
                buffer.state.addMessage(buffer, {
                    time: Date.now(),
                    nick: '*',
                    message: 'Failed to load history: ' + (event.reason || event.error),
                    type: 'error',
                });
            }
            return undefined;
        }

        if (event.error) {
            if (!event.silent) {
                const errorMsg = event.reason || event.error;
                buffer.state.addMessage(buffer, {
                    time: Date.now(),
                    nick: '*',
                    message: 'Failed to load history: ' + errorMsg,
                    type: 'error',
                });
                buffer.flag('chathistory_available', false);
            }
            return undefined;
        }

        const historyTimes = event.commands
            .map((command) => Number(command.time))
            .filter((stamp) => Number.isFinite(stamp));
        if (historyTimes.length) {
            buffer.noteHistoryWindow(
                Math.min(...historyTimes),
                Math.max(...historyTimes),
                chathistoryFuncName
            );
        }

        if (typeof event.is_end !== 'undefined') {
            buffer.flag('chathistory_available', !event.is_end);
            if (event.is_end) {
                return undefined;
            }
        }

        // The BNC server may reply with messages that are already in the buffer.
        // If we get no new messages that we didn't already have, assume that we have
        // all the available history
        let hasNewMessages = event.commands.some(
            (msg) => msg.tags.msgid && !existingMessageIds[msg.tags.msgid]
        );

        // If there are new messages, then there could be more in the backlog.
        // If there are no new messages, then the chat history is empty.
        buffer.flag('chathistory_available', hasNewMessages);

        if (!hasNewMessages) {
            return undefined;
        }

        // Recursive gap fill logic
        // Check if our earliest message is still newer than the last_read marker.
        // We fetch until we have covered all unread messages plus at least one chunk of context.
        const earliest = buffer.getHistoryReference('backward');
        if (earliest && buffer.last_read && earliest.time > buffer.last_read && depth < 10) {
            const supportedTypes = ircClient.chathistory.supportedRefTypes();
            let ref = null;
            if (supportedTypes.includes('msgid') && earliest.irc_id) {
                ref = earliest.irc_id;
            } else if (supportedTypes.includes('timestamp') && earliest.server_time) {
                ref = new Date(earliest.server_time);
            }

            if (ref) {
                // Fetch the next chunk recursively and keep the loading state
                // active until the whole gap-fill chain finishes.
                return getBufferHistory(buffer, 'before', ref, depth + 1);
            }
        }
        return undefined;
    }).finally(() => {
        buffer.chathistory_pending_requests = Math.max(
            0,
            buffer.chathistory_pending_requests - 1
        );
        buffer.updateHistoryLoadingState();
    });
}
