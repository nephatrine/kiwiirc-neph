<template>
    <startup-layout
        ref="layout"
        class="kiwi-customserver"
    >
        <template #connection>
            <form
                class="u-form kiwi-customserver-form"
                @submit.prevent="startUp"
            >
                <h2 v-html="greetingText" />
                <div
                    v-if="network && (connectErrors.length > 0 || network.state_error)"
                    class="kiwi-customserver-error"
                >
                    <template v-if="connectErrors.length > 0">
                        <span v-for="err in connectErrors" :key="err">{{ err }}</span>
                    </template>
                    <template v-else>
                        <span>{{ $t('network_noconnect') }}</span>
                        <span>{{ readableStateError(network.state_error) }}</span>
                    </template>
                </div>

                <server-selector
                    v-if="showSelector"
                    :enable-custom="startupOptions.enableCustom ?? true"
                    :show-path="true"
                    :connection="connection"
                    @selected="presetSelected = $event"
                />

                <tabbed-view
                    ref="tabs"
                    v-model="connection.type"
                    :show-tabs="showTabs"
                    class="kiwi-customserver-tabs"
                >
                    <tabbed-tab header="Network" name="irc">
                        <input-text
                            v-model="nick"
                            :label="$t('nick')"
                            class="kiwi-customserver-nick"
                            :class="{ 'kiwi-customserver-nick--invalid': !isNickValid }"
                        />

                        <label class="kiwi-customserver-have-password">
                            <input v-model="show_password_box" type="checkbox">
                            <span> {{ $t('password_have') }} </span>
                        </label>

                        <transition-expand>
                            <input-text
                                v-if="show_password_box"
                                v-model="password"
                                v-focus
                                :label="$t('password')"
                                :show-plain-text="true"
                                type="password"
                            />
                        </transition-expand>

                        <input-text v-model="connection.channels" :label="$t('channels')" />
                    </tabbed-tab>
                    <tabbed-tab header="Bouncer" name="bnc">
                        <input-text
                            v-model="connection.account"
                            :label="$t('username')"
                            class="kiwi-customserver-nick"
                        />

                        <input-text
                            v-model="password"
                            :label="$t('password')"
                            type="password"
                        />
                    </tabbed-tab>
                </tabbed-view>

                <div v-if="termsContent" class="kiwi-customserver-terms">
                    <div>
                        <input v-model="termsAccepted" type="checkbox">
                    </div>
                    <div class="kiwi-customserver-terms-content" v-html="termsContent" />
                </div>

                <captcha
                    :network="network"
                />

                <button
                    :disabled="!readyToStart"
                    type="submit"
                    class="u-button u-button-primary u-submit kiwi-customserver-start"
                >
                    <div v-if="!network || network.state === 'disconnected'" v-html="buttonText" />
                    <template v-else>
                        <i class="fa fa-spin fa-spinner" aria-hidden="true" />
                    </template>
                </button>

                <div v-if="footerText" v-html="footerText" />
            </form>
        </template>
    </startup-layout>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import * as TextFormatting from '@/helpers/TextFormatting';
import { escapeRegExp } from '@/helpers/Utils';
import Logger from '@/libs/Logger';
import BouncerProvider from '@/libs/BouncerProvider';
import Captcha from '@/components/Captcha';

import StartupLayout from './CommonLayout';
import ServerSelector from '../ServerSelector';

const log = Logger.namespace('CustomServer');

export default {
    components: {
        Captcha,
        StartupLayout,
        ServerSelector,
    },
    data() {
        return {
            nick: '',
            password: '',
            show_password_box: false,
            network: null,
            isFragment: false,
            showSelector: false,
            termsAccepted: false,
            presetSelected: 'custom',
            connectErrors: [],
            connection: Misc.getDefaultConnection(),
        };
    },
    computed: {
        startupOptions() {
            return this.$state.getSetting('settings.startupOptions');
        },
        greetingText() {
            const greeting = this.startupOptions.greetingText;
            if (typeof greeting === 'string') {
                return greeting;
            }

            if (this.isFragment) {
                return this.$t('start_greeting');
            }

            return this.$t('customserver_where');
        },
        showTabs() {
            if (this.isFragment || this.presetSelected !== 'custom') {
                return false;
            }
            return this.startupOptions.enableTabs ?? true;
        },
        termsContent() {
            const terms = this.startupOptions.termsContent;
            return typeof terms === 'string' ?
                terms :
                '';
        },
        buttonText() {
            const greeting = this.startupOptions.buttonText;
            return typeof greeting === 'string' ?
                greeting :
                this.$t('connect');
        },
        footerText() {
            const footer = this.startupOptions.footerText;
            return typeof footer === 'string' ?
                footer :
                '';
        },
        isNickValid() {
            let nickPatternStr = this.$state.getSetting('settings.startupOptions.nick_format');
            let nickPattern = '';
            if (!nickPatternStr) {
                // Nicks cannot start with [0-9- ]
                // ? is not a valid nick character but we allow it as it gets replaced
                // with a number.
                nickPattern = /^[a-z_\\[\]{}^`|][a-z0-9_\-\\[\]{}^`|]*$/i;
            } else {
                // Support custom pattern matches. Eg. only '@example.com' may be allowed
                // on some IRCDs
                let pattern = '';
                let flags = '';
                if (nickPatternStr[0] === '/') {
                    // Custom regex
                    let pos = nickPatternStr.lastIndexOf('/');
                    pattern = nickPatternStr.substring(1, pos);
                    flags = nickPatternStr.substr(pos + 1);
                } else {
                    // Basic contains rule
                    pattern = escapeRegExp(nickPatternStr);
                    flags = 'i';
                }

                try {
                    nickPattern = new RegExp(pattern, flags);
                } catch (error) {
                    log.error('Nick format error: ' + error.message);
                    return false;
                }
            }

            return this.nick.match(nickPattern);
        },
        readyToStart() {
            let isBouncer = this.connection.type === 'bnc';
            let ready = isBouncer ?
                !!this.connection.account :
                !!this.nick;

            if (!this.connection.server) {
                return false;
            }

            if (!isBouncer && !this.isNickValid) {
                ready = false;
            }

            if (this.termsContent && !this.termsAccepted) {
                ready = false;
            }

            return ready;
        },
    },
    created() {
        const options = this.startupOptions;

        // The Bouncer tab's username field writes to connection.account,
        // which is not part of the default connection object.
        if (typeof this.connection.account === 'undefined') {
            this.$set(this.connection, 'account', '');
        }

        if (Misc.queryStringVal('nick')) {
            this.nick = Misc.queryStringVal('nick');
        } else {
            this.nick = options.nick;
        }

        this.nick = Misc.processNickRandomNumber(this.nick);

        if (options.bouncer) {
            this.connection.type = 'bnc';
        }

        let wasLogout = window.sessionStorage.getItem('kiwi-logout');
        if (wasLogout) {
            window.sessionStorage.removeItem('kiwi-logout');
        }

        let saveThisSessionsState = false;

        // If we have networks from a previous state, launch directly into it
        if (!wasLogout && this.$state.networks.length > 0) {
            const network = this.$state.networks[0];
            this.$state.setActiveBuffer(network.id, network.serverBuffer().name);
            saveThisSessionsState = true;
            this.$emit('start');
        } else if (window.location.hash.slice(1)) {
            const fragment = decodeURIComponent(window.location.hash.slice(1));

            const connections = [];
            fragment.split(';').filter((serverStr) => !!serverStr.trim()).forEach((serverStr) => {
                const conn = Misc.parsePresetServer(serverStr);
                if (conn) {
                    connections.push(conn);
                }
            });

            // If more than 1 connection string is given, skip the connection screen
            // and add them all right away.
            if (connections.length === 0) {
                saveThisSessionsState = true;
                this.applyDefaults();
            } else if (connections.length === 1) {
                saveThisSessionsState = false;
                this.isFragment = true;
                Object.assign(this.connection, connections[0]);
            } else if (connections.length > 1) {
                saveThisSessionsState = false;
                connections.forEach((conn, idx) => {
                    let nick = options.nick;
                    if (conn.params?.has('nick')) {
                        nick = conn.params.get('nick');
                    } else {
                        nick = Misc.queryStringVal('nick') || nick;
                    }
                    nick = Misc.processNickRandomNumber(nick);

                    const password = conn.password || '';

                    const net = this.createNetwork(conn, nick, password);

                    // Set the first server buffer active
                    if (idx === 0) {
                        this.$state.setActiveBuffer(net.id, net.serverBuffer().name);
                    }
                });

                this.$emit('start');
            }
        } else {
            saveThisSessionsState = true;
            this.applyDefaults();
        }

        if (saveThisSessionsState) {
            this.$state.persistence.watchStateForChanges();
        }
    },
    methods: {
        readableStateError(err) {
            return Misc.networkErrorMessage(err);
        },
        createNetwork(conn, nick, password) {
            const options = this.startupOptions;

            // A bouncer login always needs its control connection, but logging
            // out leaves the previous session's networks in state. Reuse the
            // control connection that is already here instead of adding a stale
            // duplicate to the sidebar.
            let net = conn.type === 'bnc' ?
                this.$state.networks.find((network) => (
                    network.is_bnc && !network.connection.bncnetid
                )) :
                null;

            if (!net) {
                net = this.$state.addNetwork(TextFormatting.t('network'), nick, {
                    server: conn.server,
                    port: conn.port,
                    tls: conn.tls,
                    direct: conn.direct,
                    path: conn.path,
                    password: password,
                    account: conn.account || '',

                    encoding: (options.encoding || 'utf-8').trim(),
                    gecos: options.gecos,
                    username: options.username,
                });
            }

            // The password is the network's SASL secret; the server PASS is
            // never used. For a bouncer it is the bouncer password, alongside
            // connection.account as the bouncer username. BouncerProvider reads
            // those back off this network once it is marked is_bnc.
            net.connection.password = '';
            net.password = password;
            if (conn.type === 'bnc') {
                net.is_bnc = true;
                net.hidden = false;
                net.name = 'BNC';
                net.connection.nick = nick;
                net.connection.account = conn.account || '';
                net.connection.server = conn.server;
                net.connection.port = conn.port;
                net.connection.tls = conn.tls;
                net.connection.direct = !!conn.direct;
                net.connection.path = conn.path || '';
            }

            return net;
        },
        startUp() {
            const conn = this.connection;

            if (conn.type === 'irc') {
                this.network = this.createNetwork(conn, this.nick, this.password);

                // Only switch to the first channel we join if multiple are being joined
                let hasSwitchedActiveBuffer = false;
                let bufferObjs = Misc.extractBuffers(conn.channels);
                bufferObjs.forEach((bufferObj) => {
                    let newBuffer = this.$state.addBuffer(this.network.id, bufferObj.name);
                    newBuffer.enabled = true;

                    if (newBuffer && !hasSwitchedActiveBuffer) {
                        this.$state.setActiveBuffer(this.network.id, newBuffer.name);
                        hasSwitchedActiveBuffer = true;
                    }

                    if (bufferObj.key) {
                        newBuffer.key = bufferObj.key;
                    }
                });

                if (!hasSwitchedActiveBuffer) {
                    this.$state.setActiveBuffer(this.network.id, this.network.serverBuffer().name);
                }
            } else {
                // conn.type === 'bnc'
                this.network = this.createNetwork(conn, conn.account || this.nick, this.password);

                // Route every connection through the bouncer and let it manage
                // the bouncer's own networks from here on.
                let bouncer = new BouncerProvider(this.$state);
                bouncer.enable(conn.server, conn.port, conn.tls, conn.direct, conn.path);
            }

            this.network.ircClient.connect();
            let onRegistered = () => {
                if (this.$refs.layout) {
                    this.$refs.layout.close();
                }
                this.network.ircClient.off('registered', onRegistered);
                this.network.ircClient.off('close', onClosed);
                this.network.ircClient.off('irc error', onError);
            };
            let onClosed = () => {
                let lastError = this.network.last_error;
                if (lastError && !this.connectErrors.includes(lastError)) {
                    this.connectErrors.push(lastError);
                }
                this.network.ircClient.off('registered', onRegistered);
                this.network.ircClient.off('close', onClosed);
                this.network.ircClient.off('irc error', onError);
            };
            let onError = (event) => {
                if (!event.reason || this.connectErrors.includes(event.reason)) {
                    return;
                }
                this.connectErrors.push(event.reason);
            };
            this.network.ircClient.once('registered', onRegistered);
            this.network.ircClient.once('close', onClosed);
            this.network.ircClient.on('irc error', onError);
        },
        // The endpoint to connect to, honouring whichever config style the
        // deployment used (explicit server/port/tls, direct, or websocket)
        endpointFromConfig(conn) {
            let endpoint = Misc.connectionInfoFromConfig({
                websocket: conn.websocket,
                server: conn.server,
                port: conn.port,
                tls: conn.tls,
                direct: conn.direct,
                direct_path: conn.path,
            });

            if (!endpoint.port) {
                if (endpoint.direct) {
                    endpoint.port = endpoint.tls ? 443 : 80;
                } else {
                    endpoint.port = endpoint.tls ? 6697 : 6667;
                }
            }

            return endpoint;
        },
        applyDefaults() {
            let options = this.startupOptions;
            let port = options.port || 6697;
            let endpoint = this.endpointFromConfig({
                websocket: options.websocket,
                server: options.server || '',
                port,
                tls: options.tls || port !== 6667,
                direct: options.direct || false,
                path: options.direct_path || '',
            });

            this.showSelector = true;
            Object.assign(this.connection, {
                server: endpoint.hostname || '',
                port: endpoint.port,
                tls: endpoint.tls,
                direct: endpoint.direct,
                path: endpoint.direct_path,
                type: options.bouncer ? 'bnc' : 'irc',
                channels: options.channel || '',
            });
        },
    },
};
</script>

<style lang="less">
.kiwi-customserver-start {
    font-size: 1.1em;
    cursor: pointer;
}

.kiwi-customserver-form {
    width: 70%;
    padding: 20px;
}

@media (max-width: 1025px) {
    .kiwi-customserver-form {
        width: 100%;
    }
}

@media (max-width: 850px) {
    .kiwi-customserver-form {
        background: var(--brand-default-bg);
        border-radius: 5px;
        box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2);
    }
}

@media (max-width: 600px) {
    .kiwi-customserver-form {
        max-width: 350px;
    }
}

.kiwi-customserver .u-input-text,
.kiwi-customserver .kiwi-customserver-have-password,
.kiwi-customserver-terms {
    margin-bottom: 1em;
}

.kiwi-customserver-form .u-submit {
    width: 100%;
    height: 50px;
    padding: 0;
    letter-spacing: 1px;
    margin: 1em 0 2em 0;
    transition: all 0.2s;
    border: none;
    font-size: 1.3em;
    line-height: 36px;
    cursor: pointer;
}

.kiwi-customserver-form .u-submit[disabled] {
    cursor: not-allowed;
    opacity: 0.65;
}

.kiwi-customserver h2 {
    margin: 0 0 40px 0;
    padding: 0;
    cursor: default;
    font-weight: 600;
    font-size: 2.2em;
    text-align: center;
    line-height: 1.2em;
}

.kiwi-customserver-error {
    text-align: center;
    margin: 1em 0;
    padding: 1em;
}

.kiwi-customserver-error span {
    display: block;
    font-style: italic;
    margin-bottom: 8px;
}

.kiwi-customserver-error span:last-of-type {
    margin-bottom: 0;
}

.kiwi-customserver-tabs .u-tabbed-view-tabs {
    display: flex;
    padding-top: 0;
    margin-bottom: 1em;

    .u-tabbed-view-tab {
        flex-grow: 1;
        text-align: center;
    }
}
</style>
