/** @module */

import Vue from 'vue';
import * as Misc from '@/helpers/Misc';
import { stripAccountSuffix } from '@/helpers/LoginFields';
import { isTwitchHost, twitchUserModes } from '@/helpers/Twitch';
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
        // The bouncer's own view of a bound network's upstream link and last
        // failure. `state`/`state_error` describe only our socket to the
        // bouncer, so an upstream that is down still looks connected locally.
        this.bnc_state = '';
        this.bnc_error = '';
        this.auto_commands = '';
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
            // Initial channel list, e.g. "#one,#two key1,key2".
            channels: '',
        };
        const config = appState.settings || {};
        const bufferDefaults = config.buffers || {};
        const bufferDefault = (name, fallback) => (
            typeof bufferDefaults[name] === 'undefined' ?
                fallback :
                bufferDefaults[name]
        );
        const fileuploadDefaults = config.fileupload || {};
        const fileuploadDefault = (name, fallback) => (
            typeof fileuploadDefaults[name] === 'undefined' ?
                fallback :
                fileuploadDefaults[name]
        );
        this.settings = {
            show_raw_caps: false,
            // Browser push notifications are a per-network opt-in for the
            // connection that negotiated webpush.
            webpushEnabled: false,
            // Personal startup stores passwords for this network by default.
            // The desktop profile may keep them in the OS keyring or the
            // plaintext fallback; the web client keeps them in localStorage.
            rememberPassword: true,
            // Settings whose availability depends on the network live here
            // instead of in the global user settings. New networks start from
            // the admin config defaults; old user values are not migrated.
            show_notifications: bufferDefault('show_notifications', true),
            persistencePreference: typeof config.persistencePreference === 'undefined' ?
                'keep' :
                config.persistencePreference,
            share_typing: bufferDefault('share_typing', true),
            lenient_rerouting: bufferDefault('lenient_rerouting', true),
            ignore_bots: bufferDefault('ignore_bots', false),
            show_redactions: bufferDefault('show_redactions', 'placeholder'),
            // Prefer FILEHOST over the global upload service when available.
            useFilehost: fileuploadDefault('use_filehost', true) !== false,
            // channel -> emoji pack load policy entry
            emojiChannelPolicies: {},
            emojiChannelPoliciesMigrated: false,
            // channel -> selected channel emoji pack ids
            emojiPackSelections: {},
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
        // Our account on this connection. Defaults to the stripped SASL
        // account until the server reports the account explicitly.
        this.current_account = '';
        this.current_account_explicit = false;
        // Bouncer provenance. A bouncer socket sends CAP LS before
        // BOUNCER BIND, so the advert belongs to the bouncer itself.
        this.advertised_caps = [];
        this.is_oper = false;
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
        this.webpush_pending_endpoint = '';
        this.webpush_error = '';
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
        // Twitch user-id -> nick, used to map Twitch state tags to users.
        def(this, 'twitch_user_ids', Object.create(null), false);
        def(this, 'connect_timeout_timer', null, true);
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
        def(this, 'metadata_sync_timers', new Map(), false);
        def(this, 'connection_generation', 0, true);

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

        const networkName = String(this.supports('NETWORK') || this.name || '').toLowerCase();
        if (networkName === 'libera.chat') {
            return '/static/libera.svg';
        }
        if (networkName === 'oftc') {
            return '/static/oftc.svg';
        }

        if (this.isTwitch()) {
            return '/static/twitch.svg';
        }

        // Fallback for Ergo IRCd
        const ircd = this.supports('IRCD') || this.ircd || '';
        if (ircd.toLowerCase().includes('ergo')) {
            return '/static/ergo.svg';
        }

        return '';
    }

    get ircdType() {
        if (this.isTwitch()) {
            return 'Twitch';
        }

        return this.ircd;
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
        if (this.isTwitch()) {
            this.channel_list_state = 'unsupported';
            return;
        }
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
        if (this.isTwitch()) {
            this.channel_list_state = 'unsupported';
            return;
        }
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

    hasAdvertisedCap(name) {
        return (this.advertised_caps || []).includes(name.toLowerCase());
    }

    hasTwitchCommands() {
        return this.hasCap('twitch.tv/commands');
    }

    hasTwitchTags() {
        return this.hasCap('twitch.tv/tags');
    }

    capValue(name) {
        return this.cap_values[name.toLowerCase()] || '';
    }

    isTwitch() {
        return isTwitchHost(this.connection && this.connection.server) ||
            this.hasAdvertisedCap('twitch.tv/commands');
    }

    rememberTwitchUserId(userId, nick) {
        if (!userId || !nick) {
            return;
        }
        this.twitch_user_ids[userId] = nick;
    }

    userByTwitchId(userId) {
        if (!userId) {
            return undefined;
        }
        const nick = this.twitch_user_ids[userId];
        return nick ? this.userByName(nick) : undefined;
    }

    applyTwitchUserTags(user, tags) {
        if (!user || !tags) {
            return user;
        }

        if (tags['user-id']) {
            this.rememberTwitchUserId(tags['user-id'], user.nick);
        }
        if (tags['display-name']) {
            Vue.set(user.metadata, 'display-name', tags['display-name']);
        }
        if (tags.color) {
            Vue.set(user.metadata, 'color', tags.color);
        }

        return user;
    }

    applyTwitchUserModes(buffer, user, tags, merge = false) {
        if (!buffer || !user || !tags) {
            return;
        }

        const computedModes = twitchUserModes(user.nick, buffer.name, tags);
        const info = user.buffers[buffer.id];
        let modes = computedModes;

        if (merge && info) {
            modes = (info.twitch_modes || []).slice();
            computedModes.forEach((mode) => {
                if (!modes.includes(mode)) {
                    modes.push(mode);
                }
            });
        }

        if (!info) {
            if (modes.length > 0) {
                Vue.set(user.buffers, buffer.id, {
                    modes: [],
                    twitch_modes: modes,
                    buffer,
                });
            }
            return;
        }

        Vue.set(info, 'twitch_modes', modes);
    }

    ensureTwitchUser(nick, username, host, tags) {
        if (!nick) {
            return undefined;
        }

        let user = this.userByName(nick);
        if (!user) {
            user = this.appState.addUser(this, {
                nick,
                username: username || '',
                host: host || '',
            });
        }

        return this.applyTwitchUserTags(user, tags);
    }

    // True when the server identifies as Ergo in 002 (network.ircd holds the
    // 'running version X' text, eg. Ergo-2.14.0). Gates Ergo-specific UI such
    // as the NickServ cheatsheet, whose commands come from an Ergo HELP dump.
    isErgo() {
        return /^ergo/i.test(this.ircd || '');
    }

    // True when the server identifies as Soju in 002 (or the 004 fallback).
    // Soju is the bouncer whose BouncerServ service can store upstream SASL
    // credentials for us. Only the controller's answer matters here.
    isSoju() {
        return /^soju/i.test(this.ircd || '');
    }

    persistenceCap() {
        return this.hasCap('draft/persistence') ?
            'draft/persistence' :
            '';
    }

    // Whether the Preferred Persistence setting applies to this network.
    // The capability belongs to the connection that negotiated it; the bouncer
    // is responsible for filtering what it advertises to bound networks.
    persistencePreferenceAvailable() {
        return this.hasCap('draft/persistence') && !!this.sasl_account;
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

    // Apply an ignore locally and keep Soju's user metadata in sync. Incoming
    // soju.im/blocked metadata sets user.ignore directly, never through here,
    // so the two directions cannot echo each other.
    setUserIgnored(user, ignored) {
        if (!user) {
            return;
        }

        user.ignore = !!ignored;
        if (!this.isSoju() || !this.metadataCap() || typeof this.setMetadata !== 'function') {
            return;
        }

        const value = ignored ? '1' : '0';
        if (user.metadata['soju.im/blocked'] === value) {
            return;
        }
        this.setMetadata(user.nick, 'soju.im/blocked', value);
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

    // Negotiated bouncer-networks capability, preferring the draft name over
    // soju's vendor name. Exactly one is ever requested (see CapNegotiation.js).
    bouncerCap() {
        if (this.hasCap('draft/bouncer-networks')) {
            return 'draft/bouncer-networks';
        }
        if (this.hasCap('soju.im/bouncer-networks')) {
            return 'soju.im/bouncer-networks';
        }
        return '';
    }

    // The negotiated bouncer-networks-notify capability. Prefer the family of
    // the base capability, then fall back to whichever notify name is enabled.
    bouncerNotifyCap() {
        const base = this.bouncerCap();
        const draft = 'draft/bouncer-networks-notify';
        const soju = 'soju.im/bouncer-networks-notify';

        if (base === 'draft/bouncer-networks' && this.hasCap(draft)) {
            return draft;
        }
        if (base === 'soju.im/bouncer-networks' && this.hasCap(soju)) {
            return soju;
        }
        if (this.hasCap(draft)) {
            return draft;
        }
        if (this.hasCap(soju)) {
            return soju;
        }
        return '';
    }

    // The unbound connection used to talk to the bouncer itself. A bound
    // connection has a bncnetid and is an ordinary IRC connection.
    isBouncerController() {
        return this.is_bnc && !this.connection.bncnetid;
    }

    // Any connection that goes through a bouncer: the unbound control
    // connection itself or one bound to a network behind it.
    isBouncerConnection() {
        return !!this.is_bnc || !!this.connection.bncnetid;
    }

    // The bouncer's view of a bound network's upstream link. `state` only
    // tracks our socket to the bouncer, so an upstream that failed still looks
    // connected here. Falls back to the transport state until the bouncer has
    // told us anything.
    bouncerState() {
        if (
            this.bnc_state &&
            this.isBouncerConnection() &&
            !this.isBouncerController()
        ) {
            return this.bnc_state;
        }
        return this.state;
    }

    // The control connection for this bouncer, when it is in the network list.
    bouncerController() {
        const networks = this.appState.networks || [];
        return networks.find((net) => net.is_bnc) || null;
    }

    // The BouncerServ command that stores this network's SASL credentials on a
    // Soju bouncer, or '' when there is nothing that can be synced. The caller
    // only prefills it for the user to send; nothing is sent automatically and
    // no reply is parsed.
    bouncerSaslCommand() {
        const controller = this.bouncerController();
        if (!controller || !controller.isSoju() || this.isBouncerController()) {
            return '';
        }

        // Soju resolves -network against networks it already knows about, so
        // the controller has to have saved this one first.
        if (!this.connection.bncnetid) {
            return '';
        }

        // saveState() uses the same rule, so the name is always one token.
        if (!/^[a-zA-Z_0-9.]+$/.test(this.name)) {
            return '';
        }

        const account = this.connection.account || this.connection.nick || '';
        const password = this.password || '';
        if (!account || !password) {
            return '';
        }

        return `sasl set-plain -network ${this.name} ${account} ${password}`;
    }

    // Whether this network is using SASL that a non-Soju bouncer has to be
    // configured for by hand. A Soju bouncer can be told through BouncerServ.
    bouncerSaslManual() {
        const controller = this.bouncerController();
        if (!controller || controller.isSoju() || this.isBouncerController()) {
            return false;
        }

        const account = this.connection.account || this.connection.nick || '';
        return !!account && !!this.password;
    }

    // Our account on this connection. The SASL account is the default until
    // the server reports an explicit account name for us.
    currentAccount() {
        if (this.current_account_explicit) {
            return this.current_account;
        }
        return stripAccountSuffix((this.sasl_account || '').trim());
    }

    // Record an explicit account name reported by the server. '*' means no
    // account; strip any /network or @client suffix.
    setCurrentAccount(account) {
        const raw = account === '*' ? '' : String(account || '').trim();
        const value = stripAccountSuffix(raw);
        if (this.current_account !== value) {
            this.current_account = value;
        }
        this.current_account_explicit = true;
    }

    resetCurrentAccount() {
        this.current_account = '';
        this.current_account_explicit = false;
    }

    // The VAPID key provided by this network's post-registration ISUPPORT.
    // Pre-BIND tokens belong to the bouncer/controller and are not used here.
    webpushVapidKey() {
        const cap = this.webpushCap();
        if (!cap) {
            return '';
        }

        const key = this.supports('VAPID');
        return typeof key === 'string' ? key : '';
    }

    // Whether push notifications apply to this network. The capability belongs
    // to the connection that negotiated it; the bouncer is responsible for
    // filtering what it advertises to bound networks.
    webpushAvailable() {
        const cap = this.webpushCap();
        if (!cap) {
            return false;
        }

        const vapid = this.webpushVapidKey();
        let persistent = true;
        if (this.hasCap('draft/persistence')) {
            persistent = this.persistence_status.effective === 'ON';
        }

        // Push extends desktop notifications; never offer it alone.
        return !!this.sasl_account &&
            !!vapid &&
            persistent &&
            !!this.setting('show_notifications');
    }

    // Parsed draft/account-registration capability tokens. Returns null when
    // the capability is not enabled.
    accountRegistration() {
        if (!this.hasCap('draft/account-registration')) {
            return null;
        }
        return parseAccountRegistrationCap(this.capValue('draft/account-registration'));
    }

    caseLower(value) {
        const str = String(value || '');
        if (this.frameworkClient && typeof this.frameworkClient.caseLower === 'function') {
            return this.frameworkClient.caseLower(str);
        }
        return str.toLowerCase();
    }

    caseUpper(value) {
        const str = String(value || '');
        if (this.frameworkClient && typeof this.frameworkClient.caseUpper === 'function') {
            return this.frameworkClient.caseUpper(str);
        }
        return str.toUpperCase();
    }

    caseCompare(left, right) {
        if (this.frameworkClient && typeof this.frameworkClient.caseCompare === 'function') {
            return this.frameworkClient.caseCompare(String(left || ''), String(right || ''));
        }
        return String(left || '').toLowerCase() === String(right || '').toLowerCase();
    }

    reindexUsers() {
        const users = this.users;
        const nextUsers = Object.create(null);
        Object.keys(users).forEach((key) => {
            const user = users[key];
            const nextKey = this.caseUpper(user.nick);
            if (!nextUsers[nextKey]) {
                nextUsers[nextKey] = user;
                user.key = nextKey;
            }
        });
        this.users = nextUsers;

        this.buffers.forEach((buffer) => {
            const nextBufferUsers = Object.create(null);
            Object.keys(buffer.users).forEach((key) => {
                const user = buffer.users[key];
                const nextKey = this.caseUpper(user.nick);
                if (!nextBufferUsers[nextKey]) {
                    nextBufferUsers[nextKey] = user;
                }
            });
            buffer.users = nextBufferUsers;
        });
    }

    isupportLimit(name) {
        const value = this.supports(name);
        if (typeof value === 'number') {
            return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
        }

        if (typeof value === 'string') {
            const text = value.trim();
            if (/^\d+$/.test(text)) {
                const limit = parseInt(text, 10);
                return limit > 0 ? limit : 0;
            }
        }

        return 0;
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
                { symbol: '@', mode: 'o' },
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

    replyTagName() {
        if (this.hasTwitchTags()) {
            return 'reply-parent-msg-id';
        }
        if (this.supportsTag('+reply')) {
            return '+reply';
        }
        if (this.supportsTag('+draft/reply')) {
            return '+draft/reply';
        }

        return '';
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

            const lenientRerouting = this.setting('lenient_rerouting');

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
