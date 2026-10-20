<template>
    <div
        :class="{ 'kiwi-serverselector--custom': presetServer === 'custom' }"
        class="kiwi-serverselector"
    >
        <div v-if="usePreset && presetNetworks.length > 0" class="kiwi-serverselector-presets">
            <label for="kiwi_preset_server">
                {{ $t(presetLabel || (presetServer === 'custom' ? 'preset_servers' : 'server')) }}
            </label>
            <select
                id="kiwi_preset_server"
                v-model="presetServer"
                class="u-input"
                :disabled="disabled"
            >
                <template v-if="enableCustom">
                    <option value="custom">{{ $t('custom_server') }}</option>
                    <option disabled>—</option>
                </template>
                <option
                    v-for="(s, idx) in presetNetworks"
                    :key="`preset_${idx}`"
                    :value="idx"
                >{{ s.name }}</option>
            </select>
        </div>

        <transition-expand>
            <div
                v-if="presetSelected === 'custom' || presetNetworks.length === 0 || !usePreset"
                class="kiwi-serverselector-connection"
            >
                <div class="kiwi-serverselector-connection-proto">
                    <label for="kiwi_server_proto">
                        {{ $t('protocol') }}
                    </label>
                    <select
                        id="kiwi_server_proto"
                        v-model="protocol"
                        class="u-input"
                        :disabled="disabled"
                    >
                        <option
                            v-for="(s, idx) in serverProtocols"
                            :key="`proto_${idx}`"
                            :value="s"
                        >{{ s }}://</option>
                    </select>
                </div>

                <input-text
                    v-model="server"
                    v-focus
                    :label="$t('server')"
                    :disabled="disabled"
                    class="kiwi-serverselector-connection-address"
                    @paste="onServerPaste"
                />

                <input-text
                    v-model="connection.port"
                    :label="$t('settings_port')"
                    :disabled="disabled"
                    type="number"
                    class="kiwi-serverselector-connection-port"
                >
                    <span
                        v-if="!ircOnly"
                        class="kiwi-serverselector-connection-tls"
                        :class="{ 'kiwi-serverselector-connection-tls--disabled': disabled }"
                        @click="toggleTls"
                    >
                        <i
                            class="fa fa-stack-1x fa-fw"
                            :class="[connection.tls ? 'fa-lock' : 'fa-unlock']"
                        />
                    </span>
                </input-text>
            </div>
        </transition-expand>
    </div>
</template>

<script>

'kiwi public';

import * as Misc from '@/helpers/Misc';

import Logger from '@/libs/Logger';

const log = Logger.namespace('ServerSelector');

export default {
    props: {
        enableCustom: {
            type: Boolean,
            default: true,
        },
        showPath: {
            type: Boolean,
            default: false,
        },
        usePreset: {
            type: Boolean,
            default: true,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        ircOnly: {
            type: Boolean,
            default: false,
        },
        connection: {
            type: Object,
            default: () => {},
        },
        presetLabel: {
            type: String,
            default: '',
        },
    },
    data() {
        return {
            presetNetworks: [],
            presetSelected: 'custom',
            serverAddress: '',
            serverPath: '',
            willEmit: false,
        };
    },
    computed: {
        presetServer: {
            set(newVal) {
                this.presetSelected = newVal;
                this.$emit('selected', newVal);

                const conn = newVal === 'custom'
                    ? Misc.getDefaultConnection()
                    : this.presetNetworks[newVal];

                Object.assign(this.connection, conn);
                this.ensureProtocolAvailable();
            },
            get() {
                return this.presetSelected;
            },
        },
        server: {
            get() {
                return this.showPath
                    ? this.connection.server + this.connection.path
                    : this.connection.server;
            },
            set(value) {
                const parts = value.split('/');
                this.connection.server = parts[0];
                if (parts.length > 1) {
                    this.connection.path = `/${parts.slice(1).join('/')}`;
                } else {
                    this.connection.path = '';
                }
            },
        },
        gatewayConfigured() {
            return !!String(
                this.$state.getSetting('settings.kiwiServer') || ''
            ).trim();
        },
        serverProtocols() {
            // A bouncer-managed network is an IRC network, not a websocket
            // transport. Its protocol field only chooses TLS.
            if (this.ircOnly) {
                return ['irc', 'ircs'];
            }

            const protocols = this.$state.getSetting('settings.serverProtocols') ||
                ['irc', 'ircs', 'ws', 'wss'];
            if (this.gatewayConfigured) {
                return protocols;
            }

            // A browser can only reach IRC through a gateway or a direct
            // websocket. Without a gateway, the non-websocket options cannot
            // work, so do not offer them.
            const direct = protocols.filter((proto) => proto === 'ws' || proto === 'wss');
            return direct.length ? direct : ['ws', 'wss'];
        },
        protocol: {
            get() {
                let proto = this.ircOnly || !this.connection.direct ? 'irc' : 'ws';
                if (this.connection.tls) {
                    proto += 's';
                }
                return proto;
            },
            set(newProto) {
                const proto = this.protocol;

                const portMap = {
                    irc: 6667,
                    ircs: 6697,
                    ws: 8067,
                    wss: 8097,
                };

                if (portMap[proto] === this.connection.port && portMap[newProto]) {
                    this.connection.port = portMap[newProto];
                }

                if (this.ircOnly) {
                    this.connection.tls = newProto === 'ircs';
                    return;
                }

                switch (newProto) {
                case 'irc':
                    this.connection.tls = false;
                    this.connection.direct = false;
                    break;
                case 'ircs':
                    this.connection.tls = true;
                    this.connection.direct = false;
                    break;
                case 'ws':
                    this.connection.tls = false;
                    this.connection.direct = true;
                    break;
                case 'wss':
                    this.connection.tls = true;
                    this.connection.direct = true;
                    break;
                default:
                    log.error('invalid protocol');
                }
            },
        },
    },
    created() {
        const networkList = this.$state.getSetting('settings.presetNetworks') || [];
        if (networkList) {
            this.importUris(networkList);
        }

        // If the given network is in the preset server list, select it. A
        // caller that disables presets (bouncer-managed networks) must not have
        // its connection overwritten by a matching preset.
        const con = this.connection;
        const presetIdx = this.usePreset ?
            this.presetNetworks.findIndex((s) => {
                let match = s.server === con.server
                    && s.port === con.port
                    && s.tls === con.tls
                    && s.direct === con.direct
                    && s.path === con.path;
                return match;
            }) :
            -1;

        if (this.ircOnly && !con.port) {
            con.port = con.tls ? 6697 : 6667;
        }

        if (presetIdx > -1) {
            this.presetServer = presetIdx.toString();
        } else if (!this.enableCustom && !this.connection.server && this.presetNetworks.length) {
            this.presetServer = '0';
        }

        this.ensureProtocolAvailable();
    },
    methods: {
        // Keep the selected protocol in the list the deployment can actually
        // use. Without a gateway, a gateway protocol has to become its direct
        // websocket equivalent before the connection is attempted.
        ensureProtocolAvailable() {
            if (this.ircOnly || this.gatewayConfigured) {
                return;
            }

            if (this.serverProtocols.includes(this.protocol)) {
                return;
            }

            const preferred = this.connection.tls ? 'wss' : 'ws';
            const nextProtocol = this.serverProtocols.includes(preferred) ?
                preferred :
                this.serverProtocols[0];

            if (nextProtocol) {
                this.protocol = nextProtocol;
            }
        },
        onServerPaste(event) {
            event.preventDefault();
            const pasted = event.clipboardData.getData('text');

            const conn = Misc.parsePresetServer(pasted);
            if (conn) {
                Object.assign(this.connection, conn);
                this.ensureProtocolAvailable();
            } else {
                this.connection.server = pasted;
            }
        },
        toggleTls() {
            if (this.disabled) {
                return;
            }
            const protocolMap = Object.fromEntries(
                Object.entries({
                    irc: 'ircs',
                    ircs: 'irc',
                    ws: 'wss',
                    wss: 'ws',
                }).filter(
                    ([key, value]) => this.serverProtocols.includes(key)
                        && this.serverProtocols.includes(value)
                )
            );

            if (protocolMap[this.protocol]) {
                this.protocol = protocolMap[this.protocol];
            }
        },
        importUris(serverList) {
            // [ 'freenode|irc.freenode.net:+6697', 'irc.snoonet.org:6667' ]
            const servers = [];
            serverList.forEach((server) => {
                if (typeof server === 'object') {
                    const conn = Misc.getDefaultConnection();
                    Object.assign(conn, server);
                    servers.push(conn);
                    return;
                }

                const conn = Misc.parsePresetServer(server);
                if (!conn) {
                    log.error('failed to parse presetNetwork:', server);
                    return;
                }
                servers.push(conn);
            });
            this.$set(this, 'presetNetworks', servers);
        },
    },
};
</script>

<style lang="less">
.kiwi-serverselector-type {
    display: flex;
    justify-content: left;
    align-items: center;
    gap: 10px;
    margin-bottom: 1em;

    input {
        margin: 0;
    }

    label {
        display: flex;
        flex-direction: row-reverse;
        align-items: center;
    }
}
.kiwi-serverselector {
    input {
        min-width: 0;
    }
}
.kiwi-serverselector-presets {
    margin-bottom: 1em;
}

.kiwi-serverselector-presets select {
    width: 100%;
}

.kiwi-serverselector-connection {
    display: grid;
    grid-template-columns: max-content auto minmax(0, max-content);
    column-gap: 4px;
    width: 100%;
}

.kiwi-serverselector-connection-proto {
    display: inline-block;
    overflow: hidden;

    select {
        appearance: none;
    }
}

.kiwi-serverselector-connection-address {
    display: inline-block;
}

.kiwi-serverselector-connection-port {
    display: inline-block;

    input {
        // 5 char + padlock + padding
        width: calc(5ch + 1.3em + 20px);
    }

    span {
        position: absolute;
        right: 2px;
        height: 100%;
        display: flex;
        align-items: center;
    }
}

.kiwi-serverselector-connection-tls {
    text-align: center;
    cursor: pointer;
    font-size: 1em;
}

.kiwi-serverselector-connection-tls--disabled {
    cursor: default;
}

.kiwi-serverselector-connection-tls i {
    position: relative;
    top: 1px;
    font-size: 1.3em;
}

.kiwi-serverselector-type {
    grid-column: 1 / 4;
}

@media screen and (max-width: 400px) {
    .kiwi-serverselector-connection {
        grid-template-columns: auto minmax(0, max-content);
    }

    .kiwi-serverselector-connection-proto select {
        width: 100%;
    }

    .kiwi-serverselector-connection-address {
        grid-row: 1;
        grid-column: 1 / span 2;
    }
}

</style>
