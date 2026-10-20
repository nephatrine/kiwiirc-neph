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
                    preset-label="network"
                    @selected="presetSelected = $event"
                />

                <tabbed-view
                    ref="tabs"
                    v-model="connection.type"
                    :show-tabs="showTabs"
                    class="kiwi-customserver-tabs"
                >
                    <tabbed-tab header="Network" name="irc">
                        <template v-if="connection.type === 'irc'">
                            <div class="kiwi-welcome-tabs kiwi-customserver-identity-tabs">
                                <button
                                    v-if="showAnonymousTab"
                                    type="button"
                                    :class="{
                                        'kiwi-welcome-tab--active': activeTab === 'anonymous',
                                    }"
                                    class="kiwi-welcome-tab"
                                    @click="activeTab = 'anonymous'"
                                >
                                    {{ $t('anonymous_tab') }}
                                </button>
                                <button
                                    v-if="showAccountTab"
                                    type="button"
                                    :class="{
                                        'kiwi-welcome-tab--active': activeTab === 'account',
                                    }"
                                    class="kiwi-welcome-tab"
                                    @click="activeTab = 'account'"
                                >
                                    {{ $t('account_tab') }}
                                </button>
                            </div>

                            <template v-if="activeTab === 'anonymous' && showAnonymousTab">
                                <div
                                    v-if="showAccountTab"
                                    class="kiwi-welcome-anonymous-warning"
                                >
                                    {{ $t('anonymous_warning') }}
                                </div>
                                <input-text
                                    v-model="fields.nick"
                                    :label="$t('nick_name')"
                                    :maxlength="nickLen || undefined"
                                    type="text"
                                    :class="{
                                        'kiwi-welcome-invalid-nick':
                                            !isNickValid || !isNickLengthValid,
                                    }"
                                />
                            </template>
                            <template v-else-if="activeTab === 'account' && showAccountTab">
                                <div class="kiwi-welcome-simple-input-container">
                                    <input-text
                                        v-model="fields.account"
                                        :label="$t('account_name')"
                                        type="text"
                                        autocomplete="username"
                                    />
                                    <input-text
                                        v-model="fields.password"
                                        :show-plain-text="true"
                                        :label="$t('account_password')"
                                        type="password"
                                        autocomplete="current-password"
                                    />
                                </div>
                            </template>

                            <div class="kiwi-welcome-simple-input-container">
                                <button
                                    type="button"
                                    class="kiwi-welcome-advanced-toggle"
                                    @click="showAdvanced = !showAdvanced"
                                >
                                    {{ showAdvanced ? '▾' : '▸' }} {{ $t('advanced') }}
                                </button>
                            </div>

                            <div v-if="showAdvanced" class="kiwi-welcome-advanced-box">
                                <input-text
                                    v-if="activeTab === 'account' && showAccountTab"
                                    v-model="fields.nick"
                                    :label="$t('nick_name')"
                                    :placeholder="accountNickSuggestion"
                                    :maxlength="nickLen || undefined"
                                    type="text"
                                    :class="{
                                        'kiwi-welcome-invalid-nick':
                                            !isNickValid || !isNickLengthValid,
                                    }"
                                />
                                <input-text
                                    v-model="fields.username"
                                    :label="$t('user_name')"
                                    :placeholder="effectiveNick"
                                    :maxlength="userLen || undefined"
                                    type="text"
                                    :class="{ 'kiwi-welcome-invalid-nick': !isUsernameValid }"
                                />
                                <input-text
                                    v-model="fields.gecos"
                                    :label="$t('real_name')"
                                    :maxlength="nameLen || undefined"
                                    type="text"
                                    :class="{ 'kiwi-welcome-invalid-nick': !isGecosValid }"
                                />
                                <input-text
                                    v-model="fields.serverPassword"
                                    :show-plain-text="true"
                                    :label="$t('server_password')"
                                    type="password"
                                    :class="{
                                        'kiwi-welcome-invalid-nick': !isServerPasswordValid,
                                    }"
                                />
                                <input-text
                                    v-if="showChannel"
                                    v-model="fields.channel"
                                    :label="$t('channel_list')"
                                />
                            </div>
                        </template>
                    </tabbed-tab>
                    <tabbed-tab header="Bouncer" name="bnc">
                        <template v-if="isBouncerPreset">
                            <div
                                v-if="bouncerUnsupported"
                                class="kiwi-welcome-simple-error"
                            >
                                <span>{{ $t('bouncer_networks_required') }}</span>
                            </div>
                            <template v-else>
                                <div class="kiwi-welcome-tabs kiwi-customserver-bouncer-tabs">
                                    <button
                                        v-if="showBouncerBncTab"
                                        type="button"
                                        :class="{
                                            'kiwi-welcome-tab--active':
                                                bouncerActiveTab === 'bnc',
                                        }"
                                        class="kiwi-welcome-tab"
                                        @click="bouncerActiveTab = 'bnc'"
                                    >
                                        {{ $t('bouncer_tab') }}
                                    </button>
                                    <button
                                        v-if="showBouncerAccountTab"
                                        type="button"
                                        :class="{
                                            'kiwi-welcome-tab--active':
                                                bouncerActiveTab === 'account',
                                        }"
                                        class="kiwi-welcome-tab"
                                        @click="bouncerActiveTab = 'account'"
                                    >
                                        {{ $t('account_tab') }}
                                    </button>
                                </div>

                                <template
                                    v-if="bouncerActiveTab === 'bnc' && showBouncerBncTab"
                                >
                                    <div class="kiwi-welcome-simple-input-container">
                                        <input-text
                                            v-model="bouncerFields.user"
                                            :label="$t('bouncer_user')"
                                            :title="$t('user_name')"
                                            :maxlength="userLen || undefined"
                                            type="text"
                                            autocomplete="username"
                                            :class="{
                                                'kiwi-welcome-invalid-nick':
                                                    !bouncerNickValid
                                                    || !bouncerNickLengthValid
                                                    || !bouncerUserLengthValid,
                                            }"
                                        />
                                        <input-text
                                            v-model="bouncerFields.password"
                                            :show-plain-text="true"
                                            :label="$t('bouncer_password')"
                                            :title="$t('server_password')"
                                            type="password"
                                            autocomplete="current-password"
                                        />
                                    </div>
                                </template>
                                <template
                                    v-else-if="
                                        bouncerActiveTab === 'account'
                                            && showBouncerAccountTab
                                    "
                                >
                                    <div class="kiwi-welcome-simple-input-container">
                                        <input-text
                                            v-model="bouncerFields.user"
                                            :label="$t('bouncer_user')"
                                            :title="$t('account_name')"
                                            type="text"
                                            autocomplete="username"
                                            :class="{
                                                'kiwi-welcome-invalid-nick':
                                                    !bouncerNickValid
                                                    || !bouncerNickLengthValid,
                                            }"
                                        />
                                        <input-text
                                            v-model="bouncerFields.password"
                                            :show-plain-text="true"
                                            :label="$t('bouncer_password')"
                                            :title="$t('account_password')"
                                            type="password"
                                            autocomplete="current-password"
                                        />
                                    </div>
                                </template>

                                <div
                                    v-if="showBouncerAccountTab"
                                    class="kiwi-welcome-simple-input-container"
                                >
                                    <button
                                        type="button"
                                        class="kiwi-welcome-advanced-toggle"
                                        @click="bouncerShowAdvanced = !bouncerShowAdvanced"
                                    >
                                        {{ bouncerShowAdvanced ? '▾' : '▸' }}
                                        {{ $t('advanced') }}
                                    </button>
                                </div>

                                <div
                                    v-if="bouncerShowAdvanced && showBouncerAccountTab"
                                    class="kiwi-welcome-advanced-box"
                                >
                                    <input-text
                                        v-model="bouncerFields.serverPassword"
                                        :show-plain-text="true"
                                        :label="$t('server_password')"
                                        type="password"
                                        :class="{
                                            'kiwi-welcome-invalid-nick':
                                                !bouncerServerPasswordValid,
                                        }"
                                    />
                                </div>
                            </template>
                        </template>
                        <template v-else>
                            <input-text
                                v-model="connection.account"
                                :label="$t('username')"
                                class="kiwi-customserver-nick"
                            />

                            <input-text
                                v-model="bouncerPassword"
                                :label="$t('account_password')"
                                type="password"
                            />
                        </template>
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
                    :disabled="!formReady"
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
import {
    compileNickPattern,
    isValidServerPassword,
    stripAccountSuffix,
    withinLimit
} from '@/helpers/LoginFields';
import Logger from '@/libs/Logger';
import BouncerProvider from '@/libs/BouncerProvider';
import { probeServerCaps, createProbeTransport } from '@/libs/ServerProbe';
import Captcha from '@/components/Captcha';

import StartupLayout from './CommonLayout';
import ServerSelector from '../ServerSelector';

const log = Logger.namespace('CustomServer');

// Each identity tab owns every field it may put on the wire. Nothing is
// copied between Anonymous and Account after the initial restore, so switching
// tabs can neither leak nor lose a value.
function createTabFields() {
    return {
        nick: '',
        account: '',
        password: '',
        username: '',
        gecos: '',
        serverPassword: '',
        channel: '',
    };
}

// BNC logins use a bouncer username, whereas Account logins use a bouncer
// account and may also need an upstream server password.
function createBouncerTabFields() {
    return {
        user: '',
        password: '',
        serverPassword: '',
    };
}

export default {
    components: {
        Captcha,
        StartupLayout,
        ServerSelector,
    },
    data() {
        return {
            nick: '',
            bouncerPassword: '',
            network: null,
            isFragment: false,
            showSelector: false,
            termsAccepted: false,
            presetSelected: 'custom',
            connectErrors: [],
            connection: Misc.getDefaultConnection(),
            activeTab: 'account',
            showAdvanced: false,
            bouncerActiveTab: 'account',
            bouncerShowAdvanced: false,
            showChannel: true,
            connectWithoutChannel: true,
            serverInfo: null,
            probeKey: '',
            probePending: false,
            probeCache: Object.create(null),
            tabs: {
                anonymous: createTabFields(),
                account: createTabFields(),
            },
            bouncerTabs: {
                bnc: createBouncerTabFields(),
                account: createBouncerTabFields(),
            },
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
        selectedPreset() {
            if (this.presetSelected === 'custom') {
                return null;
            }

            const presets = this.$state.getSetting('settings.presetNetworks') || [];
            const idx = parseInt(this.presetSelected, 10);
            if (!Number.isInteger(idx) || idx < 0 || idx >= presets.length) {
                return null;
            }

            const entry = presets[idx];
            if (typeof entry === 'object') {
                return Object.assign(Misc.getDefaultConnection(), entry);
            }
            return Misc.parsePresetServer(entry);
        },
        isBouncerPreset() {
            const preset = this.selectedPreset;
            return !!preset && preset.type === 'bnc';
        },
        fields() {
            return this.tabs[this.activeTab];
        },
        bouncerFields() {
            return this.bouncerTabs[this.bouncerActiveTab];
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
        // A probe is only run for presets, so Custom endpoints keep both
        // identity tabs and any server-advertised limits are simply unknown.
        probeCaps() {
            return (this.serverInfo && this.serverInfo.caps) || null;
        },
        probeIsupport() {
            return (this.serverInfo && this.serverInfo.isupport) || null;
        },
        probeComplete() {
            return !!(this.serverInfo && this.serverInfo.capsComplete);
        },
        bouncerHasSasl() {
            return this.probeHasCap('sasl');
        },
        bouncerHasCap() {
            return this.probeHasCap('draft/bouncer-networks') ||
                this.probeHasCap('soju.im/bouncer-networks');
        },
        bouncerUnsupported() {
            return this.isBouncerPreset && this.probeComplete && !this.bouncerHasCap;
        },
        showBouncerBncTab() {
            return this.isBouncerPreset && (!this.probeComplete || !this.bouncerHasSasl);
        },
        showBouncerAccountTab() {
            return this.isBouncerPreset && (!this.probeComplete || this.bouncerHasSasl);
        },
        // Account is shown unless the probe affirmatively returned caps
        // without sasl. If Anonymous is forbidden it shows anyway as the only
        // remaining pathway.
        accountOffered() {
            return !this.probeCaps ||
                Object.prototype.hasOwnProperty.call(this.probeCaps, 'sasl');
        },
        showAccountTab() {
            return this.accountOffered || !this.anonymousAllowed;
        },
        // Anonymous is shown unless the probe affirmatively saw
        // DRAFT/ACCOUNTREQUIRED in the ISUPPORT tokens.
        anonymousAllowed() {
            return !this.probeIsupport ||
                this.probeIsupport['DRAFT/ACCOUNTREQUIRED'] === undefined;
        },
        showAnonymousTab() {
            return this.anonymousAllowed;
        },
        accountNickSuggestion() {
            return stripAccountSuffix((this.tabs.account.account || '').trim());
        },
        effectiveNick() {
            if (this.connection.type === 'bnc') {
                return this.nick;
            }
            if (this.activeTab === 'account') {
                return this.fields.nick || this.accountNickSuggestion;
            }
            return this.fields.nick;
        },
        currentChannel() {
            return this.connection.type === 'bnc' ?
                '' :
                this.fields.channel;
        },
        channelReady() {
            if (this.connectWithoutChannel) {
                return true;
            }
            if (!this.currentChannel) {
                return false;
            }

            // Make sure every channel name starts with a common channel prefix
            let valid = true;
            let bufferObjs = Misc.extractBuffers(this.currentChannel);
            bufferObjs.forEach((bufferObj) => {
                if ('#&'.indexOf(bufferObj.name[0]) === -1) {
                    valid = false;
                }
            });
            return valid;
        },
        nickLen() {
            return this.probeLimit('NICKLEN');
        },
        userLen() {
            return this.probeLimit('USERLEN');
        },
        nameLen() {
            return this.probeLimit('NAMELEN');
        },
        isNickLengthValid() {
            return withinLimit(this.effectiveNick, this.nickLen);
        },
        isUsernameValid() {
            return withinLimit(this.fields.username, this.userLen);
        },
        isGecosValid() {
            return withinLimit(this.fields.gecos, this.nameLen);
        },
        isServerPasswordValid() {
            return isValidServerPassword(this.fields.serverPassword);
        },
        isNickValid() {
            const nickPattern = compileNickPattern(
                this.$state.setting('startupOptions.nick_format')
            );
            if (!nickPattern) {
                log.error('Nick format error in startupOptions.nick_format');
                return false;
            }

            return !!(this.effectiveNick || '').match(nickPattern);
        },
        bouncerDerivedNick() {
            return this.derivedBouncerNick(this.bouncerFields.user);
        },
        bouncerNickValid() {
            return this.isBouncerNickValid(this.bouncerFields.user);
        },
        bouncerNickLengthValid() {
            return this.isBouncerNickLengthValid(this.bouncerFields.user);
        },
        bouncerUserLengthValid() {
            return this.bouncerActiveTab !== 'bnc' ||
                withinLimit(this.bouncerFields.user, this.userLen);
        },
        bouncerServerPasswordValid() {
            return this.bouncerActiveTab !== 'account' ||
                isValidServerPassword(this.bouncerFields.serverPassword);
        },
        readyBouncerBnc() {
            const fields = this.bouncerTabs.bnc;
            return !!fields.user.trim() && !!fields.password &&
                this.isBouncerNickValid(fields.user) &&
                this.isBouncerNickLengthValid(fields.user) &&
                withinLimit(fields.user, this.userLen) &&
                (!this.termsContent || this.termsAccepted);
        },
        readyBouncerAccount() {
            const fields = this.bouncerTabs.account;
            return !!fields.user.trim() && !!fields.password &&
                this.isBouncerNickValid(fields.user) &&
                this.isBouncerNickLengthValid(fields.user) &&
                isValidServerPassword(fields.serverPassword) &&
                (!this.termsContent || this.termsAccepted);
        },
        readyAnonymous() {
            return !!this.fields.nick && this.channelReady && !!this.isNickValid &&
                !!this.isNickLengthValid && this.isUsernameValid && this.isGecosValid &&
                this.isServerPasswordValid &&
                (!this.termsContent || this.termsAccepted);
        },
        readyAccount() {
            return !!this.effectiveNick && !!this.fields.account.trim() &&
                !!this.fields.password && this.channelReady && !!this.isNickValid &&
                !!this.isNickLengthValid && this.isUsernameValid && this.isGecosValid &&
                this.isServerPasswordValid &&
                (!this.termsContent || this.termsAccepted);
        },
        readyBouncer() {
            return !!this.connection.server && !!this.connection.account &&
                (!this.termsContent || this.termsAccepted);
        },
        formReady() {
            if (this.connection.type === 'bnc') {
                if (!this.isBouncerPreset) {
                    return this.readyBouncer;
                }
                if (this.bouncerUnsupported || this.probePending) {
                    return false;
                }
                if (this.bouncerActiveTab === 'bnc' && this.showBouncerBncTab) {
                    return this.readyBouncerBnc;
                }
                return this.showBouncerAccountTab && this.readyBouncerAccount;
            }
            if (this.activeTab === 'account' && this.showAccountTab) {
                return this.readyAccount;
            }
            return this.readyAnonymous;
        },
    },
    watch: {
        showAccountTab() {
            this.ensureValidTab();
        },
        showAnonymousTab() {
            this.ensureValidTab();
        },
        showBouncerBncTab() {
            this.ensureValidBouncerTab();
        },
        showBouncerAccountTab() {
            this.ensureValidBouncerTab();
        },
        presetSelected() {
            this.onPresetChanged();
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
        this.tabs.anonymous.nick = this.nick;
        this.tabs.account.account = options.account || '';
        this.tabs.account.password = options.password || '';
        this.bouncerTabs.account.user = options.account || '';
        this.bouncerTabs.account.password = options.password || '';
        this.tabs.anonymous.channel = options.channel || '';
        this.tabs.account.channel = options.channel || '';

        this.showChannel = typeof options.showChannel === 'boolean' ?
            options.showChannel :
            true;
        this.connectWithoutChannel = typeof options.allowNoChannel === 'boolean' ?
            options.allowNoChannel :
            true;
        if (!this.showChannel) {
            this.connectWithoutChannel = true;
        }

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
                this.tabs.anonymous.channel = this.connection.channels || '';
                this.tabs.account.channel = this.connection.channels || '';
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
    mounted() {
        // The selector may have picked a matching preset during its own
        // creation, before this component's watcher could observe it.
        this.onPresetChanged();
    },
    methods: {
        readableStateError(err) {
            return Misc.networkErrorMessage(err);
        },
        // ISUPPORT length tokens are optional; 0 means "no known limit".
        probeLimit(token) {
            const tokens = this.probeIsupport || {};
            const limit = parseInt(tokens[token], 10);
            return limit > 0 ? limit : 0;
        },
        probeHasCap(name) {
            return !!this.probeCaps &&
                Object.prototype.hasOwnProperty.call(this.probeCaps, name);
        },
        derivedBouncerNick(user) {
            return stripAccountSuffix((user || '').trim());
        },
        isBouncerNickValid(user) {
            const nickPattern = compileNickPattern(
                this.$state.setting('startupOptions.nick_format')
            );
            if (!nickPattern) {
                log.error('Nick format error in startupOptions.nick_format');
                return false;
            }

            return !!this.derivedBouncerNick(user).match(nickPattern);
        },
        isBouncerNickLengthValid(user) {
            return withinLimit(this.derivedBouncerNick(user), this.nickLen);
        },
        // Keep the active identity tab on one the server actually offers.
        ensureValidTab() {
            if (this.isBouncerPreset) {
                this.ensureValidBouncerTab();
                return;
            }

            const available = [];
            if (this.showAccountTab) {
                available.push('account');
            }
            if (this.showAnonymousTab) {
                available.push('anonymous');
            }
            if (available.length > 0 && !available.includes(this.activeTab)) {
                this.activeTab = available[0];
            }
        },
        ensureValidBouncerTab() {
            if (this.bouncerUnsupported) {
                return;
            }

            const available = [];
            if (this.showBouncerAccountTab) {
                available.push('account');
            }
            if (this.showBouncerBncTab) {
                available.push('bnc');
            }
            if (available.length > 0 &&
                !available.includes(this.bouncerActiveTab)
            ) {
                this.bouncerActiveTab = available[0];
            }
        },
        onPresetChanged() {
            const preset = this.selectedPreset;
            if (!preset) {
                this.serverInfo = null;
                this.probeKey = '';
                this.probePending = false;
                this.tabs.anonymous.channel = this.startupOptions.channel || '';
                this.tabs.account.channel = this.startupOptions.channel || '';
                return;
            }
            if (preset.type === 'bnc') {
                this.serverInfo = null;
                this.probeKey = '';
                this.probePending = false;
                this.ensureValidBouncerTab();
                this.maybeProbePreset(preset);
                return;
            }

            this.tabs.anonymous.channel = preset.channels || '';
            this.tabs.account.channel = preset.channels || '';

            this.maybeProbePreset(preset);
        },
        // Only presets are probed. Custom endpoints keep the unproven default
        // (both tabs visible, no server-advertised limits). The cache stores
        // the promise itself so an in-flight probe is reused as well, making
        // A -> B -> A in the dropdown a single probe for A.
        maybeProbePreset(preset) {
            if (this.startupOptions.probeServerCaps !== true || !preset.server) {
                this.serverInfo = null;
                this.probeKey = '';
                this.probePending = false;
                return;
            }

            // ServerSelector may have converted a gateway preset to a direct
            // websocket when this deployment has no gateway. Probe the
            // endpoint actually shown in the form.
            const server = this.connection.server || preset.server;
            const tls = !!this.connection.tls;
            const port = this.connection.port || (tls ? 6697 : 6667);
            const direct = !!this.connection.direct;
            const path = this.connection.path || '';
            const key = [
                server,
                port,
                tls ? 'tls' : 'plain',
                direct ? 'direct' : 'gateway',
                path,
            ].join('|');

            this.serverInfo = null;
            this.probeKey = key;
            this.probePending = true;

            if (!this.probeCache[key]) {
                this.probeCache[key] = probeServerCaps({
                    createTransport: () => createProbeTransport({
                        direct: direct,
                        kiwiServer: this.$state.settings.kiwiServer,
                        sessionId: (window.location.hash || '').substr(1),
                        host: server,
                        port: port,
                        tls: tls,
                        path: path,
                    }),
                    transportOptions: {
                        direct: direct,
                        host: server,
                        port: port,
                    },
                });
            }

            this.probeCache[key].then((info) => {
                if (this.probeKey === key) {
                    this.applyServerInfo(info);
                }
            }).catch((err) => {
                log.error('Server probe failed:', err);
                if (this.probeKey === key) {
                    this.applyServerInfo({
                        caps: {},
                        isupport: {},
                        extendedIsupport: false,
                        capsComplete: false,
                    });
                }
            });
        },
        applyServerInfo(info) {
            this.probePending = false;
            if (!info) {
                return;
            }
            this.serverInfo = info;
            this.ensureValidTab();
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
                    password: '',
                    account: conn.type === 'bnc' ? (conn.account || '') : '',

                    encoding: (options.encoding || 'utf-8').trim(),
                    gecos: options.gecos,
                    username: options.username,
                });
            }

            // network.password carries the SASL secret for a direct connection
            // and the bouncer password for a control connection. The server
            // PASS is assigned separately in startUp(); BouncerProvider reads
            // the control connection's credentials from here.
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
            if (!this.formReady) {
                return;
            }

            this.connectErrors = [];
            const conn = this.connection;

            if (conn.type === 'irc') {
                // A quick submit can race the tab-availability watcher, so
                // never use credentials from a tab the server did not offer.
                let mode = this.activeTab;
                if (mode === 'account' && !this.showAccountTab) {
                    mode = 'anonymous';
                }
                if (mode === 'anonymous' && !this.showAnonymousTab) {
                    mode = 'account';
                }
                const fields = this.tabs[mode];
                const isAnonymous = mode === 'anonymous';
                const password = isAnonymous ? '' : fields.password;
                const loginAccount = isAnonymous ? '' : fields.account;
                let modeNick = fields.nick;
                if (mode === 'account') {
                    modeNick = fields.nick || stripAccountSuffix(fields.account.trim());
                }

                this.network = this.createNetwork(conn, modeNick, password);
                this.network.connection.account = loginAccount;
                this.network.connection.password = fields.serverPassword || '';
                this.network.password = password;
                if (fields.username) {
                    this.network.username = fields.username;
                }
                if (fields.gecos) {
                    this.network.gecos = fields.gecos;
                }

                // Only switch to the first channel we join if multiple are being joined
                let hasSwitchedActiveBuffer = false;
                let bufferObjs = Misc.extractBuffers(fields.channel);
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
            } else if (this.isBouncerPreset) {
                let mode = this.bouncerActiveTab;
                if (mode === 'account' && !this.showBouncerAccountTab) {
                    mode = 'bnc';
                }
                if (mode === 'bnc' && !this.showBouncerBncTab) {
                    mode = 'account';
                }

                const fields = this.bouncerTabs[mode];
                const user = (fields.user || '').trim();
                const nick = stripAccountSuffix(user);
                const password = mode === 'account' ? fields.password : '';

                this.network = this.createNetwork(conn, nick, password);
                this.network.connection.nick = nick;
                this.network.connection.account = '';
                this.network.connection.password = '';
                this.network.password = '';
                this.network.username = '';

                if (mode === 'bnc') {
                    this.network.username = user;
                    this.network.connection.password = fields.password;
                } else {
                    this.network.connection.account = user;
                    this.network.password = fields.password;
                    this.network.connection.password = fields.serverPassword || '';
                }

                // Route every connection through the bouncer and let it manage
                // the bouncer's own networks from here on.
                let bouncer = new BouncerProvider(this.$state);
                bouncer.enable(conn.server, conn.port, conn.tls, conn.direct, conn.path);
            } else {
                // Manual Bouncer tab for a custom endpoint.
                this.network = this.createNetwork(
                    conn,
                    conn.account || this.nick,
                    this.bouncerPassword
                );

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
.kiwi-customserver-terms {
    margin-bottom: 1em;
}

.kiwi-customserver-identity-tabs,
.kiwi-customserver-bouncer-tabs {
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
