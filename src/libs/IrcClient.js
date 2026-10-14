'kiwi public';

import _ from 'lodash';
import strftime from 'strftime';
import Irc from 'irc-framework';
import * as TextFormatting from '@/helpers/TextFormatting';
import typingMiddleware from './TypingMiddleware';
import reactionMiddleware from './ReactionMiddleware';
import redactionMiddleware from './RedactionMiddleware';
import readMarkerMiddleware from './ReadMarkerMiddleware';
import saslMiddleware from './SaslMiddleware';
import batchMiddleware from './BatchMiddleware';
import metadataMiddleware from './MetadataMiddleware';
import chathistoryMiddleware from './ChathistoryMiddleware';
import * as BatchHandlers from './BatchHandlers';
import * as ServerConnection from './ServerConnection';
import * as RelayMeta from './RelayMeta';

const DESIRED_CAPS = [
    'echo-message',
    'labeled-response',
    'message-tags',
    'batch',
    'draft/multiline',
    'draft/chathistory',
    'draft/event-playback',
    'away-notify',
    'invite-notify',
    'account-notify',
    'account-tag',
    'extended-join',
    'chghost',
    'setname',
    'cap-notify',
    'multi-prefix',
    'userhost-in-names',
    'draft/metadata-2',
    'server-time',
    'extended-isupport',
    'draft/message-redaction',
    'draft/read-marker',
    'draft/relaymsg',
];

export function create(state, network) {
    let networkid = network.id;

    let ircClient = new Irc.Client({
        // Most options are set under the overloaded .connect()
        version: null,
        enable_chghost: true,
        enable_setname: true,
        enable_echomessage: true,
        message_max_length: 350,
    });

    DESIRED_CAPS.forEach((cap) => {
        ircClient.requestCap(cap);
    });

    ircClient.use(chathistoryMiddleware(network));
    ircClient.use(typingMiddleware(network));
    ircClient.use(reactionMiddleware(network));
    ircClient.use(redactionMiddleware(network));
    ircClient.use(readMarkerMiddleware(network));
    ircClient.use(metadataMiddleware(network));
    ircClient.use(saslMiddleware(network));
    ircClient.use(batchMiddleware(network));
    ircClient.use(clientMiddleware(state, network));

    // Overload the connect() function to make sure we are connecting with the
    // most recent connection details from the network state
    let originalIrcClientConnect = ircClient.connect;
    ircClient.connect = function connect(...args) {
        // Set some defaults if we don't have eveything
        if (!network.connection.nick) {
            network.connection.nick = 'Guest' + Math.floor(Math.random() * 100);
        }

        ircClient.options.host = network.connection.server;
        ircClient.options.port = network.connection.port;
        ircClient.options.tls = network.connection.tls;
        ircClient.options.path = network.connection.path;
        ircClient.options.password = network.connection.password;
        if (network.password) {
            ircClient.options.account = {
                account: network.connection.account || network.connection.nick,
                password: network.password,
            };
        } else {
            // No password so give an empty account config. This forces irc-framework to keep
            // the server password (options.password) separate from SASL
            ircClient.options.account = { };
        }
        ircClient.options.nick = network.connection.nick;
        ircClient.options.username = network.username || network.connection.nick;
        ircClient.options.gecos = network.gecos || 'Using KiwiIRC';
        ircClient.options.encoding = network.connection.encoding;
        ircClient.options.sasl_mechanism = network.connection.sasl_mechanism || state.setting('defaultSaslMechanism') || 'AUTO';
        ircClient.options.auto_reconnect = !!state.setting('autoReconnect');
        ircClient.options.auto_reconnect_max_wait = state.setting('autoReconnectMaxWait') || 30000;
        ircClient.options.auto_reconnect_max_retries = state.setting('autoReconnectMaxRetries') || 10;
        ircClient.options.sasl_disconnect_on_fail = !!state.setting('disconnectOnSaslFail');

        // Apply any irc-fw options specified in kiwiirc config
        let configOptions = state.setting('ircFramework');
        if (configOptions) {
            Object.assign(ircClient.options, configOptions);
        }

        let eventObj = { network, transport: null };
        state.$emit('network.connecting', eventObj);

        if (eventObj.transport) {
            // A plugin might use its own transport of some kind
            ircClient.options.transport = eventObj.transport;
        } else if (!network.connection.direct) {
            // A direct connection uses a websocket to connect (note: some browsers limit
            // the number of connections to the same host!).
            // A non-direct connection will connect via the configured kiwi server using
            // with our own irc-framework compatible transport.
            ircClient.options.transport = ServerConnection.createChannelConstructor(
                state.settings.kiwiServer,
                (window.location.hash || '').substr(1),
                networkid
            );
        } else {
            // Use the irc-framework default transport
            ircClient.options.transport = undefined;
        }

        originalIrcClientConnect.apply(ircClient, args);
    };

    // Overload the raw() function so that we can emit outgoing IRC messages to plugins
    let originalIrcClientRaw = ircClient.raw;
    ircClient.raw = function raw(...args) {
        let message = null;

        if (args[0] instanceof Irc.Message || (args[0] && args[0].command && args[0].params)) {
            message = args[0];
        } else {
            let rawString = ircClient.rawString(...args);
            message = Irc.ircLineParser(rawString);
        }

        let eventObj = { network, message, handled: false };
        state.$emit('ircout', eventObj);
        if (eventObj.handled) {
            return;
        }

        // Workaround for unsetting the topic as to1459() will remove the trailing colon.
        const isTopic = (
            args.length === 1
            && typeof args[0] === 'string'
            && args[0].indexOf('TOPIC') === 0
        );
        if (isTopic && args[0].lastIndexOf(':') === args[0].length - 1) {
            originalIrcClientRaw.apply(ircClient, args);
            return;
        }

        // Always pass a string to the original raw() method to avoid any
        // constructor/instanceof issues with different library versions/imports.
        const out = (typeof message.to1459 === 'function') ?
            message.to1459() :
            ircClient.rawString(...args);

        originalIrcClientRaw.apply(ircClient, [out]);
    };

    const originalIrcClientSay = ircClient.say;
    ircClient.say = function say(target, message, tags) {
        if (network.hasCap('draft/multiline') && (message.indexOf('\n') > -1 || message.length > 350)) {
            BatchHandlers.sendMultiline(network, state, 'PRIVMSG', target, message, tags);
            return;
        }
        originalIrcClientSay.apply(ircClient, [target, message, tags]);
    };

    const originalIrcClientNotice = ircClient.notice;
    ircClient.notice = function notice(target, message, tags) {
        if (network.hasCap('draft/multiline') && (message.indexOf('\n') > -1 || message.length > 350)) {
            BatchHandlers.sendMultiline(network, state, 'NOTICE', target, message, tags);
            return;
        }
        originalIrcClientNotice.apply(ircClient, [target, message, tags]);
    };

    ircClient.on('raw', (event) => {
        if (!network.setting('show_raw') && !state.setting('showRaw')) {
            return;
        }

        let buffer = state.getOrAddBufferByName(networkid, '*raw');
        state.addMessage(buffer, {
            time: Date.now(),
            nick: '',
            message: (event.from_server ? '[S] ' : '[C] ') + event.line,
        });
    });

    ircClient.on('typing', (event) => {
        let user = state.getUser(network.id, event.nick);
        if (user) {
            user.typingStatus(event.target, event.status);
        }
    });

    ircClient.on('read-marker', (event) => {
        const buffer = state.getBufferByName(networkid, event.target);
        if (!buffer || !event.timestamp) {
            return;
        }

        let time = 0;
        let authoritativeTime = 0;
        let ts = String(event.timestamp);

        if (ts.indexOf('timestamp=') === 0) {
            ts = ts.substr(10);
        }

        if (ts === '*') {
            time = Date.now();
            authoritativeTime = Date.now();
        } else if (ts.indexOf('T') !== -1) {
            // ISO8601 timestamp
            authoritativeTime = new Date(ts).getTime();
            time = network.timeToLocal(authoritativeTime);
        }

        if (authoritativeTime && authoritativeTime > buffer.flags.last_read_authoritative) {
            buffer.last_read = time;
            buffer.flags.last_read_authoritative = authoritativeTime;
            buffer.flags.unread = 0;
            buffer.flags.highlight = false;
        }

        // Set the marker received flag and attempt history request
        buffer.flags.marker_received = true;
        buffer.maybeRequestHistory();
    });

    return ircClient;
}

function getEffectiveCommand(command, event) {
    const rawVerb = (event && (event.command || event.verb)) || command;
    return (typeof rawVerb === 'string') ? rawVerb.toUpperCase() : '';
}

function handleStandardReply(command, event, network, state) {
    const type = getEffectiveCommand(command, event);
    const failedCmd = (event.params[0] || '').toUpperCase();
    const errorCode = event.params[1] || '';
    const description = event.params[event.params.length - 1] || '';
    const args = event.params.slice(2, -1);
    const label = event.tags?.label;

    let handled = false;

    if (type === 'FAIL') {
        if (label) {
            handled = state.revertPendingLabel(network.id, label, description);
        } else {
            handled = state.revertPendingHeuristic(network.id, failedCmd, args, description);
        }
    }

    if (handled) {
        return;
    }

    // Not handled by state reversion (or WARN/NOTE). Route to buffer.
    let target = args[0] || '*';
    if (failedCmd === 'INVITE' && args.length >= 2) {
        // FAIL INVITE <code_name> <nick> <target> :<description>
        target = args[1];
    } else if (failedCmd === 'BATCH' && args.length >= 1) {
        const batchInfo = network.active_outgoing_batches.get(args[0]);
        if (batchInfo) {
            target = batchInfo.target;
        }
    }

    const buffer = network.bufferByName(target) || network.serverBuffer();
    const messageType = ['FAIL', 'WARN'].includes(type) ? 'error' : 'message';

    // If a MARKREAD request fails, we should still unblock history retrieval for that buffer
    if (type === 'FAIL' && failedCmd === 'MARKREAD' && buffer) {
        buffer.flags.marker_received = true;
        buffer.maybeRequestHistory();
    }

    let finalMessage = description || `${type} ${failedCmd} ${errorCode}`;
    if (failedCmd === 'METADATA') {
        // FAIL METADATA <code_name> [target] [key] :<description>
        const codeName = errorCode;
        let key = '';
        let errTarget = args[0] || '';

        // Standard metadata failures: <target> <key>
        if (['KEY_INVALID', 'KEY_NO_PERMISSION', 'KEY_NOT_SET', 'VALUE_INVALID', 'TOO_MANY_SUBS'].includes(codeName)) {
            if (args.length >= 2) {
                key = args[1];
            }
        }

        if (codeName === 'TARGET_INVALID' && errTarget) {
            finalMessage = description || `${type} ${failedCmd} ${errTarget} (${codeName})`;
        } else if (key && errTarget) {
            finalMessage = description || `${type} ${failedCmd} ${errTarget} ${key} (${codeName})`;
        } else if (key) {
            finalMessage = description || `${type} ${failedCmd} ${key} (${codeName})`;
        } else {
            finalMessage = description || `${type} ${failedCmd} (${codeName})`;
        }
    }

    state.addMessage(buffer, {
        time: Date.now(),
        nick: '*',
        message: finalMessage,
        type: messageType,
    });
}

function clientMiddleware(state, network) {
    let networkid = network.id;
    // eslint-disable-next-line
    let numConnects = 0;
    let isRegistered = false;
    let saslSucceeded = false;
    let pendingSaslAccount = '';

    return function middlewareFn(client, rawEvents, parsedEvents) {
        parsedEvents.use(parsedEventsHandler);
        rawEvents.use(rawEventsHandler);

        client.on('connecting', () => {
            network.state_error = '';
            network.state = 'connecting';
            network.last_error = '';
            network.last_error_numeric = 0;
            client.sasl_scram = null;
            client.sasl_buffer = '';
            network.cap_values = {};
            network.metadata_timeout_active = false;
            network.active_metadata_subs = Object.create(null);
            network.metadata_throttles = new Map();
            network.metadata_label_targets = new Map();
            network.connected_at = 0;
            network.sasl_account = '';
            saslSucceeded = false;
            pendingSaslAccount = '';
            network.clearChannelListConnectTimer();
        });

        client.on('connected', () => {
            network.state_error = '';
            network.state = 'connected';
            network.connected_at = Date.now();
            if (network.channel_list_connect_pending) {
                const pendingForce = network.channel_list_connect_force;
                network.channel_list_connect_pending = false;
                network.scheduleChannelListAfterConnect(pendingForce);
            }
            network.enabled_caps = client.network.cap.enabled.map((c) => c.toLowerCase());

            let currentUser = network.currentUser();
            if (currentUser) {
                currentUser.away = '';
            }

            state.$emit('audio.play', 'startup', network);
        });

        client.on('server options', (event) => {
            const options = {};
            Object.keys(event.options).forEach((key) => {
                options[key.toUpperCase()] = event.options[key];
            });
            network.isupport = options;

            // Default BOT token to 'B' if present but empty
            if (typeof network.isupport.BOT !== 'undefined' && !network.isupport.BOT) {
                network.isupport.BOT = 'B';
            }

            if (typeof network.isupport.UTF8ONLY !== 'undefined') {
                let currentEncoding = (network.connection.encoding || 'utf8').toLowerCase();
                if (currentEncoding !== 'utf8' && currentEncoding !== 'utf-8') {
                    network.connection.encoding = 'utf8';
                    const transport = client.connection && client.connection.transport;
                    if (transport && transport.setEncoding) {
                        transport.setEncoding('utf8');
                    }
                    state.addMessage(network.serverBuffer(), {
                        time: Date.now(),
                        nick: '*',
                        message: TextFormatting.t('encoding_forced_utf8'),
                    });
                }
            }

            if (client.network.name !== 'Network' && !network.connection.bncnetid) {
                network.name = client.network.name;
            }
        });

        client.on('cap ls', (event) => {
            Object.assign(network.cap_values, event.capabilities);
            if (client.options.sasl_mechanism !== 'AUTO' || !event.capabilities.sasl) {
                return;
            }

            const saslValue = event.capabilities.sasl || '';
            const mechanisms = saslValue.toUpperCase().split(',');
            if (mechanisms.includes('SCRAM-SHA-256')) {
                client.options.sasl_mechanism = 'SCRAM-SHA-256';
            } else {
                client.options.sasl_mechanism = 'PLAIN';
            }
        });

        client.on('cap ack', (event) => {
            network.enabled_caps = client.network.cap.enabled.map((c) => c.toLowerCase());
        });

        client.on('cap new', (event) => {
            Object.assign(network.cap_values, event.capabilities);
            if (client.options.sasl_mechanism === 'AUTO' && event.capabilities.sasl) {
                const saslValue = event.capabilities.sasl || '';
                const mechanisms = saslValue.toUpperCase().split(',');
                if (mechanisms.includes('SCRAM-SHA-256')) {
                    client.options.sasl_mechanism = 'SCRAM-SHA-256';
                } else {
                    client.options.sasl_mechanism = 'PLAIN';
                }
            }

            let requested = [];
            Object.keys(event.capabilities).forEach((capName) => {
                const name = capName.toLowerCase();
                if (DESIRED_CAPS.includes(name)) {
                    client.requestCap(name);
                    requested.push(name);
                }
            });

            if (requested.length > 0) {
                let serverBuffer = network.serverBuffer();
                state.addMessage(serverBuffer, {
                    time: Date.now(),
                    nick: '',
                    message: 'Requested new capabilities: ' + requested.join(', '),
                });
            }
        });

        client.on('cap del', (event) => {
            network.enabled_caps = client.network.cap.enabled.map((c) => c.toLowerCase());
            Object.keys(event.capabilities).forEach((c) => {
                delete network.cap_values[c.toLowerCase()];
            });
            let capNames = Object.keys(event.capabilities).join(', ');
            let serverBuffer = network.serverBuffer();
            state.addMessage(serverBuffer, {
                time: Date.now(),
                nick: '',
                message: 'Capabilities removed: ' + capNames,
            });
        });

        client.on('kiwi.chathistory.start', (event) => {
            let startTime = 0;
            let endTime = 0;
            event.commands.forEach((message) => {
                if (message.time && message.time > endTime) {
                    endTime = message.time;
                }

                if (message.time && message.time < startTime) {
                    startTime = message.time;
                }
            });

            if (startTime && endTime) {
                let buffer = state.getBufferByName(networkid, event.target);
                if (buffer) {
                    buffer.clearMessageRange(startTime, endTime);
                }
            }
        });

        client.on('loggedin', (event) => {
            if (isRegistered) {
                return;
            }
            let account = event && event.account;
            if (typeof account !== 'string' || !account || account === '*') {
                return;
            }
            pendingSaslAccount = account;
            if (saslSucceeded) {
                network.sasl_account = pendingSaslAccount;
            }
        });

        client.on('loggedout', () => {
            network.sasl_account = '';
            saslSucceeded = false;
            pendingSaslAccount = '';
        });

        client.on('sasl failed', () => {
            network.sasl_account = '';
            saslSucceeded = false;
            pendingSaslAccount = '';
        });

        client.on('socket close', (err) => {
            if (network.state === 'connecting' || network.state === 'connected') {
                // Ignore stale close events if we are already reconnecting or connected
                return;
            }
            isRegistered = false;
            network.state = 'disconnected';
            network.connected_at = 0;
            network.sasl_account = '';
            saslSucceeded = false;
            pendingSaslAccount = '';
            network.clearChannelListConnectTimer();

            if (err) {
                network.state_error = (typeof err === 'string') ? err : 'err_unknown';
            }

            let currentUser = network.currentUser();
            if (currentUser) {
                currentUser.away = 'offline';
            }

            network.buffers.forEach((buffer) => {
                if (!buffer) {
                    return;
                }

                if (buffer.joined || Object.keys(buffer.users || {}).length > 0) {
                    buffer.flags.reconnect_known = true;
                }
                buffer.joined = false;
                buffer.clearUsers();
            });
        });
    };

    function rawEventsHandler(command, event, rawLine, client, next) {
        // Allow plugins to override raw IRC events
        let eventObj = { ...event, raw: rawLine, handled: false };
        state.$emit('irc.raw', command, eventObj, network);
        if (eventObj.handled) {
            return;
        }

        state.$emit('irc.raw.' + command, command, eventObj, network);
        if (eventObj.handled) {
            return;
        }

        if (command === '903' && !isRegistered) {
            saslSucceeded = true;
            if (pendingSaslAccount) {
                network.sasl_account = pendingSaslAccount;
            }
        }

        if (command === '002') {
            // Your host is server.example.net, running version InspIRCd-2.0
            let param = event.params[1] || '';
            let m = param.match(/running version (.*)$/);
            network.ircd = m ?
                m[1] :
                '';
        }

        if (command === 'CAP' && network.setting('show_raw_caps')) {
            let params = [...event.params];
            if (params[params.length - 1].indexOf(' ') > -1) {
                params[params.length - 1] = ':' + params[params.length - 1];
            }

            let buffer = network.serverBuffer();
            state.addMessage(buffer, {
                time: Date.now(),
                nick: '',
                message: event.command + ' ' + params.join(' '),
            });
        }

        next();
    }

    function parsedEventsHandler(command, event, client, next) {
        function relayMetaDeps() {
            return {
                raw: network,
                userByNick: (nick) => state.getUser(networkid, nick),
                ctcpRequest: (t, type, ...p) => client.ctcpRequest(t, type, ...p),
            };
        }

        // Trigger this event through the state object first. If it's been handled
        // somewhere else then we ignore it.
        let ircEventObj = { handled: false };
        state.$emit('irc.' + command, event, network, ircEventObj);
        if (ircEventObj.handled) {
            next();
            return;
        }

        // Ignore any of the control messages. They're transport related to kiwi internals
        if (event && event.command === 'CONTROL') {
            next();
            return;
        }

        // If there is a time difference between this client and the server, convert it
        // to match our local time so it makes sense to the user
        let eventTime = (event && event.time) ?
            network.timeToLocal(event.time) :
            Date.now();
        let serverTime = (event && event.time) || 0;
        const isHistory = !!(
            (event && event.batch && event.batch.type === 'chathistory') ||
            (event && event.tags && event.tags['kiwi-history']) ||
            (event && event.tags && typeof event.tags['draft/chathistory-context'] !== 'undefined')
        );

        const effectiveCommand = getEffectiveCommand(command, event);
        if (['FAIL', 'WARN', 'NOTE'].includes(effectiveCommand)) {
            handleStandardReply(command, event, network, state);
            next();
            return;
        }

        if (effectiveCommand === 'ACK') {
            if (event.tags && event.tags.label) {
                state.promotePendingLabel(networkid, event.tags.label);
            }
            next();
            return;
        }

        if (effectiveCommand === 'BATCH START CHATHISTORY' && client.chathistory) {
            let startTime = 0;
            let endTime = 0;
            event.commands.forEach((message) => {
                if (message.time && message.time > endTime) {
                    endTime = message.time;
                }

                if (message.time && message.time < startTime) {
                    startTime = message.time;
                }
            });

            if (startTime && endTime) {
                let buffer = state.getBufferByName(networkid, event.params[0]);
                if (buffer) {
                    buffer.clearMessageRange(startTime, endTime);
                }
            }
        }

        if (effectiveCommand === 'CHANNEL_REDIRECT') {
            let b = network.bufferByName(event.from);
            if (b) {
                b.flags.redirect_to = event.to;
            }
        }

        if (effectiveCommand === 'REGISTERED') {
            isRegistered = true;
            network.nick = event.nick;
            state.addUser(networkid, { nick: event.nick, username: client.user.username });

            let currentUser = network.currentUser();
            if (currentUser) {
                currentUser.away = '';
            }

            // Start a 10-second safety timeout for metadata synchronization.
            // If some channels fail to load NAMES within this window, we authoritatively
            // unblock history requests to ensure the UI remains responsive.
            network.metadata_timeout_active = false;
            setTimeout(() => {
                if (network.state === 'connected') {
                    network.metadata_timeout_active = true;
                    network.buffers.forEach((b) => b.maybeRequestHistory());
                }
            }, 10000);

            let serverBuffer = network.serverBuffer();
            if (numConnects === 0) {
                state.addMessage(serverBuffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: TextFormatting.t('connected_to', { network: network.name }),
                });
            }

            // Get some extra info about ourselves
            client.raw('WHO ' + event.nick);

            if (network.auto_commands) {
                network.auto_commands.split('\n').forEach((line) => {
                    state.$emit('input.raw', line[0] === '/' ? line : `/${line}`, {
                        network: network,
                        buffer: serverBuffer,
                    });
                });
            }

            // Join our channels
            // If under bouncer mode, the bouncer will send the channels were joined to instead.
            if (!network.connection.bncnetid) {
                network.buffers.forEach((buffer) => {
                    if (buffer.isChannel() && buffer.enabled) {
                        client.join(buffer.name, buffer.key);
                    }
                });
            }

            numConnects++;
        }

        if (effectiveCommand === 'SERVER OPTIONS') {
            // Already handled by client.on('server options')
        }

        // Show unhandled data from the server in the servers tab
        if (effectiveCommand === 'UNKNOWN COMMAND') {
            const verb = getEffectiveCommand(command, event);
            if ([
                'FAIL', 'WARN', 'NOTE', 'ACK', 'MARKREAD', 'REDACT',
                'METADATA', '760', '761', '766', '770', '771', '772', '774',
                'CHATHISTORY', 'TAGMSG',
            ].includes(verb)) {
                next();
                return;
            }

            let buffer = network.serverBuffer();
            let containsNick = event.params[0] === network.ircClient.user.nick;
            let isChannelMessage = network.isChannelName(event.params[1]);

            let message = '';
            if (['486', '477'].includes(event.command)) {
                // Messages from these events don't need the nick from params[0]
                message = event.params[2];
            } else if (containsNick && isChannelMessage) {
                // This error is aimed at us and has a target channel
                // replace the target buffer and remove unneeded params
                let channelBuffer = network.bufferByName(event.params[1]);
                if (channelBuffer) {
                    buffer = channelBuffer;
                }
                message = event.params.slice(2).join(', ');
            } else if (containsNick) {
                // Strip out our nick if it's the first params (many commands include this)
                message = event.params.slice(1).join(', ');
            } else {
                message = event.params.join(', ');
            }

            // Numerics for restrictions on sending messages to channels/users
            const restrictedMessages = [
                '486', // ERR_NONONREG old numeric used by unreal42
                '477', // ERR_NEEDREGGEDNICK
                '716', // RPL_TARGUMODEG
                '717', // RPL_TARGNOTIFY
            ];
            if (restrictedMessages.includes(event.command)) {
                // You must log in with services to message this user/channel
                // or CallerID +g
                buffer = state.getOrAddBufferByName(network.id, event.params[1]);

                // Only add this message if it does not match the previous message
                // Typing status messages can cause a spam of this error type
                state.addMessageNoRepeat(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '*',
                    message: message,
                    type: 'error',
                });

                if (
                    event.command === '477' &&
                    buffer.isChannel() &&
                    buffer.enabled &&
                    !buffer.joined
                ) {
                    // The buffer we tried to join requires a registered nick,
                    // disable it until the user manually tries to rejoin
                    buffer.enabled = false;
                }
            } else {
                if (!/^\d+$/.test(event.command)) {
                    message = '\x02' + event.command + '\x02 ' + message;
                }

                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: message,
                });
            }
        }

        if (effectiveCommand === 'MESSAGE' || effectiveCommand === 'TAGMSG') {
            if (event.nick) {
                const update = {};
                if (typeof event.account !== 'undefined') {
                    update.account = event.account || '';
                }
                if (event.tags && typeof event.tags.bot !== 'undefined') {
                    update.is_bot = true;
                }
                if (event.tags && typeof event.tags['draft/relaymsg'] !== 'undefined') {
                    update.relayed_by = event.tags['draft/relaymsg'] || '';
                    RelayMeta.noteRelay(
                        relayMetaDeps(),
                        networkid,
                        event.tags['draft/relaymsg'] || '',
                        event.nick
                    );
                }
                if (Object.keys(update).length > 0) {
                    state.addUser(networkid, { nick: event.nick, ...update });
                }
            }
        }

        if (effectiveCommand === 'MESSAGE') {
            let isPrivateMessage = false;
            let bufferName = event.from_server ? '*' : event.target;
            let isRerouted = false;

            const lenientRerouting = state.setting('buffers.lenient_rerouting');

            // 1. Determine the protocol destination (original buffer)
            if (!event.from_server) {
                if (event.target === client.user.nick) {
                    isPrivateMessage = true;
                    bufferName = event.nick;
                }

                // If replaying history, the batch target is our protocol destination
                if (isHistory && event.batch && event.batch.params[0]) {
                    bufferName = event.batch.params[0];
                    isPrivateMessage = !network.isChannelName(bufferName);
                }
            }

            const protocolTarget = bufferName;

            // 2. Decide if we should reroute locally based on +channel-context
            if (!event.from_server && event.tags && event.tags['+channel-context']) {
                const contextChannel = event.tags['+channel-context'];
                const targetBuffer = network.bufferByName(contextChannel);

                let canReroute = false;
                if (lenientRerouting && targetBuffer) {
                    // Lenient mode: route if the buffer exists
                    canReroute = true;
                } else if (targetBuffer && targetBuffer.isChannel()) {
                    // Strict mode: sender and receiver must both be in the channel
                    // OR it must be coming from a PM
                    const sender = state.getUser(networkid, event.nick);
                    const senderInChannel = sender && sender.buffers[targetBuffer.id];
                    const receiverInChannel = targetBuffer.joined;
                    const wasPm = (protocolTarget === event.nick);

                    if (wasPm || (senderInChannel && receiverInChannel)) {
                        canReroute = true;
                    }
                }

                if (canReroute) {
                    bufferName = contextChannel;
                    isPrivateMessage = false;
                    isRerouted = true;
                }
            }

            // Chanserv sometimes PMs messages about a channel on join in the format of
            // [#channel] welcome!
            // Redirect these to #channel
            if (
                event.nick.toLowerCase() === 'chanserv' &&
                isPrivateMessage &&
                event.message[0] === '['
            ) {
                bufferName = event.message.substr(1, event.message.indexOf(']') - 1);
            }

            // Notices from somewhere when we don't have an existing buffer for them should go into
            // the server tab. ie. notices from servers
            if (event.type === 'notice') {
                let existingBuffer = state.getBufferByName(networkid, bufferName);
                let noticeActiveBuffer = state.setting('noticeActiveBuffer');
                let activeBuffer = state.getActiveBuffer();
                let hasActiveBuffer = activeBuffer && activeBuffer.networkid === networkid;

                // If we don't have a buffer for this notice sender, either show it in our active
                // buffer or the server buffer
                if (!existingBuffer) {
                    if (noticeActiveBuffer && hasActiveBuffer && !activeBuffer.isSpecial()) {
                        bufferName = activeBuffer.name;
                    } else {
                        bufferName = '*';
                    }
                }
            }

            const PM_BLOCK_BLOCKED = false;
            // const PM_BLOCK_NOT_BLOCKED = true;
            const PM_BLOCK_REQUIRES_CHECK = null;

            let pmBlock = network.isNickExemptFromPmBlocks(event.nick);
            let blockNewPms = state.setting('buffers.block_pms');
            let buffer = state.getBufferByName(networkid, bufferName);

            let textFormatType = 'privmsg';
            if (event.type === 'action') {
                textFormatType = 'action';
            } else if (event.type === 'notice') {
                textFormatType = 'notice';
            }

            let messageBody = TextFormatting.formatText(textFormatType, {
                nick: event.nick,
                username: event.ident,
                host: event.hostname,
                text: event.message,
            });

            let message = {
                time: eventTime,
                server_time: serverTime,
                nick: event.nick,
                message: messageBody,
                type: event.type,
                tags: event.tags || {},
                is_rerouted: isRerouted,
                protocol_target: protocolTarget,
            };

            // If ignore_bots is enabled and the user is a known bot or the message has a bot tag,
            // ignore the message
            const ignoreBots = state.setting('buffers.ignore_bots');
            const messageUser = state.getUser(network.id, event.nick);
            const isBot = (messageUser && messageUser.is_bot) ||
                (event.tags && typeof event.tags.bot !== 'undefined');
            if (ignoreBots && isBot) {
                return;
            }

            // If this is a new PM and the sending user is not exempt from blocks, ignore it
            const shouldBlockPm = blockNewPms &&
                isPrivateMessage &&
                !buffer &&
                pmBlock === PM_BLOCK_BLOCKED;
            if (shouldBlockPm) {
                return;
            }

            // If we need to manually check if this user is blocked..
            // PM_BLOCK_REQUIRES_CHECK means we should whois the user to get their oper status. We
            // allways allow messages from opers.
            const shouldCheckPm = blockNewPms &&
                isPrivateMessage &&
                !buffer &&
                pmBlock === PM_BLOCK_REQUIRES_CHECK;
            if (shouldCheckPm) {
                // if the nick is in pendingPms it has already issued a whois request
                let awaitingWhois = !!_.find(network.pendingPms, { nick: event.nick });
                network.pendingPms.push({ bufferName, message });

                // Don't send another whois if we are already awaiting another
                if (awaitingWhois) {
                    return;
                }

                network.ircClient.whois(event.nick, event.nick, (whoisData) => {
                    network.pendingPms.forEach((pm, idx, obj) => {
                        let nickLower = pm.message.nick.toLowerCase();
                        if (nickLower === whoisData.nick.toLowerCase()) {
                            if (whoisData.operator) {
                                buffer = state.getOrAddBufferByName(network.id, pm.bufferName);
                                state.addMessage(buffer, pm.message);
                            }
                            obj.splice(idx, 1);
                        }
                    });
                });

                return;
            }

            // Make sure we have a buffer for our message
            if (!buffer) {
                buffer = state.getOrAddBufferByName(networkid, bufferName);
            }

            // Receiving a message for a channel is authoritative proof we are in it
            if (buffer.isChannel() && !buffer.joined) {
                buffer.joined = true;
                buffer.enabled = true;
            }

            const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
            if (!isHandledBatch) {
                let bufferMessage = state.addMessage(buffer, message);
                if (bufferMessage && isRerouted) {
                    // Rerouted messages should always be treated as highlights in the channel
                    bufferMessage.isHighlight = true;

                    // Track rerouted messages for interaction resolution
                    if (bufferMessage.irc_id) {
                        network.reroute_map.set(bufferMessage.irc_id, buffer);
                    }
                }
            }
        }

        if (effectiveCommand === 'WALLOPS') {
            let buffer = state.getOrAddBufferByName(networkid, '*');
            let messageBody = TextFormatting.formatText('wallops', {
                text: event.message,
            });

            state.addMessage(buffer, {
                time: eventTime,
                server_time: serverTime,
                nick: event.nick,
                message: messageBody,
                type: 'wallops',
            });
        }

        if (effectiveCommand === 'JOIN') {
            RelayMeta.noteBotOnline(relayMetaDeps(), networkid, event.nick);
            let targetName = event.channel;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    targetName = event.batch.params[0];
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            }
            // If we have any buffers marked as being redirected to this new channel, update
            // that buffer instead of creating a new one
            if (!isHistory && event.nick === client.user.nick) {
                network.buffers.forEach((b) => {
                    if ((b.flags.redirect_to || '').toLowerCase() === targetName.toLowerCase()) {
                        state.$delete(b.flags, 'redirect_to');
                        b.rename(targetName);
                    }
                });
            }

            let buffer = state.getOrAddBufferByName(networkid, targetName);

            // The case does not match, update buffer.name to the casing sent by the server
            if (!isHistory && buffer.name !== targetName) {
                buffer.rename(targetName);
            }

            if (!isHistory) {
                state.addUserToBuffer(buffer, {
                    nick: event.nick,
                    username: event.ident,
                    host: event.hostname,
                    realname: event.gecos,
                    account: event.account || '',
                });

                if (event.nick === client.user.nick) {
                    buffer.enabled = true;
                    buffer.joined = true;
                    buffer.flags.channel_badkey = false;
                    network.ircClient.raw('MODE', event.channel);
                    if (!(numConnects > 1 && buffer.flags.reconnect_known)) {
                        network.ircClient.who(event.channel);
                    }
                    state.$delete(buffer.flags, 'reconnect_known');
                }
            }

            let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_joinparts');
            if (!ignoreEvent || event.nick === client.user.nick) {
                let nick = buffer.setting('show_hostnames') ?
                    TextFormatting.formatUserFull(event) :
                    TextFormatting.formatUser(event);

                let joinKey = (event.nick === client.user.nick && numConnects > 1)
                    ? 'has_reconnected'
                    : 'has_joined';
                let messageBody = TextFormatting.formatAndT(
                    'channel_join',
                    null,
                    joinKey,
                    { nick: nick }
                );

                let typeExtra = (event.nick === client.user.nick) ? 'join_self' : 'join';

                const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
                if (!isHandledBatch) {
                    state.addMessage(buffer, {
                        time: eventTime,
                        server_time: serverTime,
                        nick: event.nick,
                        message: messageBody,
                        type: 'traffic',
                        type_extra: typeExtra,
                    });
                }
            }
        }
        if (effectiveCommand === 'KICK') {
            let targetName = event.channel;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    targetName = event.batch.params[0];
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            }
            let buffer = state.getOrAddBufferByName(networkid, targetName);

            if (!isHistory) {
                state.removeUserFromBuffer(buffer, event.kicked);

                if (event.kicked === client.user.nick) {
                    buffer.joined = false;
                    buffer.enabled = false;
                    buffer.clearUsers();
                }
            }

            let messageBody = '';
            let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_joinparts');
            let isUserInvolved = [event.kicked, event.nick].includes(client.user.nick);
            if (!ignoreEvent || isUserInvolved) {
                if (event.kicked === client.user.nick) {
                    messageBody = TextFormatting.formatAndT(
                        'channel_selfkick',
                        { reason: event.message },
                        'kicked_you_from',
                        {
                            nick: TextFormatting.formatUser(event),
                            channel: event.channel,
                        }
                    );
                } else {
                    messageBody = TextFormatting.formatAndT(
                        'channel_kicked',
                        { reason: event.message },
                        'was_kicked_from',
                        {
                            nick: event.kicked,
                            channel: event.channel,
                            chanop: TextFormatting.formatUser(event.nick),
                        }
                    );
                }

                let typeExtra = (isUserInvolved) ? 'kick_self' : 'kick';

                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: event.nick,
                    message: messageBody,
                    type: 'traffic',
                    type_extra: typeExtra,
                });
            }
        }
        if (effectiveCommand === 'PART') {
            let targetName = event.channel;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    targetName = event.batch.params[0];
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            }
            let buffer = state.getBufferByName(networkid, targetName);
            if (!buffer) {
                return;
            }

            if (!isHistory) {
                state.removeUserFromBuffer(buffer, event.nick);
                if (event.nick === client.user.nick) {
                    buffer.joined = false;
                    buffer.enabled = false;
                    buffer.clearUsers();
                }

                // Remove the user from network state if no remaining common channels
                let remainingBuffers = state.getBuffersWithUser(networkid, event.nick);
                if (remainingBuffers.length === 0) {
                    state.removeUser(networkid, {
                        nick: event.nick,
                    });
                }
            }

            let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_joinparts');
            if (!ignoreEvent || event.nick === client.user.nick) {
                let nick = buffer.setting('show_hostnames') ?
                    TextFormatting.formatUserFull(event) :
                    TextFormatting.formatUser(event);

                let messageBody = TextFormatting.formatAndT(
                    'channel_part',
                    { reason: event.message },
                    'has_left',
                    { nick: nick },
                );

                let typeExtra = (event.nick === client.user.nick) ? 'part_self' : 'part';

                const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
                if (!isHandledBatch) {
                    state.addMessage(buffer, {
                        time: eventTime,
                        server_time: serverTime,
                        nick: event.nick,
                        message: messageBody,
                        type: 'traffic',
                        type_extra: typeExtra,
                    });
                }
            }
        }
        if (effectiveCommand === 'QUIT') {
            let buffers = [];
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    const b = network.bufferByName(event.batch.params[0]);
                    if (b) {
                        buffers.push(b);
                    }
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            } else {
                buffers = state.getBuffersWithUser(networkid, event.nick);
            }

            buffers.forEach((buffer) => {
                if (!buffer) {
                    return;
                }

                if (!isHistory && event.nick === client.user.nick) {
                    buffer.joined = false;
                    buffer.clearUsers();
                }

                let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_joinparts');
                if (ignoreEvent && event.nick !== client.user.nick) {
                    return;
                }

                let nick = buffer.setting('show_hostnames') ?
                    TextFormatting.formatUserFull(event) :
                    TextFormatting.formatUser(event);

                let messageBody = TextFormatting.formatAndT(
                    'channel_quit',
                    { reason: event.message },
                    'has_left',
                    { nick: nick }
                );

                let typeExtra = (event.nick === client.user.nick) ? 'quit_self' : 'quit';

                const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
                if (!isHandledBatch) {
                    state.addMessage(buffer, {
                        time: eventTime,
                        server_time: serverTime,
                        nick: event.nick,
                        message: messageBody,
                        type: 'traffic',
                        type_extra: typeExtra,
                    });
                }
            });

            if (!isHistory) {
                // Set the user as away before removing so away status indicators are updated
                let user = state.getUser(networkid, event.nick);
                if (user) {
                    user.away = 'offline';
                }

                state.removeUser(networkid, {
                    nick: event.nick,
                });
            }
        }

        if (effectiveCommand === 'INVITE') {
            let buffer = network.bufferByName(event.channel);
            if (!buffer) {
                buffer = network.serverBuffer();
                let activeNetwork = state.getActiveNetwork();
                let activeBuffer = state.getActiveBuffer();
                if (network === activeNetwork && !activeBuffer.isSpecial()) {
                    buffer = activeBuffer;
                }
            }

            let translationKey = 'invited_other';
            if (event.invited === network.currentUser().nick) {
                translationKey = 'invited_you';
            } else if (event.nick === network.currentUser().nick) {
                translationKey = 'invited_inviter';
            }

            state.addMessage(buffer, {
                nick: '',
                time: eventTime,
                server_time: serverTime,
                type: 'invite',
                tags: event.tags || {},
                message: TextFormatting.t(translationKey, {
                    nick: event.nick,
                    invited: event.invited,
                    channel: event.channel,
                }),
            });
        }

        if (effectiveCommand === 'ACCOUNT') {
            if (!isHistory) {
                state.addUser(networkid, { nick: event.nick, account: event.account || '' });
            }
        }

        if (effectiveCommand === 'WHOIS' && !event.error) {
            const userObj = {
                nick: event.nick,
                host: event.hostname,
                username: event.ident,
                realname: event.real_name,
            };

            // Whois items that maybe will exist
            ['away', 'account', 'bot'].forEach((prop) => {
                if (typeof event[prop] !== 'undefined') {
                    if (prop === 'bot') {
                        userObj.is_bot = !!event[prop];
                    } else {
                        userObj[prop] = event[prop] || '';
                    }
                }
            });

            const user = state.addUser(networkid, userObj);
            Object.keys(user.whois).forEach((prop) => (
                user.whois[prop] = event[prop] ?? ''
            ));

            user.hasWhois = true;
        }

        if (effectiveCommand === 'AWAY') {
            if (!isHistory) {
                state.addUser(networkid, {
                    nick: event.nick,
                    away: event.message || '',
                });
            }

            let buffer = null;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    buffer = network.bufferByName(event.batch.params[0]);
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            } else if (event.nick === client.user.nick) {
                buffer = state.getActiveBuffer();
            }

            if (buffer) {
                if (!isHistory && event.nick === client.user.nick) {
                    network.away = 'away';
                }
                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '*',
                    type: 'presence',
                    message: event.message,
                });
            }
        }

        if (effectiveCommand === 'BACK') {
            if (!isHistory) {
                state.addUser(networkid, {
                    nick: event.nick,
                    away: '',
                });
            }

            let buffer = null;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    buffer = network.bufferByName(event.batch.params[0]);
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            } else if (event.nick === client.user.nick) {
                buffer = state.getActiveBuffer();
            }

            if (buffer) {
                if (!isHistory && event.nick === client.user.nick) {
                    network.away = '';
                }
                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '*',
                    type: 'presence',
                    message: event.message,
                });
            }
        }

        if (effectiveCommand === 'WHOLIST') {
            if (!isHistory) {
                state.usersTransaction(networkid, (users) => {
                    event.users.forEach((eventUser) => {
                        if (!eventUser || !eventUser.nick) {
                            return;
                        }
                        let userObj = {
                            nick: eventUser.nick,
                            host: eventUser.hostname || undefined,
                            username: eventUser.ident || undefined,
                            away: eventUser.away ? 'Away' : '',
                            realname: eventUser.real_name,
                            account: eventUser.account || undefined,
                            is_bot: !!eventUser.bot,
                        };
                        let user = state.addUser(networkid, userObj, users);
                        if (!user) {
                            // Should never happen as this network should always exist
                            return;
                        }

                        let buffer = network.bufferByName(eventUser.channel);
                        if (!buffer || !user.buffers || !user.buffers[buffer.id]) {
                            return;
                        }

                        // Add all the user channel modes
                        let userBuf = user.buffers[buffer.id];
                        if (!userBuf || !userBuf.modes) {
                            return;
                        }
                        let modes = userBuf.modes;
                        if (eventUser.channel_modes) {
                            eventUser.channel_modes.forEach((mode) => {
                                if (modes.indexOf(mode) === -1) {
                                    modes.push(mode);
                                }
                            });
                        }

                        Object.keys(user.whoFlags).forEach((flag) => {
                            if (typeof eventUser[flag] === 'boolean') {
                                user.whoFlags[flag] = eventUser[flag];
                            }
                        });
                        user.hasWhoFlags = true;
                    });
                });
            }
        }

        if (effectiveCommand === 'CHANNEL LIST START') {
            network.channel_list_cache = [];
            network.channel_list_state = 'updating';
        }
        if (effectiveCommand === 'CHANNEL LIST') {
            network.channel_list_state = 'updating';
            // Filter private channels from the channel list
            let filteredEvent = _.filter(event, (o) => o.channel !== '*');
            // Store the channels in channel_list_cache before moving it all to
            // channel_list at the end. This gives a huge performance boost since
            // it doesn't need to be all reactive for every update
            network.channel_list_cache = (network.channel_list_cache || []).concat(filteredEvent);
        }
        if (effectiveCommand === 'CHANNEL LIST END') {
            network.channel_list = network.channel_list_cache || [];
            network.channel_list_state = 'updated';
            network.channel_list_last_updated = Date.now();
            delete network.channel_list_cache;
        }

        if (effectiveCommand === 'MOTD') {
            let buffer = network.serverBuffer();
            let messageBody = TextFormatting.formatText('motd', {
                text: event.motd,
            });
            state.addMessage(buffer, {
                time: eventTime,
                server_time: serverTime,
                nick: '',
                message: messageBody,
                type: 'motd',
            });
        }

        if (effectiveCommand === 'NICK IN USE') {
            let shouldChangeNick = !client.connection.registered && state.setting('changeNickOnCollision');
            let newNick = event.nick.replace(/\d+$/, '') + rand(1, 99);

            let translationKey = shouldChangeNick ? 'nick_in_use_retrying' : 'error_nick_in_use';
            let translationVars = {
                nick: event.nick,
                newnick: newNick,
            };

            let messageBody = TextFormatting.formatAndT(
                'nickname_alreadyinuse',
                null,
                translationKey,
                translationVars,
            );

            let message = {
                time: eventTime,
                server_time: serverTime,
                nick: '',
                message: messageBody,
                type: 'error',
            };

            let activeBuffer = state.getActiveBuffer();
            let buffer = network.serverBuffer();

            if (activeBuffer && activeBuffer.networkid === network.id) {
                buffer = activeBuffer;
            }
            if (buffer) {
                state.addMessage(buffer, message);
            }

            if (shouldChangeNick) {
                client.changeNick(newNick);
            } else if (!client.connection.registered) {
                network.last_error = messageBody;
                network.ircClient.connection.end();
            }
        }

        if (effectiveCommand === 'NICK') {
            if (!isHistory) {
                if (event.nick === client.user.nick) {
                    network.nick = event.new_nick;
                }

                state.changeUserNick(networkid, event.nick, event.new_nick);
            }

            let messageBody = TextFormatting.formatAndT(
                'nick_changed',
                null,
                'now_known_as',
                { nick: event.nick, newnick: event.new_nick },
            );

            let typeExtra = (event.nick === client.user.nick) ? 'nick_self' : '';

            let buffers = [];
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    const b = network.bufferByName(event.batch.params[0]);
                    if (b) {
                        buffers.push(b);
                    }
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            } else {
                buffers = state.getBuffersWithUser(networkid, event.new_nick);
            }

            buffers.forEach((buffer) => {
                let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_nick_changes');
                if (ignoreEvent && event.nick !== client.user.nick) {
                    return;
                }

                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: messageBody,
                    type: 'nick',
                    type_extra: typeExtra,
                });
            });
        }

        if (effectiveCommand === 'USERLIST') {
            let buffer = state.getOrAddBufferByName(networkid, event.channel);

            // Receiving a userlist is authoritative proof we are in the channel
            if (!isHistory && !buffer.joined) {
                buffer.joined = true;
                buffer.enabled = true;
            }

            let users = [];
            event.users.forEach((user) => {
                if (!user || !user.nick) {
                    return;
                }
                users.push({
                    user: {
                        nick: user.nick,
                        username: user.ident,
                        hostname: user.hostname,
                    },
                    modes: user.modes || [],
                });
            });

            if (!isHistory) {
                state.addMultipleUsersToBuffer(buffer, users);
            }

            if (!isHistory) {
                // If the userlist is replayed outside of history, it's the authoritative
                // list for the current session.
                buffer.flags.names_received = true;
                // Attempt to trigger history for all buffers now that the network state
                // has evolved (one more channel ready).
                network.buffers.forEach((b) => b.maybeRequestHistory());
            }
        }

        if (effectiveCommand === 'USER UPDATED') {
            if (!isHistory) {
                const user = network.userByName(event.nick);
                if (user) {
                    Object.entries(event).forEach(([key, val]) => {
                        if (key.indexOf('new_') !== 0) {
                            return;
                        }

                        const paramName = key.substr(4);
                        switch (paramName) {
                        case 'gecos':
                            user.realname = val;
                            break;
                        case 'ident':
                            user.username = val;
                            break;
                        case 'hostname':
                            user.host = val;
                            break;
                        default:
                        }
                    });
                }
            }
        }

        if (effectiveCommand === 'CHANNEL INFO') {
            let buffer = network.bufferByName(event.channel);
            if (!buffer || !buffer.modes) {
                return;
            }

            if (event.modes) {
                let modeStrs = [];

                if (!buffer.modes) {
                    return;
                }

                event.modes.forEach((mode) => {
                    let adding = mode.mode[0] === '+';
                    let modeChar = mode.mode.substr(1);

                    if (!isHistory) {
                        if (adding) {
                            state.$set(buffer.modes, modeChar, mode.param);
                        } else if (!adding) {
                            state.$delete(buffer.modes, modeChar);
                        }
                    }

                    modeStrs.push(mode.mode + (mode.param ? ' ' + mode.param : ''));
                });

                if (buffer.flags.requested_modes) {
                    state.addMessage(buffer, {
                        time: eventTime,
                        server_time: serverTime,
                        nick: '*',
                        message: buffer.name + ' ' + modeStrs.join(', '),
                    });
                }
            }

            if (!isHistory && event.created_at) {
                buffer.created_at = new Date(event.created_at * 1000);
            }

            if (event.created_at && buffer.flags.requested_modes) {
                let tFormat = buffer.setting('timestamp_full_format');
                let timeCreated = tFormat ?
                    strftime(tFormat, new Date(event.created_at * 1000)) :
                    (new Date(event.created_at * 1000)).toLocaleString();

                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '*',
                    message: buffer.name + ' ' + timeCreated,
                });
            }
        }

        if (effectiveCommand === 'MODE') {
            let buffer = network.bufferByName(event.target);
            let modeStrs = {};
            if (buffer) {
                // Join all the same mode changes together so they can be shown on one
                // line such as "prawnsalad sets +b on nick1, nick2"
                event.modes.forEach((mode) => {
                    modeStrs[mode.mode] = modeStrs[mode.mode] || [];

                    // If this mode has a user prefix then we need to update the user object
                    let prefix = _.find(network.supports('PREFIX'), {
                        mode: mode.mode[1],
                    });

                    if (prefix) {
                        let user = state.getUser(network.id, mode.param);
                        if (!isHistory && user && user.buffers && user.buffers[buffer.id]) {
                            let adding = mode.mode[0] === '+';
                            let userBuf = user.buffers[buffer.id];
                            if (userBuf && userBuf.modes) {
                                let modes = userBuf.modes;
                                let modeIdx = modes.indexOf(prefix.mode);

                                // Add or remove the mode from the users mode list
                                if (adding && modeIdx === -1) {
                                    modes.push(prefix.mode);
                                } else if (!adding && modeIdx > -1) {
                                    modes.splice(modeIdx, 1);
                                }
                            }
                        }

                        modeStrs[mode.mode].push({ target: mode.param });
                    } else {
                        // Not a user prefix, add it as a channel mode
                        // TODO: Why are these not appearing as the 'channel info' command?
                        let adding = mode.mode[0] === '+';
                        let modeChar = mode.mode.substr(1);

                        if (!isHistory) {
                            if (adding) {
                                state.$set(buffer.modes, modeChar, mode.param);
                            } else if (!adding) {
                                state.$delete(buffer.modes, modeChar);
                            }
                        }

                        modeStrs[mode.mode].push({ target: buffer.name, param: mode.param });
                    }
                });

                // Mode -> locale ID mappings
                // If a mode isn't found here, the local ID modes_other is used
                let modeLocaleIds = {
                    '+o': 'modes_give_ops',
                    '-o': 'modes_take_ops',
                    '+h': 'modes_give_halfops',
                    '-h': 'modes_take_halfops',
                    '+v': 'modes_give_voice',
                    '-v': 'modes_take_voice',
                    '+a': 'modes_give_admin',
                    '-a': 'modes_take_admin',
                    '+q': 'modes_give_owner',
                    '-q': 'modes_take_owner',
                    '+b': 'modes_gives_ban',
                    '-b': 'modes_takes_ban',
                };

                let prefixes = network.supports('PREFIX');
                Object.keys(modeLocaleIds).forEach((mode) => {
                    let supported = mode[1] === 'b' || prefixes.find((p) => mode[1] === p.mode);
                    if (!supported) {
                        delete modeLocaleIds[mode];
                    }
                });

                // Some modes have specific data for its locale data while most
                // use a default. The returned objects are passed to the translation
                // functions to build the translation
                let modeLocaleDataBuilders = {
                    default(targets, mode) {
                        const paramStr = targets.map((t) => t.param).filter((p) => !!p).join(', ');
                        return {
                            mode: mode + (paramStr ? ' ' + paramStr : ''),
                            target: targets[0].target,
                            nick: event.nick,
                        };
                    },
                    b(targets, mode) {
                        return {
                            mode: mode,
                            target: targets.map((t) => t.param).join(', '),
                            nick: event.nick,
                        };
                    },
                };

                // Show one line per mode, listing each effecting user
                _.each(modeStrs, (targets, mode) => {
                    let targetNicks = targets.map((t) => t.target);
                    let ignoreEvent = state.setting('skipHiddenMessages') && !buffer.setting('show_mode_changes');
                    let isUserInvolved = [event.nick, ...targetNicks].includes(client.user.nick);
                    if (ignoreEvent && !isUserInvolved) {
                        return;
                    }

                    // Find a locale data builder for this mode
                    let builders = modeLocaleDataBuilders;
                    let localeDataFn = builders[mode[1]] || builders.default;
                    let localeData = localeDataFn(targets, mode);

                    // Translate using the built locale data
                    let localeKey = modeLocaleIds[mode] || 'modes_other';
                    let text = TextFormatting.t(localeKey, localeData);

                    let messageBody = TextFormatting.formatText('mode', {
                        nick: event.nick,
                        username: event.ident,
                        host: event.hostname,
                        target: targetNicks.join(', '),
                        text,
                    });

                    let typeExtra = (isUserInvolved) ?
                        'mode_self' :
                        '';

                    const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
                    if (!isHandledBatch) {
                        state.addMessage(buffer, {
                            time: eventTime,
                            server_time: serverTime,
                            nick: '',
                            message: messageBody,
                            type: 'mode',
                            type_extra: typeExtra,
                        });
                    }
                });
            } else {
                if (!isHistory && event.target === network.nick) {
                    let user = network.currentUser();

                    if (user && user.modes) {
                        event.modes.forEach((item) => {
                            if (!item || !item.mode) {
                                return;
                            }
                            if (item.mode[0] === '+') {
                                const existIdx = user.modes.findIndex(
                                    (uItem) => uItem && uItem.mode === item.mode[1]
                                );
                                if (existIdx === -1) {
                                    user.modes.push({
                                        mode: item.mode[1],
                                        param: item.param,
                                    });
                                }
                            } else {
                                const removeIdx = user.modes.findIndex(
                                    (uItem) => uItem && uItem.mode === item.mode[1]
                                );

                                if (removeIdx !== -1) {
                                    user.modes.splice(removeIdx, 1);
                                }
                            }
                        });
                    }
                }

                // target is not a channel buffer (user mode ?)
                // if mode had param, show in a new line
                let modeslines = {};

                // Group each - or + modes to each of their own message lines
                event.modes.forEach((mode) => {
                    if (mode.param) {
                        modeslines[mode.mode] = ' ' + mode.param;
                    } else if (mode.mode[0] === '-') {
                        if (!modeslines['-']) {
                            modeslines['-'] = '';
                        }
                        modeslines['-'] += mode.mode.slice(1);
                    } else {
                        if (!modeslines['+']) {
                            modeslines['+'] = '';
                        }
                        if (mode.mode[0] === '+') {
                            modeslines['+'] += mode.mode.slice(1);
                        } else {
                            modeslines['+'] += mode.mode;
                        }
                    }
                });

                let serverBuffer = network.serverBuffer();
                _.each(modeslines, (mode, value) => {
                    let text = TextFormatting.t('modes_other', {
                        nick: event.nick,
                        target: event.target,
                        mode: value + mode,
                    });
                    let messageBody = TextFormatting.formatText('mode', {
                        nick: event.nick,
                        username: event.ident,
                        host: event.hostname,
                        target: event.target,
                        text,
                    });
                    const isHandledBatch = event.batch && ['netsplit', 'netjoin'].includes(event.batch.type);
                    if (!isHandledBatch) {
                        state.addMessage(serverBuffer, {
                            time: eventTime,
                            server_time: serverTime,
                            nick: '',
                            message: messageBody,
                            type: 'mode',
                            type_extra: 'mode_self',
                        });
                    }
                });
            }
        }

        if (effectiveCommand === 'BANLIST') {
            let buffer = state.getBufferByName(networkid, event.channel);
            let serverBuffer = network.serverBuffer();
            let targetBuffer = buffer || serverBuffer;

            if (!buffer || buffer.flags.requested_banlist) {
                let banText = '\x02';

                if (targetBuffer === serverBuffer) {
                    banText += event.channel + '  ';
                }
                banText += TextFormatting.t('banned') + ' [+b]\x02\n';

                if (!event.bans || event.bans.length === 0) {
                    banText += TextFormatting.t('bans_nobody');
                } else {
                    _.each(event.bans, (ban) => {
                        let dateStr = (new Date(ban.banned_at * 1000)).toLocaleDateString();
                        banText += `${ban.banned} [\x1d${ban.banned_by}, ${dateStr}\x1d]\n`;
                    });
                }

                state.addMessage(targetBuffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: banText,
                    type: 'banlist',
                });

                if (buffer) {
                    buffer.flag('requested_banlist', false);
                }
            }
        }

        if (effectiveCommand === 'INVITELIST') {
            let buffer = state.getBufferByName(networkid, event.channel);
            let serverBuffer = network.serverBuffer();
            let targetBuffer = buffer || serverBuffer;

            if (!buffer || buffer.flags.requested_invitelist) {
                let inviteText = '\x02';

                if (targetBuffer === serverBuffer) {
                    inviteText += event.channel + '  ';
                }
                inviteText += TextFormatting.t('invited') + ' [+I]\x02\n';

                if (!event.invites || event.invites.length === 0) {
                    inviteText += TextFormatting.t('invited_nobody');
                } else {
                    _.each(event.invites, (invite) => {
                        let dateStr = (new Date(invite.invited_at * 1000)).toLocaleDateString();
                        inviteText += `${invite.invited} [\x1d${invite.invited_by}, ${dateStr}\x1d]\n`;
                    });
                }

                state.addMessage(targetBuffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: inviteText,
                    type: 'invitelist',
                });

                if (buffer) {
                    buffer.flag('requested_invitelist', false);
                }
            }
        }

        if (effectiveCommand === 'TOPIC') {
            let targetName = event.channel;
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    targetName = event.batch.params[0];
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            }
            let buffer = state.getOrAddBufferByName(networkid, targetName);
            let previousTopic = buffer.topic || '';
            if (!isHistory) {
                buffer.topic = event.topic || '';
            }

            let typeExtra = '';
            let messageBody = '';

            if (event.nick) {
                if (!isHistory) {
                    buffer.topic_by = event.nick;
                    buffer.topic_when = event.time || Date.now();
                }

                typeExtra = 'topic_change';
                messageBody = TextFormatting.formatAndT(
                    'channel_topic',
                    null,
                    'changed_topic_to',
                    { nick: event.nick, topic: event.topic || '' },
                );
            } else if ((event.topic || '').trim()) {
                let sameTopic = !isHistory && previousTopic === (event.topic || '');
                if (!sameTopic) {
                    typeExtra = 'topic_join';
                    messageBody = TextFormatting.formatText('channel_topic', event.topic);
                }
            }

            if (messageBody) {
                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: messageBody,
                    type: 'topic',
                    type_extra: typeExtra,
                });
            }
        }

        if (effectiveCommand === 'TOPICSETBY') {
            let buffer = network.bufferByName(event.channel);
            if (buffer && !isHistory) {
                buffer.topic_by = event.nick;
                buffer.topic_when = event.when * 1000;
            }
        }

        if (effectiveCommand === 'HELP') {
            let buffer = state.getOrAddBufferByName(networkid, '*help');
            state.addMessage(buffer, {
                time: eventTime,
                server_time: serverTime,
                nick: '',
                message: event.help,
                type: 'help',
                tags: event.tags || {},
            });
        }

        if (effectiveCommand === 'CTCP RESPONSE' || effectiveCommand === 'CTCP REQUEST') {
            let ctcpConsumed = effectiveCommand === 'CTCP RESPONSE' &&
                RelayMeta.handleCtcp(relayMetaDeps(), networkid, event);
            if (!ctcpConsumed && effectiveCommand === 'CTCP REQUEST') {
                ctcpConsumed = RelayMeta.isOwnMachineCtcp(client.user.nick, event);
            }
            if (!ctcpConsumed) {
                let buffer = network.serverBuffer();
                let textFormatId = effectiveCommand === 'CTCP RESPONSE' ?
                    'ctcp_response' :
                    'ctcp_request';
                let messageBody = TextFormatting.formatText(textFormatId, {
                    nick: event.nick,
                    message: event.message,
                    type: event.type,
                });

                state.addMessage(buffer, {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: messageBody,
                    type: 'error',
                });
            }

            if (effectiveCommand === 'CTCP REQUEST' && event.type === 'VERSION') {
                let target = event.from_server ?
                    event.hostname :
                    event.nick;
                client.ctcpResponse(target, 'VERSION', 'Kiwi IRC');
            }
        }

        if (effectiveCommand === 'NICK INVALID') {
            let messageBody = TextFormatting.formatText('general_error', {
                text: event.reason,
            });
            let buffer = state.getActiveBuffer();
            if (network !== state.getActiveNetwork()) {
                buffer = network.serverBuffer();
            }

            state.addMessage(buffer, {
                time: eventTime,
                server_time: serverTime,
                nick: '',
                message: messageBody,
                type: 'error',
            });

            if (!isRegistered) {
                network.last_error_numeric = 432;
                network.last_error = event.reason;
                network.ircClient.quit();
            }
        }

        if (effectiveCommand === 'LOGGEDIN' || effectiveCommand === 'LOGGEDOUT') {
            let translationKey = effectiveCommand === 'LOGGEDIN' ? 'logged_in' : 'logged_out';

            let buffers = [];
            if (isHistory) {
                if (event.batch && event.batch.params[0]) {
                    const b = network.bufferByName(event.batch.params[0]);
                    if (b) {
                        buffers.push(b);
                    }
                } else {
                    // History must be isolated to a batch target
                    return;
                }
            } else {
                buffers.push(network.serverBuffer());
                let activeBuffer = state.getActiveBuffer();
                if (activeBuffer?.networkid === network.id && activeBuffer !== buffers[0]) {
                    buffers.push(activeBuffer);
                }
            }

            let messageBody = TextFormatting.formatAndT(
                'notice',
                null,
                translationKey,
                { account: event.account }
            );

            buffers.forEach((buffer) => {
                state.addMessage(buffer, {
                    time: isHistory ? eventTime : Date.now(),
                    server_time: isHistory ? serverTime : 0,
                    nick: '',
                    message: messageBody,
                    type: 'notice',
                });
            });
        }

        if (effectiveCommand === 'SASL FAILED') {
            let failMessage = TextFormatting.formatAndT(
                'general_error',
                null,
                'login_failed'
            );

            let buffers = [network.serverBuffer()];
            let activeBuffer = state.getActiveBuffer();
            if (activeBuffer?.networkid === network.id && activeBuffer !== buffers[0]) {
                buffers.push(activeBuffer);
            }

            let disconnectOnSaslFail = network.ircClient.connection.options.sasl_disconnect_on_fail;

            if (disconnectOnSaslFail && network.state !== 'connected') {
                // The client is going to disconnect set last_error so it is show to the user
                network.last_error = failMessage;
            }

            if (!disconnectOnSaslFail) {
                // Only add messages if the client is not going to disconnect on failure
                buffers.forEach((buffer) => {
                    state.addMessage(buffer, {
                        time: Date.now(),
                        nick: '',
                        message: failMessage,
                        type: 'error',
                    });
                });
            }
        }

        if (effectiveCommand === 'IRC ERROR') {
            let buffer;
            if (event.channel || event.nick) {
                buffer = state.getOrAddBufferByName(network.id, event.channel || event.nick);
            }
            if (!buffer) {
                buffer = network.serverBuffer();
            }

            if (!buffer) {
                // we could not find a buffer, this is likely because the network was removed
                return;
            }

            // TODO: Some of these errors contain a .error property which we can match against,
            // ie. password_mismatch.

            if (event.error && !isRegistered) {
                if (event.error === 'password_mismatch') {
                    network.last_error = TextFormatting.t('error_password_mismatch');
                }
            }

            if (event.error === 'bad_channel_key') {
                buffer.flags.channel_badkey = true;
            }

            // ignore error 432 (erroneous nickname) as it is handled above
            if (event.reason && network.last_error_numeric !== 432) {
                if (!isRegistered) {
                    network.last_error = event.reason;
                }

                let messageRaw = event.reason || event.error;
                if (event.error === 'unknown_command') {
                    messageRaw = `${messageRaw} "${event.command}"`;
                }

                let messageBody = TextFormatting.formatText('general_error', {
                    text: messageRaw,
                });

                let message = {
                    time: eventTime,
                    server_time: serverTime,
                    nick: '',
                    message: messageBody,
                    type: 'error',
                };

                if (event.error === 'cannot_send_to_channel') {
                    // Only add this message if it does not match the previous message
                    // Typing status messages can cause a spam of this error type
                    state.addMessageNoRepeat(buffer, message);
                    return;
                }

                state.addMessage(buffer, message);
            }

            // Getting an error about a channel while we are not joined means that we couldn't join
            // or do some action on it. Disable it until we manually reattempt to join.
            if (buffer.isChannel() && !buffer.joined) {
                buffer.enabled = false;
                // Attempt to trigger history for other buffers since this channel no longer
                // blocks the network-wide readiness signal.
                network.buffers.forEach((b) => b.maybeRequestHistory());
            }
        }

        next();
    }
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
