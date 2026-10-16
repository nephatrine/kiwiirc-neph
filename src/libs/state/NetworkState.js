/** @module */

import Vue from 'vue';
import * as Misc from '@/helpers/Misc';
import { parseAccountRegistrationCap } from '@/libs/accountRegistration';
import { def } from './common';
import * as IrcClient from '../IrcClient';

/** The IRC network instance */
export default class NetworkState {
    constructor(id, appState, userDict, bufferDict) {
        // Enumerable properties that become reactive under Vue
        this.id = id;
        this.name = '';
        this.editable_name = false;
        // State of the transport
        this.state = 'disconnected';
        this.state_error = '';
        // Last error from the IRC server. Resets on reconnect
        this.last_error = '';
        this.auto_commands = '';
        this.is_znc = false;
        this.is_bnc = false;
        this.hidden = false;
        this.channel_list = [];
        this.channel_list_state = '';
        this.channel_list_last_updated = 0;
        this.connected_at = 0;
        // The IRCd type as mentioned in the 002 numeric
        this.ircd = '';
        this.connection = {
            server: '',
            port: 6667,
            tls: false,
            path: '',
            // Server password
            password: '',
            direct: false,
            encoding: 'utf8',
            bncnetid: '',
            nick: '',
            account: '',
            sasl_mechanism: 'AUTO',
        };
        this.settings = {
            show_raw_caps: false,
        };
        this.nick = '';
        this.username = '';
        this.gecos = '';
        this.metadata = {};
        this.metadata_limits = {
            maxSubs: 32,
            maxKeys: 32,
            maxKeyBytes: 64,
            maxValueBytes: 4096,
        };
        // Self profile metadata the user explicitly SET (Edit Profile),
        // re-sent after reconnects since servers may not persist metadata.
        // Plain {} to stay reactive. Owner scopes it to one identity so a
        // different account never inherits another identity's profile.
        this.saved_profile_metadata = {};
        this.saved_profile_owner = '';
        // SASL password
        this.account = {
            account: '',
            password: '',
        };
        this.password = '';
        this.sasl_account = '';
        this.away = '';
        this.enabled_caps = [];
        this.cap_values = {};
        // Server persistence state (draft/persistence). Assume non-persistent
        // until the server reports otherwise via PERSISTENCE STATUS.
        // Plain {} to stay reactive.
        this.persistence_status = { client: '', effective: 'OFF' };
        // Web push registration state (draft/webpush). Runtime-only, never
        // persisted: subscriptions live in the browser, not in saved state.
        this.webpush_registered = false;
        this.webpush_endpoint = '';
        this.isupport = {};
        // Account registration (draft/account-registration) flow state.
        // Never stores the password here: enumerable fields can be persisted.
        this.registration = {
            pending: false,
            awaitingVerify: false,
            account: '',
            error: '',
        };

        Vue.observable(this);

        // Some non-enumerable properties (vues $watch won't cover these properties)
        def(this, 'appState', appState, false);
        def(this, 'userDict', userDict, false);
        def(this, 'bufferDict', bufferDict, false);
        def(this, 'frameworkClient', null, true);

        def(this, 'users', Object.create(null), (newVal) => {
            appState.$set(userDict.networks, this.id, newVal);
        });

        // Pending prviate messages awaiting whois operator check
        def(this, 'pendingPms', [], false);

        // Map of batchId -> { bufferName, label }
        def(this, 'active_outgoing_batches', new Map(), false);

        // Map of msgid -> Buffer object for rerouted messages
        def(this, 'reroute_map', new Map(), false);
        def(this, 'channel_list_connect_timer', null, true);
        def(this, 'channel_list_connect_force', false, true);
        def(this, 'channel_list_connect_pending', false, true);
        // Parked channel-join releaser for the draft/persistence
        // hold-until-known, plus its backstop timer. Non-enumerable:
        // a function handle and a timer must not be reactive/persisted.
        def(this, 'pending_channel_joins', null, true);
        def(this, 'pending_channel_joins_timer', null, true);

        this.metadata_timeout_active = false;

        // Session-local metadata subscription tracking
        this.active_metadata_subs = Object.create(null);
        this.metadata_throttles = new Map();
        this.metadata_label_targets = new Map();

        bufferDict.$set(bufferDict.networks, this.id, []);
    }

    get isReadyForHistory() {
        if (this.state !== 'connected') {
            return false;
        }

        // If the 10s safety timeout has fired, we are authoritatively ready
        if (this.metadata_timeout_active) {
            return true;
        }

        // Network is ready when all enabled channels have received their NAMES list
        const pendingChannels = this.buffers.filter((b) => (
            b.isChannel() && b.enabled && !b.flags.names_received
        ));

        return pendingChannels.length === 0;
    }

    get iconUrl() {
        let iconToken = this.supports('DRAFT/ICON');
        if (iconToken && typeof iconToken === 'string') {
            const sanitized = Misc.sanitizeUrl(iconToken);
            return sanitized.replace('{size}', '64');
        }

        // Fallback for Ergo IRCd
        const ircd = this.supports('IRCD') || this.ircd || '';
        if (ircd.toLowerCase().includes('ergo')) {
            return '/static/ergo.svg';
        }

        return '';
    }

    get ircClient() {
        if (!this.frameworkClient) {
            this.frameworkClient = IrcClient.create(this.appState, this);
        }

        return this.frameworkClient;
    }

    get buffers() {
        return this.bufferDict.networks[this.id];
    }

    connect(...args) {
        this.ircClient.connect(...args);
    }

    bufferByName(name) {
        return this.appState.getBufferByName(this.id, name);
    }

    serverBuffer() {
        return this.appState.getBufferByName(this.id, '*');
    }

    setting(name, val) {
        if (typeof val !== 'undefined') {
            this.appState.$set(this.settings, name, val);
            return val;
        }

        return this.settings[name];
    }

    channelListConnectRemaining(now = Date.now()) {
        const delay = 30 * 1000;
        if (!this.connected_at) {
            return delay;
        }
        return Math.max(0, delay - (now - this.connected_at));
    }

    clearChannelListConnectTimer() {
        clearTimeout(this.channel_list_connect_timer);
        this.channel_list_connect_timer = null;
        this.channel_list_connect_force = false;
        this.channel_list_connect_pending = false;
    }

    scheduleChannelListAfterConnect(force = false) {
        if (force) {
            this.channel_list_connect_force = true;
        }
        if (!this.connected_at) {
            this.channel_list_connect_pending = true;
            return;
        }
        if (this.channel_list_connect_timer) {
            return;
        }

        this.channel_list_connect_timer = setTimeout(() => {
            this.channel_list_connect_timer = null;
            const scheduledForce = this.channel_list_connect_force;
            this.channel_list_connect_force = false;
            this.maybeUpdateChannelList(scheduledForce);
        }, this.channelListConnectRemaining());
    }

    maybeUpdateChannelList(force = false) {
        if (['requested', 'updating'].includes(this.channel_list_state)) {
            return;
        }

        if (this.channelListConnectRemaining() > 0) {
            this.scheduleChannelListAfterConnect(force);
            return;
        }

        const now = Date.now();
        const limit = force ? 5 : 30;
        const cooldown = limit * 60 * 1000;

        if (now - this.channel_list_last_updated < cooldown) {
            return;
        }

        this.channel_list_state = 'requested';
        this.ircClient.raw('LIST');
    }

    isChannelName(input) {
        if (typeof input !== 'string' || !input) {
            return false;
        }

        let chanPrefixes = this.supports('CHANTYPES') || '#&';
        return chanPrefixes.indexOf(input[0]) > -1;
    }

    /**
     * Check if a nick belongs to a known network service
     * @param {String} nick
     * @returns {Boolean}
     */
    isService(nick) {
        if (!nick) {
            return false;
        }

        const commonServices = [
            'nickserv', 'chanserv', 'memoserv', 'hostserv',
            'operserv', 'botserv', 'rootserv', 'helpserv',
            'statserv', 'histserv',
        ];

        const lowerNick = nick.toLowerCase();
        if (commonServices.includes(lowerNick)) {
            return true;
        }

        // Check for network-specific services if they were provided during creation
        if (this.services && Array.isArray(this.services)) {
            return this.services.some((s) => s.toLowerCase() === lowerNick);
        }

        return false;
    }

    showServerBuffer(tabName) {
        this.appState.$emit('active.component', null);
        this.appState.setActiveBuffer(this.id, this.serverBuffer().name);
        // Hacky, but the server buffer component listens for events to switch
        // between tabs
        setImmediate(() => {
            this.appState.$emit('server.tab.show', tabName || 'settings');
        });
    }

    /**
     * Check if a nick is exempt from block PM's
     * @param {String} nick of the user to check
     * @returns {Boolean} If the boolean is null a whois check is required
     */
    isNickExemptFromPmBlocks(nick) {
        // Check if nick is op of shared channel
        let buffers = this.appState.getBuffersWithUser(this.id, nick);
        for (let i = 0; i < buffers.length; i++) {
            let buffer = buffers[i];
            if (buffer.isUserAnOp(nick)) {
                return true;
            }
        }

        let user = this.appState.getUser(this.id, nick);
        if (!user || !user.hasWhois) {
            // if we have not seen or whois the user they might be a network oper
            // so return null then a whois can be performed
            return null;
        }

        if (user.operator) {
            return true;
        }
        return false;
    }

    get isUtf8() {
        let encoding = (this.connection.encoding || 'utf8').toLowerCase();
        return encoding === 'utf8' || encoding === 'utf-8';
    }

    currentUser() {
        return this.appState.getUser(this.id, this.nick);
    }

    userByName(nick) {
        return this.appState.getUser(this.id, nick);
    }

    hasCap(name) {
        return this.enabled_caps.includes(name.toLowerCase());
    }

    capValue(name) {
        return this.cap_values[name.toLowerCase()] || '';
    }

    persistenceCap() {
        return this.hasCap('draft/persistence') ?
            'draft/persistence' :
            '';
    }

    // Whether the Preferred Persistence setting applies to this network:
    // only when logged in with an account and the cap was negotiated.
    persistencePreferenceAvailable() {
        return !!this.sasl_account && this.hasCap('draft/persistence');
    }

    metadataCap() {
        if (this.hasCap('draft/metadata-3')) {
            return 'draft/metadata-3';
        }
        if (this.hasCap('draft/metadata-2')) {
            return 'draft/metadata-2';
        }
        return '';
    }

    // Negotiated webpush capability, preferring the draft name over soju's
    // vendor name. Exactly one is ever requested (see IrcClient fold).
    webpushCap() {
        if (this.hasCap('draft/webpush')) {
            return 'draft/webpush';
        }
        if (this.hasCap('soju.im/webpush')) {
            return 'soju.im/webpush';
        }
        return '';
    }

    // Whether push notifications apply to this network: only when logged in
    // with an account, the cap was negotiated, the server sent a VAPID key,
    // and the connection is persistent. Networks without the persistence
    // cap (eg. soju) skip the persistence check: they never report STATUS.
    webpushAvailable() {
        // Push extends desktop notifications; never offer it alone.
        return !!this.webpushCap() &&
            !!this.sasl_account &&
            !!this.supports('VAPID') &&
            (!this.hasCap('draft/persistence') ||
                this.persistence_status.effective === 'ON') &&
            !!this.appState.setting('buffers.show_notifications');
    }

    // Parsed draft/account-registration capability tokens. Returns null when
    // the capability is not enabled.
    accountRegistration() {
        if (!this.hasCap('draft/account-registration')) {
            return null;
        }
        return parseAccountRegistrationCap(this.capValue('draft/account-registration'));
    }

    /**
     * @param {string} name
     * @returns {any}
     */
    supports(name) {
        let val = this.isupport[name.toUpperCase()];
        if (typeof val !== 'undefined') {
            return val;
        }

        // Default values
        if (name.toUpperCase() === 'PREFIX') {
            return [
                { symbol: '~', mode: 'q' },
                { symbol: '&', mode: 'a' },
                { symbol: '@', mode: 'o' },
                { symbol: '%', mode: 'h' },
                { symbol: '+', mode: 'v' },
            ];
        }

        if (name.toUpperCase() === 'CHANTYPES') {
            return ['#', '&'];
        }

        return undefined;
    }

    supportsTag(name) {
        if (!this.hasCap('message-tags')) {
            return false;
        }

        let deny = this.supports('CLIENTTAGDENY');
        if (!deny || deny.length === 0) {
            return true;
        }

        if (typeof deny === 'string') {
            deny = deny.split(',');
        }

        const allowAll = deny[0] !== '*';
        if (allowAll) {
            return !deny.some((tag) => tag === name);
        }

        return deny.some((tag) => tag === `-${name}`);
    }

    timeToLocal(serverTimeMs) {
        return this.ircClient.network.timeToLocal(serverTimeMs);
    }

    /**
     * Resolve a message by msgid across the network, respecting security guards.
     * @param {string} msgid The authoritative IRC msgid
     * @param {BufferState} [targetBuffer] The buffer specified by the protocol (if any)
     * @param {string} [senderNick] The nick of the user performing the action (for security)
     * @returns {{message: Message, buffer: BufferState}|null}
     */
    resolveMessage(msgid, targetBuffer, senderNick) {
        if (!msgid) {
            return null;
        }

        let message = null;
        let buffer = targetBuffer;

        // 1. Try resolving in the specified buffer
        if (buffer) {
            message = buffer.messagesObj.messageIds[msgid];
            if (!message) {
                const queue = buffer.addMessageBatch.queue();
                message = queue.find((m) => m.irc_id === msgid);
            }
        }

        // 2. If not found, try the reroute map
        if (!message) {
            buffer = this.reroute_map.get(msgid);
            if (buffer) {
                message = buffer.messagesObj.messageIds[msgid];
                if (!message) {
                    const queue = buffer.addMessageBatch.queue();
                    message = queue.find((m) => m.irc_id === msgid);
                }
            }
        }

        if (!message || !buffer) {
            return null;
        }

        // 3. Security Guard for cross-buffer resolution
        if (buffer !== targetBuffer) {
            const user = senderNick ? this.appState.getUser(this.id, senderNick) : null;

            // Interaction is valid if sender is in the context buffer OR the original buffer
            const senderInContext = buffer.isChannel() && user && user.buffers[buffer.id];
            const senderInOriginal = targetBuffer && targetBuffer.isChannel() &&
                user && user.buffers[targetBuffer.id];

            // If it's a PM, the sender is always "in" their own PM queue
            const wasPm = (message.protocol_target === this.nick);

            const lenientRerouting = this.appState.setting('buffers.lenient_rerouting');

            if (!lenientRerouting && !wasPm &&
                !senderInContext && !senderInOriginal) {
                return null;
            }
        }

        return { message, buffer };
    }

    // Support '@#channel' and '++channel' formats
    extractTargetGroup(target) {
        const statusMsg = this.supports('STATUSMSG');

        if (!statusMsg) {
            return null;
        }

        let targetGroup = '';
        let targetName = target;
        for (let i = 0; i < statusMsg.length; i++) {
            if (statusMsg[i] === target[0]) {
                targetGroup = statusMsg[i];
                targetName = target.substring(1);
                break;
            }
        }

        if (!targetGroup) {
            return null;
        }

        return {
            target: targetName,
            target_group: targetGroup,
        };
    }
}
