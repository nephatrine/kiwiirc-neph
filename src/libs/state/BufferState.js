/** @module */

import Vue from 'vue';
import _ from 'lodash';
import { def } from './common';
import batchedAdd from '../batchedAdd';
import * as bufferTools from '../bufferTools';
import * as TextFormatting from '@/helpers/TextFormatting';
import * as Reactions from '@/helpers/Reactions';
import * as Misc from '@/helpers/Misc';

let nextBufferId = 0;

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
        def(this, 'addMessageBatch', createMessageBatch(this), false);
        def(this, 'addUserBatch', createUserBatch(this), false);

        // poll who to update away status if away-notify is not enabled
        if (this.isChannel() || this.isQuery()) {
            maybeStartWhoLoop(this);
        }

        // When the network re-connects, we reset the chathistory request counter.
        // This will make the `getLoadingState()` stay as 'loading' while the chathistory reloads.
        function onNetworkConnecting(event) {
            if (event.network === this.getNetwork()) {
                this.chathistory_request_count = 0;
                this.flags.names_received = false;
                this.flags.marker_received = false;
            }
        }

        function onNetworkMotd(event, network) {
            if (network === this.getNetwork()) {
                this.initHistory();
            }
        }

        // Clean up the previous event and itself when the buffer is closed.
        function onBufferClose(event) {
            if (event.buffer === this) {
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
        }
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
        if (!network || !this.isQuery()) {
            return;
        }

        // Fetch metadata for the query partner (away status, realname, host)
        network.ircClient.who(this.name);
    }

    get topic() {
        return this.topics[0] ?? '';
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
        if (this.active_timeout) {
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
        let bufMessages = _.find(this.messageDict, {
            networkid: this.networkid,
            buffer: this.name,
        });

        return bufMessages ?
            bufMessages.messages :
            [];
    }

    getLastMessage() {
        let messages = this.getMessages();
        if (messages.length === 0) {
            return undefined;
        }
        return messages[messages.length - 1];
    }

    clearMessages() {
        this.messagesObj.messages.forEach((m) => {
            if (m.irc_id) {
                this.getNetwork().reroute_map.delete(m.irc_id);
            }
        });
        this.messagesObj.messages.splice(0, this.messagesObj.messages.length);
        this.messagesObj.messageIds = Object.create(null);
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
        let hasOp = _.find(modes, (mode) => opModes.indexOf(mode.toLowerCase()) > -1);

        return !!hasOp;
    }

    /**
     * Get a users prefix symbol on a buffer from its modes
     * @param {Object} user The user object
     */
    userModePrefix(user) {
        // The user may not be on the buffer
        if (!user.buffers[this.id]) {
            return '';
        }

        let modes = user.buffers[this.id].modes;
        if (modes.length === 0) {
            return '';
        }

        let network = this.getNetwork();
        let netPrefixes = network.supports('PREFIX');
        // Filter and map all netPrefixes found in the users buffer modes, maintaining rank order
        let symbols = [];
        netPrefixes.forEach((p) => {
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
        // The user may not be on the buffer
        if (!user.buffers[this.id]) {
            return '';
        }

        let modes = user.buffers[this.id].modes;
        if (modes.length === 0) {
            return '';
        }

        // if there is only one mode just return it
        if (modes.length === 1) {
            return modes[0];
        }

        let network = this.getNetwork();
        let netPrefixes = network.supports('PREFIX');
        // Find the first (highest) netPrefix in the users buffer modes
        let prefix = _.find(netPrefixes, (p) => modes.indexOf(p.mode) > -1);

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

        // Special default for the *raw buffer scrollback size
        if (name === 'scrollback_size' && this.isRaw()) {
            let network = this.getNetwork();
            let rawSize = network ? network.setting('raw_scrollback_size') : 0;
            return rawSize || 500;
        }

        return this.state.setting('buffers.' + name);
    }

    rename(newName) {
        let network = this.getNetwork();
        let oldName = this.name;
        let setActive = this.state.getActiveBuffer() === this;

        this.name = newName;
        if (setActive) {
            this.state.setActiveBuffer(network.id, newName);
        }

        // update the buffer name on our messages
        let bufferMessages = _.find(this.messageDict, { networkid: network.id, buffer: oldName });
        bufferMessages.buffer = newName;
    }

    flag(name, val) {
        if (typeof val !== 'undefined') {
            this.state.$set(this.flags, name, val);
            return val;
        }

        return this.flags[name];
    }

    getHistoryReference(direction = 'backward') {
        const messages = this.getMessages();
        const queue = this.addMessageBatch.queue();
        const allMessages = [...messages, ...queue];

        const validTypes = ['privmsg', 'notice', 'action', 'message'];
        const validMessages = allMessages.filter((m) => (
            validTypes.includes(m.type) &&
            (m.irc_id || m.is_history)
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
        if (delayed) {
            this.active_timeout = setTimeout(
                this.markAsRead.bind(this),
                10000,
                false
            );
        } else {
            this.last_read = Date.now();

            let network = this.getNetwork();
            if (!network) {
                return;
            }

            // 1. DRAFT read-marker (IRCv3 Standard)
            // Only use this for chat buffers.
            // Exclude special buffers (names starting with *) and server buffers.
            if (this.name[0] !== '*' && network.hasCap('draft/read-marker')) {
                const lastMsg = this.getHistoryReference('forward');
                if (lastMsg && lastMsg.server_time > this.flags.last_read_authoritative) {
                    // Update authoritative state optimistically
                    this.flags.last_read_authoritative = lastMsg.server_time;
                    network.ircClient.readMarker.set(this.name, new Date(lastMsg.server_time));
                }
            }
        }
    }

    incrementFlag(flagName) {
        this.flags[flagName] = (this.flags[flagName] || 0) + 1;
    }

    addUser(user) {
        this.addUserBatch(user);
    }

    hasNick(nick) {
        let nickUpper = nick.toUpperCase();
        return (
            nickUpper in this.users
            || this.addUserBatch.queue().some((u) => u.nick.toUpperCase() === nickUpper)
            || (this.isQuery() && this.name.toUpperCase() === nickUpper)
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
        let userObj = this.state.getUser(this.networkid, nick);

        // A user could be queued to be added, so make sure it's not there as it
        // would just be added again. Eg. user joins/parts during a flood
        _.pull(this.addUserBatch.queue(), userObj);

        this.state.$delete(this.users, nick.toUpperCase());

        if (userObj) {
            delete userObj.buffers[this.id];
        }
    }

    clearUsers() {
        // Users could be queued to be added, so make sure to clear them as they
        // would just be added again. Eg. user joins/parts during a flood
        this.addUserBatch && this.addUserBatch.queue().splice(0);

        _.each(this.users, (userObj, nick) => {
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

        if (this.replying_to && this.replying_to.irc_id && network.hasCap('message-tags')) {
            if (network.supportsTag('+reply')) {
                tags['+reply'] = this.replying_to.irc_id;
            } else if (network.supportsTag('+draft/reply')) {
                tags['+draft/reply'] = this.replying_to.irc_id;
            }

            // If replying to a rerouted message, we must target the protocol_target
            // and include the +channel-context tag to maintain the thread
            if (this.replying_to.is_rerouted && this.replying_to.protocol_target) {
                outgoingTarget = this.replying_to.protocol_target;
                tags['+channel-context'] = this.name;
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
        bufferState.state.$set(bufferState.users, u.nick.toUpperCase(), u);
    };
    let addMultipleUsers = (users) => {
        let o = Object.assign(Object.create(null), bufferState.users);
        users.forEach((u) => {
            o[u.nick.toUpperCase()] = u;
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
        }
    };

    return batchedAdd(addSingleMessage, addMultipleMessages, 4);
}

// Update our user list status every 30seconds to get each users current away status
function maybeStartWhoLoop(bufferState) {
    let network = bufferState.state.getNetwork(bufferState.networkid);

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
        if (!network) {
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
            network.ircClient.who(bufferState.name, () => {
                nextLoop();
            });
        } else {
            nextLoop();
        }
    }
}

function getBufferHistory(buffer, chathistoryFuncName, time, depth = 0) {
    let ircClient = buffer.getNetwork().ircClient;
    if (!ircClient.chathistory.isSupported()) {
        return Promise.resolve();
    }

    if (depth === 0) {
        buffer.flag('is_requesting_chathistory', true);
    }
    buffer.chathistory_request_count += 1;
    let existingMessageIds = Object.assign({}, buffer.messagesObj.messageIds);
    return ircClient.chathistory[chathistoryFuncName](buffer.name, time).then((event) => {
        if (!event) {
            buffer.flag('chathistory_available', false);
            return;
        }

        if (event.error) {
            const errorMsg = event.reason || event.error;
            buffer.state.addMessage(buffer, {
                time: Date.now(),
                nick: '*',
                message: 'Failed to load history: ' + errorMsg,
                type: 'error',
            });
            buffer.flag('chathistory_available', false);
            return;
        }

        if (typeof event.is_end !== 'undefined') {
            buffer.flag('chathistory_available', !event.is_end);
            if (event.is_end) {
                return;
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
            return;
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
                // Fetch the next chunk recursively
                getBufferHistory(buffer, 'before', ref, depth + 1);
            }
        }
    }).finally(() => {
        if (depth === 0) {
            buffer.flag('is_requesting_chathistory', false);
        }
    });
}
