<template>
    <startup-layout ref="layout" class="kiwi-startbouncer">
        <template #connection>
            <form class="kiwi-startbouncer-form" @submit.prevent="startUp">
                <h2 v-html="greetingText" />

                <div class="kiwi-startbouncer-status">{{ statusMessage }}</div>

                <label>
                    <span>{{ $t('username') }}</span>
                    <input v-model="username" :disabled="loading" type="text">
                </label>
                <label>
                    <span>{{ $t('password') }}</span>
                    <input v-model="password" :disabled="loading" type="password">
                </label>

                <button
                    :disabled="loading || !username || !password"
                    type="submit"
                    class="u-button u-button-primary u-submit"
                >
                    <span v-if="!loading" v-html="buttonText" />
                    <i v-else class="fa fa-spinner fa-spin" aria-hidden="true" />
                </button>
            </form>
        </template>
    </startup-layout>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import Logger from '@/libs/Logger';
import BouncerProvider from '@/libs/BouncerProvider';
import StartupLayout from './CommonLayout';

let log = Logger.namespace('Startup/bouncer');

export default {
    components: {
        StartupLayout,
    },
    data: function data() {
        return {
            loading: false,
            username: '',
            password: '',
            statusMessage: '',
        };
    },
    computed: {
        connectOptions: function connectOptions() {
            let options = Object.assign({}, this.$state.settings.startupOptions);
            let connection = Misc.connectionInfoFromConfig(options);

            connection.hostname = connection.hostname || 'default';

            // A websocket URI with no explicit port gives 0, which means the
            // scheme default. Anything else falls back to the usual IRC ports.
            if (!connection.port && connection.direct) {
                connection.port = connection.tls ? 443 : 80;
            } else if (!connection.port && !connection.direct) {
                connection.port = connection.tls ? 6697 : 6667;
            }

            return connection;
        },
        greetingText: function greetingText() {
            let greeting = this.$state.settings.startupOptions.greetingText;
            return typeof greeting === 'string' ?
                greeting :
                this.$t('start_greeting');
        },
        buttonText: function buttonText() {
            if (this.loading) {
                return '';
            }

            let greeting = this.$state.settings.startupOptions.buttonText;
            return typeof greeting === 'string' ?
                greeting :
                this.$t('start_button');
        },
    },
    methods: {
        startUp: function startUp() {
            this.statusMessage = this.$t('logging_in');
            this.loading = true;

            let connection = this.connectOptions;

            log(`Connecting to bouncer at ${connection.hostname}:${connection.port}`);

            // The control connection authenticates against the bouncer with the
            // account username and password. BouncerProvider reads those back
            // off this network (is_bnc) when enable() is called, so it must be
            // created and populated before then.
            //
            // Logging out restores the previous session's networks, so a control
            // connection may already be here. Reuse it instead of adding another
            // one, which would leave a stale duplicate in the sidebar.
            let bncnet = this.$state.networks.find((network) => (
                network.is_bnc && !network.connection.bncnetid
            ));

            if (!bncnet) {
                bncnet = this.$state.addNetwork('BNC', this.username, {
                    server: connection.hostname,
                    port: connection.port,
                    tls: connection.tls,
                    account: this.username,
                });
            }

            bncnet.is_bnc = true;
            bncnet.hidden = false;
            bncnet.name = 'BNC';
            bncnet.password = this.password;
            bncnet.connection.nick = this.username;
            bncnet.connection.account = this.username;
            bncnet.connection.server = connection.hostname;
            bncnet.connection.port = connection.port;
            bncnet.connection.tls = connection.tls;
            bncnet.connection.direct = connection.direct;
            bncnet.connection.path = connection.direct_path;

            let cleanUpEvents = () => {
                bncnet.ircClient.off('registered', onRegistered);
                bncnet.ircClient.off('irc error', onError);
                bncnet.ircClient.off('close', onClose);
            };

            let onRegistered = () => {
                cleanUpEvents();
                if (this.$refs.layout) {
                    this.$refs.layout.close();
                }
            };

            let onError = () => {
                cleanUpEvents();
                this.statusMessage = this.$t('invalid_login');
                this.loading = false;
            };

            let onClose = () => {
                cleanUpEvents();
                this.statusMessage = this.$t('invalid_login');
                this.loading = false;
            };

            bncnet.ircClient.once('registered', onRegistered);
            bncnet.ircClient.once('irc error', onError);
            bncnet.ircClient.once('close', onClose);

            let bouncer = new BouncerProvider(this.$state);
            bouncer.enable(
                connection.hostname,
                connection.port,
                connection.tls,
                connection.direct,
                connection.direct_path
            );

            bncnet.ircClient.connect();
        },
    },
};
</script>

<style>

.kiwi-startbouncer-form label {
    text-align: left;
    display: block;
    margin-bottom: 1.5em;
}

.kiwi-startbouncer-form input,
.kiwi-startbouncer-form input:active {
    font-size: 1em;
    width: 100%;
    box-sizing: border-box;
    line-height: 30px;
    padding: 0 10px;
    border: none;
    border-bottom: 2px solid #42b992;
    outline: none;
}

.kiwi-startbouncer-status {
    margin: 1em 0;
    overflow: hidden;
    max-height: 40px;
    transition: max-height 0.2s;
}

.kiwi-startbouncer-status:empty {
    background: red;
    max-height: 0;
}

.kiwi-startbouncer-start {
    font-size: 1.1em;
    cursor: pointer;
}

.kiwi-startbouncer-form {
    width: 300px;
    background-color: #fff;
    border-radius: 0.5em;
    padding: 1em;
    border: 1px solid #ececec;
}

.kiwi-startbouncer-form button {
    width: 100%;
    line-height: 36px;
    padding: 0;
    font-size: 1.2em;
    font-weight: normal;
}

</style>
