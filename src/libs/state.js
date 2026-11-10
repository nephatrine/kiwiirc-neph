'kiwi public';

import Vue from 'vue';

import * as Misc from '@/helpers/Misc';
import { deepClone, each, find, findIndex } from '@/helpers/Utils';
import * as TextFormatting from '@/helpers/TextFormatting';
import * as Reactions from '@/helpers/Reactions';
import { configTemplates } from '@/res/configTemplates';
import NetworkState from './state/NetworkState';
import BufferState from './state/BufferState';
import UserState from './state/UserState';
import Message from './Message';
import * as MetadataCache from './MetadataCache';
import * as WebpushUtils from './WebpushUtils';

function createNewState() {
    const stateObj = {
        // May be set by a StatePersistence instance
        persistence: null,

        // Settings may be overridden via config.json
        settings: configTemplates.default,
        user_settings: {
        },
        connection: {
            // disconnected / connecting / connected
            status: 'connected',
            sessionId: '',
        },
        ui: {
            active_network: 0,
            active_buffer: '',
            last_active_buffers: [],
            app_has_focus: true,
            app_is_visible: true,
            app_width: 0,
            app_height: 0,
            is_touch: false,
            is_narrow: false,
            favicon_counter: 0,
            current_input: '',
            input_history: [],
            input_history_pos: 0,
            autocomplete_always_networks: [],
            lightbox_url: '',
            show_advanced_tab: false,
            emoji_picker: {
                visible: false,
                type: 'input', // 'input' | 'reaction'
                message: null,
                buffer: null,
                ircinput: null,
            },
            redaction_prompt: {
                visible: false,
                message: null,
                buffer: null,
            },
            hex_color_picker: {
                visible: false,
                ircinput: null,
                fg: '#000000',
                bg: '#ffffff',
                use_bg: false,
            },
        },
        networks: [],
    };

    const userDict = new Vue({
        data() {
            return {
                networks: {},
            };
        },
        /*
        (network id): {
            (lowercase nick): UserState,
            (lowercase nick): UserState,
        },
        */
    });

    const bufferDict = new Vue({
        data() {
            return {
                networks: {},
            };
        },
        /*
        (network id): [
            BufferState,
            BufferState,
        ]
        */
    });

    // Messages are seperate from the above state object to keep them from being reactive. Saves CPU
    const messages = [
        /* {
            networkid: 1,
            buffer: '#kiwiirc',
            messages: [
                Message,
                Message
            ],
        }, */
    ];

    const availableStartups = Object.create(null);

    const state = new Vue({
        data: stateObj,
        methods: {
            // Export enough state so that it can be imported in future to resume
            exportState(includeBuffers, includePasswords = true, includeNetworkPassword = null) {
                let toExport = {};
                const canIncludePassword = (network) => includePasswords &&
                    (!includeNetworkPassword || includeNetworkPassword(network));

                if (includeBuffers) {
                    toExport.networks = state.networks.map((network) => {
                        let networkObj = {
                            id: network.id,
                            name: network.name,
                            connection: {
                                nick: network.connection.nick,
                                server: network.connection.server,
                                port: network.connection.port,
                                tls: network.connection.tls,
                                path: network.connection.path,
                                // Passwords only leave the session when the user
                                // opted into Remember Password; everything else
                                // about the account still persists.
                                password: canIncludePassword(network) ?
                                    network.connection.password :
                                    '',
                                direct: network.connection.direct,
                                encoding: network.connection.encoding,
                                bncnetid: network.connection.bncnetid,
                                account: network.connection.account,
                                channels: network.connection.channels || '',
                            },
                            auto_commands: network.auto_commands,
                            settings: deepClone(network.settings),
                            username: network.username,
                            gecos: network.gecos,
                            password: canIncludePassword(network) ?
                                network.password :
                                '',
                            hidden: network.hidden,
                            is_bnc: network.is_bnc,
                            // Self profile metadata (Edit Profile SETs),
                            // re-sent after reconnects. Public by design.
                            saved_profile_metadata: deepClone(
                                network.saved_profile_metadata || {}
                            ),
                            saved_profile_owner: network.saved_profile_owner || '',
                            buffers: [],
                        };

                        networkObj.buffers = network.buffers
                            .filter((buffer) => !buffer.contextOnly)
                            .map((buffer) => {
                                let bufferObj = {
                                    name: buffer.name,
                                    key: buffer.key,
                                    enabled: !!buffer.enabled,
                                    settings: deepClone(buffer.settings),
                                    latest_messages: [],
                                };

                                buffer.latest_messages.forEach((msg) => {
                                    bufferObj.latest_messages.push(msg.serialise());
                                });

                                return bufferObj;
                            });

                        return networkObj;
                    });
                }

                const userSettings = deepClone(state.user_settings);
                if (userSettings.fileupload && userSettings.fileupload.webdav) {
                    delete userSettings.fileupload.webdav.password;
                }
                toExport.user_settings = userSettings;

                return JSON.stringify(toExport);
            },

            // Import a previously exported state to continue that state
            importState(stateStr) {
                let importObj = JSON.parse(stateStr);
                if (importObj && importObj.networks) {
                    this.resetState();
                    importObj.networks.forEach((importNetwork) => {
                        let network = new NetworkState(
                            importNetwork.id,
                            state,
                            userDict,
                            bufferDict
                        );
                        network.name = importNetwork.name;
                        network.connection = { ...network.connection, ...importNetwork.connection };
                        network.auto_commands = importNetwork.auto_commands || '';
                        // Keep defaults for settings added after a state was
                        // saved (per-network capability settings).
                        network.settings = {
                            ...network.settings,
                            ...(importNetwork.settings || {}),
                        };
                        // First check importNetwork.nick as this was used in older versions
                        // TODO: Eventually remove this importNetwork.nick check
                        network.nick = importNetwork.nick || importNetwork.connection.nick;
                        if (!network.connection.nick && importNetwork.nick) {
                            network.connection.nick = importNetwork.nick;
                        }
                        network.username = importNetwork.username;
                        network.gecos = importNetwork.gecos;
                        network.password = importNetwork.password;
                        network.hidden = importNetwork.hidden;
                        network.is_bnc = importNetwork.is_bnc;
                        network.saved_profile_metadata = importNetwork.saved_profile_metadata || {};
                        network.saved_profile_owner = importNetwork.saved_profile_owner || '';

                        this.networks.push(network);

                        importNetwork.buffers.forEach((impBuffer) => {
                            let buffer = new BufferState(
                                impBuffer.name,
                                network.id,
                                state,
                                messages
                            );
                            buffer.key = impBuffer.key;
                            buffer.enabled = !!impBuffer.enabled;
                            buffer.settings = impBuffer.settings;

                            let latestMessages = impBuffer.latest_messages || [];
                            latestMessages.forEach((msg) => {
                                let m = new Message(msg);
                                m.toBlocks(buffer, buffer.setting('extra_formatting'));
                                buffer.latest_messages.push(m);
                            });

                            network.buffers.push(buffer);
                        });
                        MetadataCache.paintNetwork(network);
                    });
                }

                if (importObj && importObj.user_settings) {
                    this.user_settings = importObj.user_settings;
                }
            },

            resetState() {
                this.networks.forEach((network) => {
                    if (network.cleanupWebpush) {
                        try {
                            network.cleanupWebpush();
                        } catch {
                            // Cleanup is best-effort.
                        }
                    }
                });
                this.$set(this.$data, 'user_settings', {});
                this.$set(this.$data, 'networks', []);
                messages.splice(0);
            },

            stateKey() {
                const startupOptions = this.settings.startupOptions || {};
                return startupOptions.state_key || 'kiwi-state';
            },

            cleanupWebpushRegistrations() {
                const legacy = WebpushUtils.cleanupLegacyRegistrations();

                // A fresh tab may not have imported saved networks yet. Do not
                // remove another tab's registrations just because this tab is
                // still empty.
                if (!this.networks.length) {
                    return legacy;
                }

                return Promise.all([
                    legacy,
                    WebpushUtils.cleanupOrphanedRegistrations(
                        this.stateKey(),
                        this.networks.map((network) => network.id)
                    ),
                ]);
            },

            forgetWebpushRegistrations() {
                return WebpushUtils.unsubscribeStateBrowserSubscriptions(this.stateKey());
            },

            setting(name, val) {
                if (typeof val !== 'undefined') {
                    if (val === this.getSetting('settings.' + name)) {
                        // Remove setting from user_settings if its the default
                        return this.setSetting('user_settings.' + name, null);
                    }
                    // Setting any setting always goes into the user own settings space
                    return this.setSetting('user_settings.' + name, val);
                }

                // Check the user specific settings before reverting to global settings
                let userSetting = this.getSetting('user_settings.' + name);
                let result = typeof userSetting !== 'undefined' ?
                    userSetting :
                    this.getSetting('settings.' + name);

                return result;
            },

            // Accept 'dotted.notation' to read a state property of any depth
            getSetting(name) {
                let parts = name.split('.');
                let val = this.$data;

                for (let i = 0; i < parts.length; i++) {
                    val = val[parts[i]];
                    if (typeof val === 'undefined') {
                        break;
                    }
                }

                return val;
            },

            // Accept 'dotted.notation' to set a state property of any depth
            setSetting(name, newVal) {
                let parts = name.split('.');
                let val = this.$data;

                for (let i = 0; i < parts.length; i++) {
                    let propName = parts[i];
                    let nextVal = val[propName];

                    if (i < parts.length - 1 && typeof nextVal === 'undefined') {
                        nextVal = this.$set(val, propName, {});
                    } else if (i === parts.length - 1) {
                        if (newVal === null) {
                            this.$delete(val, propName);
                        } else {
                            this.$set(val, propName, newVal);
                        }
                    }

                    val = nextVal;
                }

                return val;
            },

            getActiveNetwork() {
                return this.getNetwork(this.ui.active_network);
            },

            getNetwork(networkid) {
                let network = find(this.networks, {
                    id: networkid,
                });

                return network;
            },

            getNetworkFromAddress(netAddr) {
                return find(this.networks, (net) => {
                    let isMatch = netAddr.toLowerCase() === net.connection.server.toLowerCase();
                    return isMatch;
                });
            },

            getNetworkFromBncNetId(bncnetid) {
                return find(this.networks, (net) => bncnetid === net.connection.bncnetid);
            },

            addNetwork(name, nick, serverInfo) {
                // Find the current largest ID and increment it by 1
                function networkidReduce(currentMax, network) {
                    return network.id > currentMax ?
                        network.id :
                        currentMax;
                }
                let networkid = serverInfo.channelId ?
                    parseInt(serverInfo.channelId, 10) :
                    this.networks.reduce(networkidReduce, 0) + 1;

                let network = new NetworkState(networkid, state, userDict, bufferDict);
                network.name = name;
                network.username = serverInfo.username;
                network.gecos = serverInfo.gecos;
                network.password = serverInfo.account_password || '';
                network.connection.password = serverInfo.password;
                network.connection.nick = nick;
                network.connection.account = serverInfo.account || '';
                network.connection.server = serverInfo.server || '';
                network.connection.port = serverInfo.port || 6667;
                network.connection.tls = serverInfo.tls || false;
                network.connection.path = serverInfo.path || '';
                network.connection.direct = !!serverInfo.direct;
                network.connection.path = serverInfo.path || '';
                network.connection.encoding = serverInfo.encoding || 'utf8';
                network.connection.bncnetid = serverInfo.bncnetid || '';
                network.connection.channels = serverInfo.channels || '';

                if (serverInfo.services) {
                    network.services = serverInfo.services;
                }

                this.networks.push(network);

                // Add the server server buffer
                this.addBuffer(network.id, '*').joined = true;

                let eventObj = { network };
                state.$emit('network.new', eventObj);

                return network;
            },

            moveNetwork(networkid, offset) {
                const index = findIndex(this.networks, (network) => network.id === networkid);
                const target = index + offset;

                if (index < 0 || target < 0 || target >= this.networks.length) {
                    return false;
                }

                const network = this.networks[index];
                this.networks.splice(index, 1);
                this.networks.splice(target, 0, network);
                return true;
            },

            moveNetworkUp(networkid) {
                return this.moveNetwork(networkid, -1);
            },

            removeNetwork(networkid, source) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return;
                }

                if (network.state === 'connected') {
                    const endpoints = [
                        network.webpush_endpoint,
                        network.webpush_pending_endpoint,
                    ].filter(Boolean);
                    try {
                        [...new Set(endpoints)].forEach((endpoint) => {
                            network.ircClient.raw('WEBPUSH', 'UNREGISTER', endpoint);
                        });
                    } catch {
                        // The connection went away; the server will prune it.
                    }
                    network.ircClient.quit();
                }

                if (network.cleanupWebpush) {
                    try {
                        network.cleanupWebpush();
                    } catch {
                        // Cleanup is best-effort.
                    }
                }
                WebpushUtils.unsubscribeBrowserSubscription({
                    stateKey: this.stateKey(),
                    networkId: network.id,
                    unregister: true,
                }).catch(() => {});

                while (network.buffers.length > 0) {
                    this.removeBuffer(network.buffers[0]);
                }

                let findNewNetwork = false;
                if (network === this.getActiveNetwork()) {
                    findNewNetwork = true;
                }

                let idx = this.networks.indexOf(network);
                this.networks.splice(idx, 1);

                if (findNewNetwork) {
                    this.openLastActiveBuffer();
                }

                let eventObj = { network, source };
                state.$emit('network.removed', eventObj);
            },

            getActiveBuffer() {
                return this.getBufferByName(this.ui.active_network, this.ui.active_buffer);
            },

            setActiveBuffer(networkid, bufferName) {
                if (this.ui.active_network && this.ui.active_buffer) {
                    const oldBuffer = this.getBufferByName(
                        this.ui.active_network,
                        this.ui.active_buffer,
                    );
                    if (oldBuffer) {
                        oldBuffer.isVisible = false;
                    }
                }

                if (!networkid) {
                    this.ui.active_network = 0;
                    this.ui.active_buffer = '';
                    return;
                }

                if (this.setting('useBufferHistory') && this.ui.active_network) {
                    // Keep track of last 20 viewed buffers. When closing buffers we can go back
                    // to one of the previous ones
                    this.ui.last_active_buffers.push({
                        networkid: this.ui.active_network,
                        bufferName: this.ui.active_buffer,
                    });

                    let lastActive = this.ui.last_active_buffers;
                    this.ui.last_active_buffers = lastActive.splice(lastActive.length - 20);
                }

                this.ui.active_network = networkid;
                this.ui.active_buffer = bufferName;

                let buffer = this.getBufferByName(networkid, bufferName);
                if (buffer) {
                    buffer.isVisible = true;

                    // Queries are never joined, so the channel join metadata
                    // burst does not cover them. Joining a channel delivers its
                    // metadata and its members' metadata for the subscribed
                    // keys, so only a stale query is fetched here.
                    const network = buffer.getNetwork();
                    const now = Date.now();
                    const cooldown = 30 * 60 * 1000;
                    const hasCap = network && network.metadataCap();
                    const isOld = now - (buffer.lastMetadataFetch || 0) > cooldown;
                    if (
                        hasCap &&
                        isOld &&
                        buffer.isQuery() &&
                        !network.isService(buffer.name)
                    ) {
                        const keys = ['avatar', 'pronouns',
                            'display-name', 'description'];
                        network.getMetadata(buffer.name, keys);
                    }
                }
            },

            openLastActiveBuffer: function openLastActiveBuffer() {
                // if not using buffer history, just unset the active buffer
                if (!this.settings.useBufferHistory) {
                    this.setActiveBuffer();
                    return;
                }

                let targetNetwork;
                let targetBuffer;
                let lastActive = this.ui.last_active_buffers;

                // Find the last buffer in our history that still exists
                for (let i = lastActive.length - 1; i >= 0; i--) {
                    let network = this.getNetwork(lastActive[i].networkid);
                    if (!network) {
                        continue;
                    }

                    let buffer = network.bufferByName(lastActive[i].bufferName);
                    if (!buffer) {
                        continue;
                    }

                    targetNetwork = network;
                    targetBuffer = buffer;

                    // Trim the buffer history to this point
                    lastActive.splice(i);
                    break;
                }

                // Try to find a suitable buffer
                if (!targetBuffer) {
                    let network = this.getActiveNetwork() || this.networks[0];
                    if (network) {
                        targetNetwork = network;
                        let buffer = network.buffers[1];
                        if (buffer) {
                            targetBuffer = buffer;
                        } else {
                            targetBuffer = network.serverBuffer();
                        }
                    }
                }

                if (targetBuffer) {
                    this.setActiveBuffer(targetNetwork.id, targetBuffer.name);
                } else {
                    this.setActiveBuffer();
                }
            },

            updateBufferLastRead(networkid, bufferName) {
                let buffer = this.getBufferByName(networkid, bufferName);
                if (buffer) {
                    buffer.last_read = Date.now();
                    buffer.active_timeout = null;
                }
            },

            getOrAddBufferByName(networkid, bufferName) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return null;
                }

                let toMatch = network.caseLower(bufferName);
                let buffer = find(network.buffers, (b) => network.caseLower(b.name) === toMatch);

                if (!buffer) {
                    buffer = this.addBuffer(networkid, bufferName);
                }

                return buffer;
            },

            getBufferByName(networkid, bufferName) {
                if (!bufferName) {
                    return null;
                }

                let network = this.getNetwork(networkid);
                if (!network) {
                    return null;
                }

                let toMatch = network.caseLower(bufferName);
                let buffer = find(network.buffers, (b) => network.caseLower(b.name) === toMatch);

                return buffer;
            },

            findMessageByIrcId(networkid, msgid) {
                if (!msgid) {
                    return null;
                }

                const networks = networkid ?
                    [this.getNetwork(networkid)].filter(Boolean) :
                    this.networks;
                const network = networks.find((net) => (
                    net.buffers.some((buffer) => (
                        buffer.messagesObj && buffer.messagesObj.messageIds[msgid]
                    ))
                ));
                if (!network) {
                    return null;
                }

                const buffer = network.buffers.find((candidate) => (
                    candidate.messagesObj && candidate.messagesObj.messageIds[msgid]
                ));
                return {
                    network,
                    buffer,
                    message: buffer.messagesObj.messageIds[msgid],
                };
            },

            handleWebpushNotificationClick(data) {
                if (!data || typeof data !== 'object') {
                    return false;
                }
                if (data.stateKey && String(data.stateKey) !== String(this.stateKey())) {
                    return false;
                }

                const network = data.networkId ?
                    this.getNetwork(Number(data.networkId)) :
                    null;
                const msgid = data.msgid || '';

                if (network && msgid) {
                    const found = this.findMessageByIrcId(network.id, msgid);
                    if (found) {
                        this.setActiveBuffer(network.id, found.buffer.name);
                        this.$nextTick(() => {
                            found.buffer.scrollToMessage(found.message.id);
                        });
                        return true;
                    }
                }

                const target = data.target || data.nick || '';
                if (network && target) {
                    let buffer = this.getBufferByName(network.id, target);
                    if (!buffer && data.nick) {
                        buffer = this.getBufferByName(network.id, data.nick);
                    }
                    if (buffer) {
                        this.setActiveBuffer(network.id, buffer.name);
                        return true;
                    }
                }

                if (msgid) {
                    const found = this.findMessageByIrcId(null, msgid);
                    if (found) {
                        this.setActiveBuffer(found.network.id, found.buffer.name);
                        this.$nextTick(() => {
                            found.buffer.scrollToMessage(found.message.id);
                        });
                        return true;
                    }
                }

                if (target) {
                    const activeNetwork = this.getActiveNetwork();
                    let buffer = activeNetwork ?
                        this.getBufferByName(activeNetwork.id, target) :
                        null;
                    let foundNetwork = activeNetwork;

                    if (!buffer) {
                        foundNetwork = this.networks.find((net) => (
                            !!this.getBufferByName(net.id, target)
                        )) || null;
                        if (foundNetwork) {
                            buffer = this.getBufferByName(foundNetwork.id, target);
                        }
                    }

                    if (buffer) {
                        this.setActiveBuffer(foundNetwork.id, buffer.name);
                        return true;
                    }
                }

                return false;
            },

            addContextBuffer(networkid, targetName) {
                const network = this.getNetwork(networkid);
                if (!network || !targetName) {
                    return null;
                }

                const name = `*context-${network.id}-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;
                const buffer = new BufferState(name, network.id, state, messages);
                buffer.contextOnly = true;
                buffer.contextTarget = targetName;
                buffer.joined = false;
                buffer.enabled = false;
                buffer.show_input = false;
                buffer.metadata['display-name'] = targetName;
                network.buffers.push(buffer);
                state.$emit('buffer.new', { buffer });
                return buffer;
            },

            addBuffer(networkid, bufferName) {
                if (!bufferName) {
                    return false;
                }

                // If we already have this buffer, don't re-add it
                let buffer = this.getBufferByName(networkid, bufferName);
                if (buffer) {
                    return buffer;
                }

                // Make sure we at least we have this network
                let network = this.getNetwork(networkid);
                if (!network) {
                    return false;
                }

                buffer = new BufferState(bufferName, network.id, state, messages);
                network.buffers.push(buffer);
                MetadataCache.paintBuffer(network, buffer);

                let eventObj = { buffer };
                state.$emit('buffer.new', eventObj);

                return buffer;
            },

            removeBuffer(buffer) {
                let isActiveBuffer = (this.getActiveBuffer() === buffer);

                let network = this.getNetwork(buffer.networkid);
                if (!network) {
                    return;
                }

                let eventObj = { buffer };
                state.$emit('buffer.close', eventObj);

                let bufferIdx = network.buffers.indexOf(buffer);
                if (bufferIdx > -1) {
                    network.buffers.splice(bufferIdx, 1);
                }

                let messageIdx = findIndex(messages, {
                    networkid: network.id,
                    buffer: buffer.name,
                });
                if (messageIdx > -1) {
                    messages.splice(messageIdx, 1);
                }

                if (buffer.isChannel() && buffer.joined) {
                    network.ircClient.part(buffer.name);
                }

                // Remove the user from network state if no remaining common channels
                if (buffer.isQuery()) {
                    let remainingBuffers = state.getBuffersWithUser(network.id, buffer.name);
                    if (remainingBuffers.length === 0) {
                        state.removeUser(network.d, {
                            nick: buffer.name,
                        });
                    }
                }

                if (isActiveBuffer) {
                    this.openLastActiveBuffer();
                }

                // Remove this buffer from any users
                Object.keys(buffer.users).forEach((nick) => {
                    let user = buffer.users[nick];
                    delete user.buffers[buffer.id];
                });
            },

            addMessage(buffer, message) {
                // Some messages try to be added after a network has been removed, meaning no buffer
                // will be available
                if (!buffer || !buffer.getNetwork()) {
                    return undefined;
                }

                let network = buffer.getNetwork();

                // If this is an echo of our own message, try to find the local version
                // and update it with the authoritative tags/msgid from the server
                let isEcho = network.caseCompare(message.nick, network.nick);
                let msgid = message.irc_id || (message.tags ?
                    (message.tags.msgid || message.tags['draft/msgid']) :
                    null);
                let label = message.tags ? message.tags.label : null;
                if (isEcho && label) {
                    let m = buffer.messagesObj.messageLabels[label];
                    if (m) {
                        // Found by label!
                        m.irc_id = msgid;
                        m.tags = message.tags;
                        m.is_oper = !!(
                            message.tags &&
                            typeof message.tags['draft/oper'] !== 'undefined'
                        );
                        m.is_pending = false;
                        if (msgid) {
                            Vue.set(buffer.messagesObj.messageIds, msgid, m);
                        }
                        // Cleanup label map
                        delete buffer.messagesObj.messageLabels[label];
                        this.$emit('message.confirmed', { message: m, buffer });
                        return m;
                    }
                }

                // Without a label, match the echo back to our local pending copy
                // by comparing the raw text. A message replayed from chathistory
                // is never a confirmation, and a locally created message (which
                // is pending by definition) is not an incoming echo.
                let isHistoryEcho = !!(
                    message.tags && (
                        typeof message.tags['kiwi-history'] !== 'undefined' ||
                        typeof message.tags['draft/chathistory-context'] !== 'undefined'
                    )
                );
                if (isEcho && !isHistoryEcho && !message.is_pending) {
                    let bufMessages = buffer.getMessages();
                    let startIdx = Math.max(0, bufMessages.length - 20);
                    let rawText = typeof message.raw_text === 'string' ?
                        message.raw_text :
                        message.message;
                    let withinWindow = (m) => Math.abs(m.time - message.time) < 60000;
                    let adoptEcho = (m) => {
                        if (msgid) {
                            m.irc_id = msgid;
                            // Add the new IRC ID to the map for future lookups (e.g. replies)
                            Vue.set(buffer.messagesObj.messageIds, msgid, m);
                        }
                        m.tags = message.tags;
                        m.is_oper = !!(
                            message.tags &&
                            typeof message.tags['draft/oper'] !== 'undefined'
                        );
                        m.is_pending = false;
                        this.$emit('message.confirmed', { message: m, buffer });
                        return m;
                    };

                    // Search oldest first so identical messages are confirmed in
                    // the order they were sent. The msgid is optional: a server
                    // may support echo-message without supporting message-ids.
                    for (let i = startIdx; i < bufMessages.length; i++) {
                        let m = bufMessages[i];
                        if (
                            network.caseCompare(m.nick, network.nick) &&
                            m.raw_text === rawText &&
                            m.is_pending && !m.irc_id &&
                            withinWindow(m)
                        ) {
                            return adoptEcho(m);
                        }
                    }

                    // The server may rewrite the text before echoing it. If
                    // exactly one of our messages is pending then it can only be
                    // that one; anything else is ambiguous, so leave it alone.
                    let candidates = [];
                    for (let i = startIdx; i < bufMessages.length; i++) {
                        let m = bufMessages[i];
                        if (
                            network.caseCompare(m.nick, network.nick) &&
                            m.is_pending && !m.irc_id &&
                            withinWindow(m)
                        ) {
                            candidates.push(m);
                        }
                    }
                    if (candidates.length === 1) {
                        return adoptEcho(candidates[0]);
                    }
                }

                // If this message has an authoritative ID and we already have it, discard it
                if (msgid && buffer.messagesObj.messageIds[msgid]) {
                    return undefined;
                }

                let user = this.getUser(buffer.networkid, message.nick);
                let bufferMessage = new Message(message, user);
                let isNewMessage = message.time > buffer.last_read;
                bufferMessage.is_new = isNewMessage;

                if (bufferMessage.is_pending) {
                    // Set a timeout to revert the pending state if no echo arrives
                    // This is Scenario 2 (heuristic matching)
                    setTimeout(() => {
                        if (!bufferMessage.is_pending) {
                            return;
                        }

                        // Revert by marking as error
                        bufferMessage.is_pending = false;
                        bufferMessage.type = 'error';

                        this.addMessage(buffer, {
                            time: Date.now(),
                            nick: '*',
                            message: TextFormatting.t('error_confirm_timeout'),
                            type: 'error',
                        });
                    }, 60000);
                }

                if (user && user.ignore) {
                    bufferMessage.ignore = true;
                }

                bufferMessage.toBlocks(buffer, buffer.setting('extra_formatting'));

                buffer.addMessage(bufferMessage);

                // Increment the unread counter if this buffer is not active
                let includeAsActivity = false;
                let typesForActivty = ['privmsg', 'action', 'notice', 'wallops'];
                if (buffer.setting('traffic_as_activity') && message.type === 'traffic') {
                    typesForActivty.push('traffic');
                }

                if (typesForActivty.indexOf(message.type) > -1) {
                    includeAsActivity = true;
                }

                if (
                    buffer.setting('server_as_activity') &&
                    buffer.isServer() &&
                    message.type !== 'ctcp'
                ) {
                    includeAsActivity = true;
                }

                let isSelf = Misc.isSelfMessage(network, bufferMessage);

                let isHighlight = !network || buffer.isRaw() || isSelf ?
                    false :
                    Misc.mentionsNick(bufferMessage.message, network.nick);

                if (!isSelf && message.type && message.type === 'invite') {
                    // Invites should be treated as highlights
                    isHighlight = true;
                }

                // Check for extra custom highlight words
                let extraHighlights = (state.setting('highlights') || '').toLowerCase().split(' ');
                if (!isHighlight && !buffer.isRaw() && !isSelf && extraHighlights.length > 0) {
                    extraHighlights.forEach((word) => {
                        if (!word) {
                            return;
                        }

                        if (bufferMessage.message.toLowerCase().indexOf(word) > -1) {
                            isHighlight = true;
                        }
                    });
                }

                if (!isSelf && !buffer.isRaw() && state.setting('teamHighlights')) {
                    let m = bufferMessage.message;
                    if (
                        Misc.mentionsWord(m, '@everyone') ||
                        Misc.mentionsWord(m, '@channel')
                    ) {
                        isHighlight = true;
                    }

                    if (Misc.mentionsWord(m, '@here') && network && !network.away) {
                        isHighlight = true;
                    }
                }

                bufferMessage.isHighlight = isHighlight;

                if (isNewMessage && buffer.isVisible) {
                    buffer.noteVisibleMessage(bufferMessage);
                }

                // Handle buffer flags
                if (
                    isNewMessage &&
                    includeAsActivity &&
                    !buffer.isVisible &&
                    !bufferMessage.ignore
                ) {
                    buffer.incrementFlag('unread');
                    if (isHighlight) {
                        buffer.flag('highlight', true);
                    }
                    if (message.type === 'error') {
                        buffer.flag('error', true);
                    }
                }

                // Handle any notifications
                let settingAlertOn = buffer.setting('alert_on');
                let showNotifications = buffer.setting('show_notifications');
                if (
                    isNewMessage &&
                    showNotifications &&
                    settingAlertOn !== 'never' &&
                    message.type !== 'nick' &&
                    message.type !== 'mode' &&
                    message.type !== 'traffic' &&
                    message.type !== 'ctcp' &&
                    message.type !== 'info' &&
                    !buffer.isSpecial() &&
                    !bufferMessage.ignore &&
                    !isSelf
                ) {
                    let notifyTitle = '';
                    let notifyMessage = message.nick ?
                        message.nick + ': ' :
                        '';
                    notifyMessage += message.message;

                    if (isHighlight) {
                        notifyTitle = TextFormatting.t('notification_mentioned', { channel: buffer.name });
                    } else if (settingAlertOn === 'message' && !isHighlight) {
                        notifyTitle = buffer.name;
                    }

                    if (notifyTitle) {
                        this.$emit('notification.show', notifyMessage, {
                            title: notifyTitle,
                            tag: message.irc_id ?
                                WebpushUtils.notificationTag(
                                    this.stateKey(),
                                    buffer.networkid,
                                    message.irc_id
                                ) :
                                '',
                            onclick: () => {
                                state.setActiveBuffer(buffer.networkid, buffer.name);
                                state.$nextTick(() => {
                                    buffer.scrollToMessage(message.id);
                                });

                                // Newer webkit browser use parent.focus() while older webkit uses
                                // window.focus()
                                if (parent && parent.focus) {
                                    parent.focus();
                                }
                                if (window.focus) {
                                    window.focus();
                                }
                            },
                        });
                    }
                }

                if (
                    !state.ui.app_has_focus &&
                    !isSelf &&
                    message.type !== 'traffic' &&
                    message.type !== 'ctcp' &&
                    message.type !== 'info' &&
                    !buffer.isSpecial() &&
                    (
                        (buffer.setting('flash_title') === 'message') ||
                        (buffer.setting('flash_title') === 'highlight' && isHighlight)
                    )
                ) {
                    this.$emit('notification.title', true);
                }

                this.$emit('message.new', { message: bufferMessage, buffer });

                return bufferMessage;
            },

            addMessageNoRepeat(buffer, message) {
                // Add a message to the buffer only if it does not match the previous message

                if (!buffer || !buffer.getNetwork()) {
                    // Some messages try to be added after a network has been removed,
                    // meaning no buffer will be available
                    return undefined;
                }

                let lastMessage = buffer.getLastMessage();
                if (lastMessage && lastMessage.message === message.message) {
                    return undefined;
                }

                return this.addMessage(buffer, message);
            },

            getUser(networkid, nick, usersArr_) {
                let user = null;
                let users = usersArr_;
                let network = this.getNetwork(networkid);

                if (!users) {
                    users = userDict.networks[networkid];
                }

                if (users) {
                    user = users[network ? network.caseUpper(nick) : nick.toUpperCase()];
                }

                return user;
            },

            // Modify a networks user array without hitting vues reactive system until fn()
            // has completed. Good for making large changes in bulk
            usersTransaction(networkid, fn) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return;
                }

                let users = Object.assign(Object.create(null), userDict.networks[network.id]);
                fn(users);
                network.users = users;
            },

            addUser(networkid, user, usersArr_) {
                let network = null;

                // Accept either a network ID or a direct network object
                if (typeof networkid === 'number') {
                    network = this.getNetwork(networkid);
                } else {
                    network = networkid;
                }

                if (!network) {
                    return null;
                }

                let usersArr = usersArr_ || userDict.networks[network.id];
                let userObj = null;
                let userKey = network.caseUpper(user.nick);

                if (!usersArr[userKey]) {
                    userObj = new UserState(network.id, user, state);
                    Vue.set(usersArr, userKey, userObj);
                } else {
                    // Update the existing user object with any new info we have
                    userObj = state.getUser(network.id, user.nick, usersArr);
                    each(user, (val, prop) => {
                        if (typeof val !== 'undefined' && userObj[prop] !== val) {
                            userObj[prop] = val;
                        }
                    });
                }

                MetadataCache.paintUser(network, userObj);
                return userObj;
            },

            removeUser(networkid, user) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return;
                }

                let buffers = state.getBuffersWithUser(networkid, user.nick);
                buffers.forEach((buffer) => {
                    state.removeUserFromBuffer(buffer, user.nick);
                });

                Vue.delete(userDict.networks[network.id], network.caseUpper(user.nick));
            },

            addMultipleUsersToBuffer(buffer, newUsers) {
                let network = this.getNetwork(buffer.networkid);
                let bufUsers = Object.assign(Object.create(null), buffer.users);

                state.usersTransaction(network.id, (users) => {
                    newUsers.forEach((newUser) => {
                        let user = newUser.user;
                        let modes = newUser.modes;
                        let userObj = state.getUser(network.id, user.nick, users);

                        if (!userObj) {
                            userObj = this.addUser(network, user, users);
                        }
                        bufUsers[network.caseUpper(userObj.nick)] = userObj;

                        // Add the buffer to the users buffer list
                        if (!userObj.buffers[buffer.id]) {
                            state.$set(userObj.buffers, buffer.id, {
                                modes: modes || [],
                                buffer: buffer,
                            });
                        } else {
                            userObj.buffers[buffer.id].modes = modes || [];
                        }
                    });
                });

                buffer.users = bufUsers;
            },

            addUserToBuffer(buffer, user, modes) {
                let network = this.getNetwork(buffer.networkid);
                let userObj = state.getUser(network.id, user.nick);

                if (!userObj) {
                    userObj = this.addUser(network, user);
                } else {
                    // Verify the user object is correct
                    each(user, (val, prop) => {
                        if (userObj[prop] !== val) {
                            userObj[prop] = val;
                        }
                    });
                }

                buffer.addUser(userObj);

                // Add the buffer to the users buffer list
                if (!userObj.buffers[buffer.id]) {
                    state.$set(userObj.buffers, buffer.id, {
                        modes: modes || [],
                        buffer: buffer,
                    });
                } else {
                    state.$set(userObj.buffers[buffer.id], 'modes', modes || []);
                }
            },

            removeUserFromBuffer(buffer, nick) {
                buffer.removeUser(nick);
            },

            getBuffersWithUser(networkid, nick) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return [];
                }

                let buffers = [];
                network.buffers.forEach((buffer) => {
                    if (buffer.hasNick(nick)) {
                        buffers.push(buffer);
                    } else if (network.caseCompare(nick, network.nick) && buffer.isQuery()) {
                        buffers.push(buffer);
                    }
                });

                return buffers;
            },

            clearNickColours() {
                this.networks.forEach((network) => {
                    // Clear user colours
                    Object.values(network.users).forEach((user) => {
                        user.colour = '';
                    });

                    // Re-render messages with user colours
                    Object.values(network.buffers).forEach((buffer) => {
                        buffer.getMessages().forEach((msg) => {
                            if (msg.hasUserLink) {
                                msg.hasRendered = false;
                            }
                        });
                    });
                });
            },

            changeUserNick(networkid, oldNick, newNick) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return;
                }

                let user = state.getUser(network.id, oldNick);
                if (!user) {
                    return;
                }

                let normalisedNew = network.caseUpper(newNick);
                let normalisedOld = network.caseUpper(oldNick);

                user.key = normalisedNew;
                user.nick = newNick;
                user.colour = '';

                // If the nick has completely changed (ie. not just a case change) then update all
                // associated buffers user lists
                if (normalisedOld !== normalisedNew) {
                    state.$set(network.users, normalisedNew, network.users[normalisedOld]);
                    state.$delete(network.users, normalisedOld);

                    Object.keys(user.buffers).forEach((bufferId) => {
                        let buffer = user.buffers[bufferId].buffer;
                        if (!buffer.addUserBatch.queue().includes(user)) {
                            // The user is not in the queue to be added to the buffer
                            state.$set(buffer.users, normalisedNew, buffer.users[normalisedOld]);
                            state.$delete(buffer.users, normalisedOld);
                        }
                    });
                }

                let buffer = this.getBufferByName(network.id, oldNick);
                if (buffer) {
                    buffer.rename(newNick);
                }
            },

            promotePendingLabel(networkid, label) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return;
                }

                network.buffers.forEach((buffer) => {
                    // 1. Messages
                    const pendingMsg = buffer.messagesObj.messageLabels[label];
                    if (pendingMsg) {
                        pendingMsg.is_pending = false;
                        delete buffer.messagesObj.messageLabels[label];
                    }

                    // 2. Reactions
                    const pendingReaction = buffer.messagesObj.pendingReactions[label];
                    if (pendingReaction) {
                        const { message, emoji, isReacting } = pendingReaction;
                        Reactions.applyReaction(
                            message,
                            network.nick,
                            emoji,
                            isReacting,
                            { isPending: false }
                        );
                        delete buffer.messagesObj.pendingReactions[label];
                    }

                    // 3. Redactions
                    const pendingRedaction = buffer.messagesObj.pendingRedactions[label];
                    if (pendingRedaction) {
                        const { message } = pendingRedaction;
                        message.is_pending = false;
                        delete buffer.messagesObj.pendingRedactions[label];
                        network.appState.$emit('message.redaction', {
                            networkId: network.id,
                            ircId: message.irc_id,
                            buffer,
                            message,
                            redactedBy: network.nick,
                            redactionReason: pendingRedaction.reason || '',
                            redactedAt: Date.now(),
                        });
                    }
                });
            },

            revertPendingLabel(networkid, label, errorMsg) {
                let network = this.getNetwork(networkid);
                if (!network) {
                    return false;
                }

                let finalError = errorMsg || TextFormatting.t('error_confirm_timeout');
                let totalHandled = false;

                network.buffers.forEach((buffer) => {
                    let handled = false;

                    // 1. Messages
                    const pendingMsg = buffer.messagesObj.messageLabels[label];
                    if (pendingMsg) {
                        pendingMsg.is_pending = false;
                        pendingMsg.type = 'error';
                        delete buffer.messagesObj.messageLabels[label];
                        handled = true;
                    }

                    // 2. Reactions
                    const pendingReaction = buffer.messagesObj.pendingReactions[label];
                    if (pendingReaction) {
                        const { message, emoji, isReacting } = pendingReaction;
                        // Revert the local echo by applying the opposite action
                        Reactions.applyReaction(
                            message,
                            network.nick,
                            emoji,
                            !isReacting,
                            { isPending: false }
                        );
                        delete buffer.messagesObj.pendingReactions[label];
                        handled = true;
                    }

                    // 3. Redactions
                    const pendingRedaction = buffer.messagesObj.pendingRedactions[label];
                    if (pendingRedaction) {
                        const { message } = pendingRedaction;
                        message.is_redacted = false;
                        message.redacted_by = '';
                        message.redaction_reason = '';
                        message.is_pending = false;
                        delete buffer.messagesObj.pendingRedactions[label];
                        handled = true;
                    }

                    if (handled) {
                        this.addMessage(buffer, {
                            time: Date.now(),
                            nick: '*',
                            message: finalError,
                            type: 'error',
                        });
                        totalHandled = true;
                    }
                });

                return totalHandled;
            },

            revertPendingHeuristic(networkid, command, args, errorMsg) {
                let network = this.getNetwork(networkid);
                if (!network || !args || args.length === 0) {
                    return false;
                }

                const target = args[0];
                let buffer = this.getBufferByName(networkid, target);

                let finalError = errorMsg || TextFormatting.t('error_confirm_timeout');
                let handled = false;

                if (command === 'BATCH' && args.length >= 1) {
                    const batchId = args[0];
                    const batchInfo = network.active_outgoing_batches.get(batchId);
                    if (batchInfo) {
                        if (batchInfo.label) {
                            return this.revertPendingLabel(networkid, batchInfo.label, errorMsg);
                        }
                        buffer = this.getBufferByName(networkid, batchInfo.target);
                        if (buffer) {
                            const bufMessages = buffer.getMessages();
                            const startIdx = bufMessages.length - 1;
                            const endIdx = Math.max(0, bufMessages.length - 20);
                            for (let i = startIdx; i >= endIdx; i--) {
                                const m = bufMessages[i];
                                if (m.is_pending && network.caseCompare(m.nick, network.nick)) {
                                    m.is_pending = false;
                                    m.type = 'error';
                                    handled = true;
                                    break;
                                }
                            }
                        }
                        network.active_outgoing_batches.delete(batchId);
                    }
                } else if (command === 'REDACT' && args.length >= 2) {
                    const msgid = args[1];
                    const message = buffer.messagesObj.messageIds[msgid];
                    if (message && message.is_redacted && message.is_pending) {
                        message.is_redacted = false;
                        message.redacted_by = '';
                        message.redaction_reason = '';
                        message.is_pending = false;
                        handled = true;
                    }
                } else if (['PRIVMSG', 'NOTICE'].includes(command)) {
                    const bufMessages = buffer.getMessages();
                    const startIdx = bufMessages.length - 1;
                    const endIdx = Math.max(0, bufMessages.length - 20);
                    for (let i = startIdx; i >= endIdx; i--) {
                        if (bufMessages[i].is_pending &&
                            network.caseCompare(bufMessages[i].nick, network.nick)
                        ) {
                            bufMessages[i].is_pending = false;
                            bufMessages[i].type = 'error';
                            handled = true;
                            break;
                        }
                    }
                } else if (command === 'TAGMSG') {
                    // Revert most recent pending reaction
                    const label = Object.keys(buffer.messagesObj.pendingReactions).pop();
                    if (label) {
                        const pending = buffer.messagesObj.pendingReactions[label];
                        const { message, emoji, isReacting } = pending;
                        Reactions.applyReaction(
                            message,
                            network.nick,
                            emoji,
                            !isReacting,
                            { isPending: false }
                        );
                        delete buffer.messagesObj.pendingReactions[label];
                        handled = true;
                    }
                } else if (command === 'CHATHISTORY') {
                    if (buffer.flag('is_requesting_chathistory')) {
                        buffer.flag('is_requesting_chathistory', false);
                        buffer.flag('chathistory_available', false);
                        handled = true;
                    }
                }

                if (handled) {
                    this.addMessage(buffer, {
                        time: Date.now(),
                        nick: '*',
                        message: finalError,
                        type: 'error',
                    });
                }

                return handled;
            },

            getStartups() {
                return availableStartups;
            },

            logout() {
                this.networks.forEach((network) => {
                    if (network.state === 'connected') {
                        network.ircClient.quit();
                    }
                });

                // sessionStorage flag is used by startup screens to skip autoconnect/auto-loading
                // of a previous state, so that the user is presented with the login screen.
                // It is cleared by the startup screen.
                window.sessionStorage.setItem('kiwi-logout', '1');

                // Flush the latest state before reloading. The watcher saves on a
                // 1-second debounce, so without this a fast logout would reload
                // before pending changes (e.g. blanked passwords) reach storage.
                // Guarded by isPersisting so opted-out sessions never write.
                let persist = this.persistence && this.persistence.isPersisting ?
                    this.persistence.saveStateNow() :
                    Promise.resolve();

                // Small delay to let the quit commands send
                persist.finally(() => {
                    setTimeout(() => {
                        window.location.reload();
                    }, 300);
                });
            },
        },
    });

    return state;
}

let instance = null;
function singleton() {
    instance = instance || createNewState();
    return instance;
}

singleton.create = function createState() {
    return createNewState();
};

singleton.recreate = function recreateState() {
    if (instance) {
        instance.resetState();
        instance.$destroy();
        // eslint-disable-next-line
        instance._watchers.splice(0, instance._watchers.length);
    }

    instance = createNewState();
    return instance;
};

export default singleton;
