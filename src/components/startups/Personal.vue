<template>
    <div class="kiwi-personal">
        <h1>{{ $t('personal_client') }}</h1>

        <div>
            <p>{{ $t('personal_addjoin') }}</p>
            <p>{{ $t('personal_return') }}</p>

            <button type="button" class="u-button u-button-primary" @click="addEmptyNetwork">
                {{ $t('personal_add') }}
            </button> <br>

            <a
                v-if="networks.length > 0"
                class="u-link kiwi-personal-existing-networks"
                @click.stop="toggleStateBrowser"
            >
                {{ $t('personal_saved') }}
            </a>
        </div>
    </div>
</template>

<script>
'kiwi public';

import * as TextFormatting from '@/helpers/TextFormatting';
import * as Misc from '@/helpers/Misc';
import BouncerProvider from '@/libs/BouncerProvider';

let firstRun = true;

export default {
    computed: {
        networks() {
            return this.$state.networks;
        },
    },
    created: function created() {
        this.$state.setting('allowRegisterProtocolHandler', true);
        this.handleLaunch();
    },
    methods: {
        addEmptyNetwork() {
            let nick = 'Guest' + Math.floor(Math.random() * 100);
            let network = this.$state.addNetwork(TextFormatting.t('new_network'), nick, {});
            network.showServerBuffer('settings');
        },
        async handleLaunch() {
            const connection = this.parseFragment();
            if (connection) {
                window.location.hash = '';
            }

            await this.init();

            if (connection) {
                this.applyIrcLink(connection);
            }
        },
        parseFragment() {
            if (!window.location.hash || window.location.hash.length < 2) {
                return null;
            }

            let fragment = window.location.hash.substr(1);
            const uriCheck = fragment.substr(0, 7).toLowerCase();
            if (uriCheck === 'ircs%3a' || uriCheck.substr(0, 6) === 'irc%3a') {
                try {
                    fragment = decodeURIComponent(fragment);
                } catch {
                    return null;
                }
            }

            if (!/^ircs?:\/\//i.test(fragment)) {
                return null;
            }

            const connection = Misc.parseIrcUri(fragment)[0];
            if (!connection || !connection.server ||
                !/^[a-z0-9.-]+$/i.test(connection.server)
            ) {
                return null;
            }
            if (!Number.isInteger(connection.port) ||
                connection.port < 1 ||
                connection.port > 65535
            ) {
                return null;
            }

            connection.nick = String(connection.nick || '')
                .replace(/[\x00-\x20\x7F]/g, '')
                .slice(0, 64);
            connection.channels = (connection.channels || []).filter((name) => (
                /^[#&][^\s,\x00-\x1F\x7F]+$/.test(name)
            ));

            return connection;
        },
        applyIrcLink(connection) {
            const existing = this.$state.getNetworkFromAddress(connection.server);
            if (existing) {
                this.focusNetwork(existing);
                this.promptJoinChannels(existing, connection.channels);
                return;
            }

            const nick = connection.nick ||
                ('Guest' + Math.floor(Math.random() * 100));
            const network = this.$state.addNetwork(connection.server, nick, {
                server: connection.server,
                port: connection.port,
                tls: connection.tls,
                direct: connection.direct,
                encoding: connection.encoding,
                channels: connection.channels.join(','),
            });

            network.connection.server = connection.server;
            network.connection.port = connection.port;
            network.connection.tls = connection.tls;
            network.connection.direct = !!connection.direct;
            network.connection.path = connection.path || '';
            network.connection.encoding = connection.encoding || 'utf8';
            network.connection.channels = connection.channels.join(',');
            network.showServerBuffer('settings');
        },
        focusNetwork(network) {
            this.$state.$emit('active.component', null);
            this.$state.setActiveBuffer(network.id, network.serverBuffer().name);
        },
        missingChannels(network, channels) {
            return (channels || []).filter((name) => {
                const buffer = network.bufferByName(name);
                return !buffer || !buffer.joined;
            });
        },
        appendChannels(network, channels) {
            const parsed = Misc.extractBuffers(network.connection.channels || '');
            const seen = new Set(parsed.map((buffer) => buffer.name.toLowerCase()));

            (channels || []).forEach((name) => {
                const key = name.toLowerCase();
                if (seen.has(key)) {
                    return;
                }
                seen.add(key);
                parsed.push({ name, key: '' });
            });

            const names = parsed.map((buffer) => buffer.name).join(',');
            const keys = parsed.map((buffer) => buffer.key || '')
                .join(',')
                .replace(/,+$/, '');
            network.connection.channels = keys ? names + ' ' + keys : names;
        },
        promptJoinChannels(network, channels) {
            const missing = this.missingChannels(network, channels);
            if (!missing.length) {
                return;
            }

            const message = this.$t('personal_join_channels_confirm', {
                network: network.name || network.connection.server,
                channels: missing.join('\n'),
            });
            if (typeof window.confirm === 'function' && !window.confirm(message)) {
                return;
            }

            if (network.state !== 'connected') {
                this.appendChannels(network, missing);
                return;
            }

            missing.forEach((name) => {
                const existed = !!network.bufferByName(name);
                const buffer = this.$state.addBuffer(network.id, name);
                if (!buffer) {
                    return;
                }
                buffer.enabled = true;
                if (!existed || !buffer.joined) {
                    network.ircClient.join(name, buffer.key || '');
                }
            });
        },
        toggleStateBrowser() {
            this.$state.$emit('statebrowser.show');
        },
        async init() {
            if (!firstRun) {
                return;
            }

            firstRun = false;

            // persist the buffers in the state by default
            let persistSetting = this.$state.settings.startupOptions.remember_buffers;
            if (typeof persistSetting === 'undefined') {
                this.$state.persistence.includeBuffers = true;
            } else {
                this.$state.persistence.includeBuffers = !!persistSetting;
            }

            this.$state.persistence.watchStateForChanges();

            let controllerNet = this.$state.networks.find((n) => n.is_bnc);
            if (controllerNet) {
                let bouncer = new BouncerProvider(this.$state);
                bouncer.enable(
                    controllerNet.connection.server,
                    controllerNet.connection.port,
                    controllerNet.connection.tls,
                    controllerNet.connection.direct,
                    controllerNet.connection.path,
                );
            }
            // force restricted: false as users need access
            // to network settings to add a network
            this.$state.setSetting('settings.restricted', false);

            if (this.$state.networks.length) {
                // small screen devices cannot open the statebrowser unless a network is selected
                // if any network exists in saved config make that active on startup
                this.$state.setActiveBuffer(this.$state.networks[0].id, '*');
            }

            this.$emit('start', {
                fallbackComponent: this.constructor,
            });
        },
    },
};
</script>

<style>

.kiwi-personal {
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
    text-align: center;
    padding-top: 1em;
    font-size: 1.2em;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.kiwi-personal h1 {
    margin: 0 0 20px 0;
}

.kiwi-personal p {
    margin: 0 0 10px 0;
}

.kiwi-personal button {
    margin: 10px auto 0 auto;
    padding: 0 40px;
    font-size: 1em;
    line-height: 40px;
}

/* Only show the toggle state browser link if on a small screen */
.kiwi-personal-existing-networks {
    display: none;
}

@media screen and (width <= 500px) {
    .kiwi-personal-existing-networks {
        display: inherit;
    }
}

</style>
