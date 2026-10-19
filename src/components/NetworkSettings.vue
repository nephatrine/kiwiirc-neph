<template>
    <div class="kiwi-networksettings">
        <form class="u-form" @submit.prevent="connect">
            <div class="kiwi-title">{{ $t('settings_server_details') }}</div>
            <div class="kiwi-networksettings-section-block">
                <div v-if="restricted" class="kiwi-networksettings-locked">
                    {{ $t('settings_server_details_locked') }}
                </div>
                <div v-else-if="isBouncerController" class="kiwi-networksettings-locked">
                    {{ $t('settings_bouncer_managed') }}
                </div>
                <div v-else-if="isBouncerManaged" class="kiwi-networksettings-locked">
                    {{ $t('settings_bouncer_save_hint') }}
                </div>
                <div
                    v-if="isBouncerManaged && network.bnc_error"
                    class="kiwi-networksettings-error"
                >
                    <span>{{ network.bnc_error }}</span>
                </div>
                <div v-else-if="network.state_error" class="kiwi-networksettings-error">
                    {{ $t('network_noconnect') }}
                    <span>{{ readableStateError(network.state_error) }}</span>
                </div>
                <div v-else-if="network.last_error" class="kiwi-networksettings-error">
                    <span>{{ network.last_error }}</span>
                </div>

                <captcha
                    class="kiwi-networksettings-captcha"
                    :network="network"
                />

                <div
                    v-if="network.editable_name"
                    class="kiwi-networksettings-networkname"
                >
                    <input-text
                        v-model="network.name"
                        :label="$t('network_name')"
                        :disabled="settingsLocked"
                    />
                </div>

                <server-selector
                    :enable-custom="startupOptions.enableCustom ?? true"
                    :disabled="connectionDetailsLocked"
                    :connection="network.connection"
                />

                <div class="kiwi-networksettings-connection-password">
                    <input-text
                        v-model="network.connection.nick"
                        :label="$t('settings_nickname')"
                    />
                    <input-text
                        v-model="network.connection.account"
                        :label="$t('account_name')"
                        :placeholder="network.connection.nick"
                    />
                    <input-text
                        v-if="!isBouncerController"
                        v-model="network.password"
                        :show-plain-text="true"
                        :label="$t('password')"
                        type="password"
                    />
                    <a
                        v-if="bouncerSaslCommand"
                        class="u-button kiwi-networksettings-bouncer-sasl"
                        @click="prefillBouncerSaslCommand"
                    >
                        {{ $t('settings_bouncer_sasl_command') }}
                    </a>
                    <div
                        v-else-if="bouncerSaslManual"
                        class="kiwi-networksettings-bouncer-sasl-warning"
                    >
                        {{ $t('settings_bouncer_sasl_manual') }}
                    </div>
                </div>

                <h4
                    class="kiwi-show-advanced-title"
                    @click="show_advanced = !show_advanced"
                >
                    {{ $t('settings_advanced') }}
                    <i
                        :class="[`fa-caret-${show_advanced ? 'up' : 'down'}`]"
                        class="fa"
                        aria-hidden="true"
                    />
                </h4>

                <div v-if="show_advanced" class="kiwi-networksettings-advanced">
                    <input-text
                        v-model="network.connection.encoding"
                        :label="$t('settings_encoding')"
                        :disabled="settingsLocked"
                    />

                    <div v-if="!isBouncer" class="u-input-text">
                        <label>{{ $t('settings_sasl_mechanism') }}</label>
                        <select v-model="network.connection.sasl_mechanism" class="u-input">
                            <option value="AUTO">AUTO (Recommended)</option>
                            <option value="PLAIN">PLAIN</option>
                            <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                        </select>
                    </div>

                    <input-text
                        v-model="network.connection.password"
                        :show-plain-text="true"
                        :label="$t('server_password')"
                        :disabled="settingsLocked"
                        type="password"
                    />

                    <input-text
                        v-model="network.gecos"
                        :label="$t('whois_realname')"
                        :disabled="settingsLocked"
                    />

                    <label>
                        <span class="kiwi-appsettings-showraw-label">
                            {{ $t('settings_show_raw') }}
                        </span>
                        <input v-model="settingShowRaw" type="checkbox">
                    </label>

                    <label>
                        <span class="kiwi-appsettings-showraw-label">
                            {{ $t('settings_raw_scrollback') }}
                        </span>
                        <input
                            v-model.number="settingRawScrollback"
                            type="number"
                            min="50"
                            class="u-input"
                        >
                    </label>

                    <label>
                        <span class="kiwi-appsettings-showraw-label">
                            {{ $t('settings_use_websocket') }}
                        </span>
                        <input
                            v-model="network.connection.direct"
                            :disabled="settingsLocked"
                            type="checkbox"
                        >
                        <input-text
                            v-if="network.connection.direct"
                            v-model="directWs"
                            :disabled="settingsLocked"
                        />
                    </label>

                    <label class="u-form-block">
                        <input-text
                            v-model="network.auto_commands"
                            :label="$t('settings_autorun')"
                            type="textarea"
                        />
                    </label>
                </div>

                <div class="kiwi-networksettings-control">
                    <template v-if="isBouncerManaged">
                        <a
                            type="button"
                            class="u-button u-submit kiwi-networksettings-save"
                            @click="saveBouncerNetwork()"
                        >
                            {{ $t('save') }}
                        </a>
                        <a
                            type="button"
                            class="u-button u-button-primary u-submit kiwi-connect-to-newnetwork"
                            :disabled="bouncerNetworkState === 'connecting'"
                            @click="connectBouncerNetwork()"
                        >
                            {{ $t(connectButtonLabel) }}
                        </a>
                    </template>
                    <template v-else>
                        <a
                            v-if="network.state !== 'connected'"
                            type="button"
                            class="u-button u-button-primary u-submit kiwi-connect-to-newnetwork"
                            :disabled="network.state !== 'disconnected'"
                            @click="connect()"
                        >
                            {{
                                $t(network.state === 'disconnected'
                                    ? 'network_connect'
                                    : 'network_connecting')
                            }}
                        </a>
                        <a
                            v-else
                            type="button"
                            class="u-button u-button-warning u-submit kiwi-connect-to-newnetwork"
                            @click="disconnect()"
                        >
                            {{ $t('network_disconnect') }}
                        </a>
                    </template>
                </div>
            </div>

            <div v-if="!restricted && !isBouncerController" class="kiwi-dangerzone">
                <h3>{{ $t('settings_danger') }}</h3>
                <a class="u-button u-button-warning" @click="removeNetwork">
                    <i class="fa fa-times" aria-hidden="true" /> {{ $t('settings_remove') }}
                </a>
            </div>
        </form>
    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import Captcha from '@/components/Captcha';
import ServerSelector from './ServerSelector';

export default {
    components: {
        ServerSelector,
        Captcha,
    },
    props: ['network'],
    data() {
        return {
            show_advanced: false,
            switch_tabs_on_connect: false,
            network_list: [],
        };
    },
    computed: {
        restricted() {
            return this.$state.setting('restricted');
        },
        isBouncerController() {
            return this.network.isBouncerController();
        },
        // The connection details are read-only in restricted mode and on the
        // bouncer's control connection. They stay visible either way.
        settingsLocked() {
            return this.restricted || this.isBouncerController;
        },
        // A bouncer-bound network keeps its connection details editable while
        // its socket is up: edits are only sent when Save or Connect is
        // pressed. Other networks lock their details once connected.
        connectionDetailsLocked() {
            if (this.settingsLocked) {
                return true;
            }
            return !this.isBouncerManaged && this.network.state !== 'disconnected';
        },
        // The bouncer provider is created by the startup screens and kept on
        // the app state. Its presence means connections are routed through a
        // bouncer, where network changes have to be sent explicitly.
        bouncerProvider() {
            return this.$state.bouncer_provider || null;
        },
        // A network the bouncer holds the connection settings for. The control
        // connection is not one: its own details are always locked.
        isBouncerManaged() {
            if (this.isBouncerController) {
                return false;
            }
            if (this.network.connection.bncnetid) {
                return true;
            }
            return !!(this.bouncerProvider && this.bouncerProvider.getController());
        },
        // The bouncer's view of this network. `network.state` only tracks our
        // socket to the bouncer, so a failed upstream link still looks
        // connected locally.
        bouncerNetworkState() {
            return this.network.bouncerState();
        },
        connectButtonLabel() {
            if (this.bouncerNetworkState === 'connected') {
                return 'network_reconnect';
            }
            if (this.bouncerNetworkState === 'connecting') {
                return 'network_connecting';
            }
            return 'network_connect';
        },
        // A bouncer-bound connection keeps its SASL credentials on the bouncer.
        // The password field stays visible so the user can prepare the
        // BouncerServ command that stores them, but the mechanism selector is
        // hidden because sasl set-plain only configures PLAIN.
        isBouncer() {
            return !!this.network.connection.bncnetid || !!this.network.is_bnc;
        },
        bouncerSaslCommand() {
            return this.network.bouncerSaslCommand();
        },
        bouncerSaslManual() {
            return this.network.bouncerSaslManual();
        },
        startupOptions() {
            return this.$state.getSetting('settings.startupOptions');
        },
        settingShowRaw: {
            get() {
                return this.network.setting('show_raw');
            },
            set(val) {
                return this.network.setting('show_raw', val);
            },
        },
        settingRawScrollback: {
            get() {
                return this.network.setting('raw_scrollback_size') || 500;
            },
            set(val) {
                let size = parseInt(val, 10);
                if (Number.isNaN(size) || size < 50) {
                    size = 50;
                }
                return this.network.setting('raw_scrollback_size', size);
            },
        },
        directWs: {
            get() {
                if (!this.network.connection.direct) {
                    return '';
                }

                let connection = this.network.connection;
                let addr = '';
                addr += connection.tls ?
                    'wss://' :
                    'ws://';
                addr += connection.server;

                let port = parseInt(connection.port, 10);
                if (Number.isNaN(port)) {
                    port = connection.tls ?
                        443 :
                        80;
                }

                // Only include the port if needed
                if (
                    (connection.tls && port !== 443) ||
                    (!connection.tls && port !== 80)
                ) {
                    addr += ':' + connection.port;
                }

                addr += connection.path;

                return addr;
            },
            set(newVal) {
                let url = null;

                try {
                    url = new URL(newVal);
                } catch (e) {
                    return;
                }

                let connection = this.network.connection;
                connection.tls = url.protocol.toLowerCase() === 'wss:';
                connection.server = url.hostname;

                let port = parseInt(url.port, 10);
                if (Number.isNaN(port)) {
                    port = url.protocol.toLowerCase() === 'wss:' ?
                        443 :
                        80;
                }

                connection.port = port;
                let u = url.href.replace(url.protocol + '//', '');
                connection.path = u.substr(u.indexOf('/'));
            },
        },
    },
    watch: {
        'network.state'() {
            if (!this.switch_tabs_on_connect) {
                return;
            }

            if (this.network.state === 'connected') {
                this.switch_tabs_on_connect = false;
                this.$state.$emit('server.tab.show', 'messages');
            } else if (this.network.state_error) {
                this.switch_tabs_on_connect = false;
            }
        },
    },
    created() {
        this.network_list = this.$state.setting('presetNetworks') || [];
    },
    methods: {
        readableStateError(err) {
            return Misc.networkErrorMessage(err);
        },
        connect() {
            if (this.network.state !== 'disconnected') {
                return;
            }
            this.switch_tabs_on_connect = true;
            this.network.ircClient.connect();
        },
        disconnect() {
            if (this.network.state === 'disconnected') {
                return;
            }
            this.network.ircClient.quit(
                this.$state.setting('quitMessage') || 'Client Closed Connection'
            );
        },
        // Explicit save: diff this one network against the last bouncer
        // snapshot and send the result to the bouncer, nothing else.
        saveBouncerNetwork() {
            if (!this.bouncerProvider) {
                return;
            }
            this.bouncerProvider.saveNetworkChanges(this.network);
        },
        // Save first, then (re)connect the local socket. The overloaded
        // connect() ends an existing socket itself, so this also retries a
        // network whose upstream link failed.
        connectBouncerNetwork() {
            this.saveBouncerNetwork();
            if (this.network.state === 'connecting') {
                return;
            }
            this.switch_tabs_on_connect = true;
            this.network.ircClient.connect();
        },
        removeNetwork() {
            let confirmed = confirm('Really remove this network? This cannot be undone!');
            if (!confirmed) {
                return;
            }

            this.$state.removeNetwork(this.network.id);
            this.$state.$emit('active.component');
        },
        toggleTls() {
            let connection = this.network.connection;
            connection.tls = !connection.tls;

            // Switching the port only if were currently using the most common TLS/plain text ports
            if (connection.tls && connection.port === 6667) {
                connection.port = 6697;
            } else if (!connection.tls && connection.port === 6697) {
                connection.port = 6667;
            }
        },
        // Open the controller's BouncerServ query with the command already in
        // the input. ControlInput restores it on mount, so nothing is sent
        // until the user presses Enter themselves.
        prefillBouncerSaslCommand() {
            const controller = this.network.bouncerController();
            const command = this.network.bouncerSaslCommand();
            if (!controller || !command) {
                return;
            }

            this.$state.addBuffer(controller.id, 'BouncerServ');
            const buffer = this.$state.getBufferByName(controller.id, 'BouncerServ');
            if (!buffer) {
                return;
            }

            if (this.$state.setting('buffers.shared_input')) {
                this.$state.ui.current_input = command;
            } else {
                buffer.current_input = command;
            }

            this.$state.setActiveBuffer(controller.id, 'BouncerServ');
        },
    },
};
</script>

<style lang="less">

.kiwi-networksettings {
    box-sizing: border-box;
    height: 100%;
    margin: 0 auto;
    padding: 0;
}

.kiwi-networksettings .kiwi-title {
    width: 100%;
    line-height: 45px;
    height: 46px;
    padding: 0 10px;
    box-sizing: border-box;
    text-align: left;
    font-weight: 600;
    cursor: default;
}

.kiwi-networksettings .u-form {
    max-width: 400px;
    display: block;
    margin: 1em auto;
    padding: 0;
    height: auto;
    overflow: hidden;
    clear: both;
    border-radius: 2px;
    border: 1px solid;
}

.kiwi-networksettings .u-input-text {
    padding-top: 0;
    margin-bottom: 20px;
}

//The 'Sections' of the form
.kiwi-networksettings-section-block {
    box-sizing: border-box;
    width: 100%;
    padding: 20px;
}

.kiwi-networksettings-captcha {
    margin-bottom: 1em;
}

//Style the network types section
.kiwi-networksettings .kiwi-networksettings-server-types-info {
    width: 100%;
    text-align: left;
    margin-bottom: 10px;
}

.kiwi-networksettings .kiwi-networksettings-server-types {
    text-align: center;
}

.kiwi-networksettings .kiwi-networksettings-server-types .kiwi-network-type-button {
    margin: 0 10px;
    display: inline-block;
    line-height: 35px;
    padding: 0 10px;
    border: 1px solid;
    transition: all 0.3s;
    border-radius: 4px;
}

.kiwi-networksettings .kiwi-show-advanced-title {
    text-align: center;
    cursor: pointer;
    padding-top: 0;
    margin: 40px 0 20px 0;
}

//Apply spacing to the advanced options checkbox label
.kiwi-networksettings .kiwi-networksettings-advanced .kiwi-appsettings-showraw-label {
    margin-left: 5px;
}

//Large connection button
.kiwi-networksettings .kiwi-connect-to-newnetwork {
    margin: 0 auto;
    display: inline-block;
    cursor: pointer;
    padding: 0 10px;
    line-height: 35px;
}

.kiwi-networksettings .kiwi-connect-to-newnetwork:hover {
    opacity: 1;
}

.kiwi-networksettings-advanced {
    margin-bottom: 20px;
}

//Danger zone - bottom section
.kiwi-dangerzone {
    text-align: center;
    padding: 10px 0 20px 0;
    border-top: 1px solid rgba(0, 0, 0, 0.2);
}

.kiwi-dangerzone i {
    margin-right: 5px;
}

.kiwi-dangerzone h3 {
    padding-top: 0;
}

.kiwi-networksettings-error {
    text-align: center;
    margin: 1em 0 2em 0;
    padding: 1em;
    border: 1px dashed;
}

.kiwi-networksettings-locked {
    text-align: center;
    margin: 0 0 1.5em 0;
    padding: 0.8em;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.05);
    font-style: italic;
    font-size: 0.9em;
    border-radius: 4px;
}

.kiwi-networksettings-bouncer-sasl {
    display: block;
    margin: 0 0 1.5em 0;
    text-align: center;
}

.kiwi-networksettings-bouncer-sasl-warning {
    margin: 0 0 1.5em 0;
    padding: 0.8em;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.05);
    font-style: italic;
    font-size: 0.9em;
    border-radius: 4px;
}

.kiwi-networksettings .kiwi-networksettings-error span {
    display: block;
    font-style: italic;
    text-align: center;
}

.kiwi-networksettings-server-types a {
    margin-right: 1em;
}

.kiwi-networksettings-server-types-info {
    font-size: 0.9em;
    font-style: italic;
}

.kiwi-networksettings-control {
    text-align: center;
}

.kiwi-networksettings .kiwi-networksettings-save {
    margin-right: 10px;
    display: inline-block;
    cursor: pointer;
    padding: 0 10px;
    line-height: 35px;
}

.kiwi-networksettings-danger h3 {
    padding: 0;
    margin-top: 0;
    margin-bottom: 0.5em;
}

.kiwi-networksettings-danger .u-button-warning {
    width: auto;
    height: 30px;
    border-radius: 4px;
    text-align: center;
    line-height: 30px;
    padding: 0 10px;
    opacity: 0.8;
    margin: 0 auto;
    transition: all 0.3s;
}

.kiwi-networksettings-danger .u-button-warning:hover {
    opacity: 1;
}

@media screen and (max-width: 769px) {
    .kiwi-networksettings {
        z-index: 100;
    }
}
</style>
