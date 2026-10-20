<template>
    <startup-layout
        ref="layout"
        :remember-settings="layoutRememberSettings"
        :remember-passwords="layoutRememberPasswords"
        class="kiwi-startbouncer"
    >
        <template #connection>
            <form
                v-if="bouncerUnsupported"
                class="u-form u-form--big kiwi-welcome-simple-form"
            >
                <h2 v-html="greetingText" />
                <div class="kiwi-welcome-simple-error">
                    <span>{{ $t('bouncer_networks_required') }}</span>
                </div>
            </form>

            <form
                v-else
                class="u-form u-form--big kiwi-welcome-simple-form"
                @submit.prevent="startUp"
            >
                <h2 v-html="greetingText" />

                <div
                    v-if="connectErrors.length || statusMessage"
                    class="kiwi-welcome-simple-error"
                >
                    <span v-if="statusMessage">{{ statusMessage }}</span>
                    <span v-for="err in connectErrors" :key="err">{{ err }}</span>
                </div>

                <div v-if="showTabs" class="kiwi-welcome-tabs">
                    <button
                        v-if="showBncTab"
                        type="button"
                        :class="{ 'kiwi-welcome-tab--active': activeTab === 'bnc' }"
                        class="kiwi-welcome-tab"
                        @click="activeTab = 'bnc'"
                    >
                        {{ $t('bouncer_tab') }}
                    </button>
                    <button
                        v-if="showAccountTab"
                        type="button"
                        :class="{ 'kiwi-welcome-tab--active': activeTab === 'account' }"
                        class="kiwi-welcome-tab"
                        @click="activeTab = 'account'"
                    >
                        {{ $t('account_tab') }}
                    </button>
                    <button
                        v-if="showRegisterTab"
                        type="button"
                        :class="{ 'kiwi-welcome-tab--active': activeTab === 'register' }"
                        class="kiwi-welcome-tab"
                        @click="activeTab = 'register'"
                    >
                        {{ $t('register_tab') }}
                    </button>
                </div>

                <template v-if="activeTab === 'bnc' && showBncTab">
                    <div class="kiwi-welcome-simple-input-container">
                        <input-text
                            ref="bncTabUser"
                            v-model="fields.user"
                            v-focus="!isIframe && !fields.user"
                            :label="$t('bouncer_user')"
                            :title="$t('user_name')"
                            :maxlength="userLen || undefined"
                            type="text"
                            autocomplete="username"
                            :class="{
                                'kiwi-welcome-invalid-nick':
                                    !isDerivedNickValid
                                    || !isDerivedNickLengthValid
                                    || !isBncUserLengthValid,
                            }"
                        />
                        <input-text
                            v-model="fields.password"
                            v-focus="!isIframe && !!fields.user && !fields.password"
                            :show-plain-text="true"
                            :label="$t('bouncer_password')"
                            :title="$t('server_password')"
                            type="password"
                            autocomplete="current-password"
                        />
                    </div>
                </template>

                <template v-else-if="activeTab === 'account' && showAccountTab">
                    <div class="kiwi-welcome-simple-input-container">
                        <input-text
                            ref="accountTabUser"
                            v-model="fields.user"
                            v-focus="!isIframe && !fields.user"
                            :label="$t('bouncer_user')"
                            :title="$t('account_name')"
                            type="text"
                            autocomplete="username"
                            :class="{
                                'kiwi-welcome-invalid-nick':
                                    !isDerivedNickValid || !isDerivedNickLengthValid,
                            }"
                        />
                        <input-text
                            v-model="fields.password"
                            v-focus="!isIframe && !!fields.user && !fields.password"
                            :show-plain-text="true"
                            :label="$t('bouncer_password')"
                            :title="$t('account_password')"
                            type="password"
                            autocomplete="current-password"
                        />
                    </div>
                </template>

                <template v-else-if="activeTab === 'register' && showRegisterTab">
                    <div class="kiwi-welcome-simple-input-container">
                        <input-text
                            ref="registerTabUser"
                            v-model="fields.user"
                            v-focus="!isIframe && !fields.user"
                            :label="$t('bouncer_user')"
                            :title="$t('account_name')"
                            type="text"
                            autocomplete="username"
                            :class="{
                                'kiwi-welcome-invalid-nick':
                                    !isDerivedNickValid || !isDerivedNickLengthValid,
                            }"
                        />
                        <input-text
                            ref="registerTabPassword"
                            v-model="fields.password"
                            v-focus="!isIframe && !!fields.user && !fields.password"
                            :show-plain-text="true"
                            :label="$t('bouncer_password')"
                            :title="$t('account_password')"
                            type="password"
                            autocomplete="new-password"
                        />
                        <div v-if="fields.password" class="kiwi-welcome-password-strength">
                            <div class="kiwi-welcome-password-strength-bar">
                                <span
                                    class="kiwi-welcome-password-strength-level"
                                    :class="passwordStrengthClass"
                                />
                            </div>
                            <span class="kiwi-welcome-password-strength-label">
                                {{ $t(passwordStrengthLabel) }}
                            </span>
                        </div>
                        <div v-if="registerPasswordHint" class="kiwi-welcome-register-hint">
                            {{ registerPasswordHint }}
                        </div>
                        <input-text
                            v-model="fields.email"
                            :label="$t(probeRegInfo && probeRegInfo.emailRequired
                                ? 'account_email_req'
                                : 'account_email_opt')"
                            type="email"
                            autocomplete="email"
                        />
                    </div>
                </template>

                <div class="kiwi-welcome-simple-input-container">
                    <label>
                        <input v-model="fields.rememberSettings" type="checkbox">
                        <span> {{ $t('remember_settings') }} </span>
                    </label>
                </div>

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
                        v-if="activeTab !== 'bnc'"
                        v-model="fields.serverPassword"
                        :show-plain-text="true"
                        :label="$t('server_password')"
                        type="password"
                        :class="{ 'kiwi-welcome-invalid-nick': !isServerPasswordValid }"
                    />
                    <div class="kiwi-welcome-advanced-row">
                        <label>
                            <input
                                v-model="fields.rememberPasswords"
                                :disabled="rememberPasswordDisabled"
                                type="checkbox"
                            >
                            <span> {{ $t('remember_password') }} </span>
                        </label>
                    </div>
                </div>

                <template v-if="awaitingVerify">
                    <p>{{ $t('register_verify_prompt') }}</p>
                    <div class="kiwi-welcome-simple-input-container">
                        <input-text
                            v-model="registerCode"
                            :label="$t('verification_code')"
                            type="text"
                        />
                    </div>
                    <div class="kiwi-welcome-register-actions">
                        <button
                            type="button"
                            :disabled="!registerCode.trim()"
                            class="u-button u-button-primary u-submit kiwi-welcome-simple-start"
                            @click="submitRegisterCode"
                        >
                            {{ $t('verify_submit') }}
                        </button>
                        <button
                            type="button"
                            class="u-button u-button-secondary"
                            @click="cancelRegistration"
                        >
                            {{ $t('cancel') }}
                        </button>
                    </div>
                </template>
                <button
                    v-else
                    :disabled="loading || probePending || !formReady"
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
import { probeServerCaps, createProbeTransport } from '@/libs/ServerProbe';
import { parseAccountRegistrationCap } from '@/libs/accountRegistration';
import { passwordScore } from '@/helpers/PasswordStrength';
import {
    byteLength,
    compileNickPattern,
    isValidServerPassword,
    stripAccountSuffix,
    withinLimit
} from '@/helpers/LoginFields';
import StartupLayout from './CommonLayout';

let log = Logger.namespace('Startup/bouncer');

function createTabFields() {
    return {
        user: '',
        password: '',
        email: '',
        serverPassword: '',
        rememberSettings: true,
        rememberPasswords: false,
    };
}

export default {
    components: {
        StartupLayout,
    },
    data: function data() {
        return {
            loading: false,
            probePending: false,
            activeTab: 'account',
            showAdvanced: false,
            connectErrors: [],
            serverInfo: null,
            network: null,
            statusMessage: '',
            registerCode: '',
            tabs: {
                bnc: createTabFields(),
                account: createTabFields(),
                register: createTabFields(),
            },
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
        startupOptions() {
            return this.$state.settings.startupOptions;
        },
        isIframe() {
            return !(window === window.parent || window.opener);
        },
        greetingText: function greetingText() {
            let greeting = this.startupOptions.greetingText;
            return typeof greeting === 'string' ?
                greeting :
                this.$t('start_greeting');
        },
        buttonText: function buttonText() {
            if (this.loading) {
                return '';
            }

            let button = this.startupOptions.buttonText;
            if (typeof button === 'string') {
                return button;
            }

            return this.activeTab === 'register' ?
                this.$t('register_submit') :
                this.$t('start_button');
        },
        fields() {
            return this.tabs[this.activeTab];
        },
        probeCaps() {
            return (this.serverInfo && this.serverInfo.caps) || null;
        },
        probeComplete() {
            return !!(this.serverInfo && this.serverInfo.capsComplete);
        },
        hasSasl() {
            return this.hasCap('sasl');
        },
        hasBouncerCap() {
            return this.hasCap('draft/bouncer-networks') ||
                this.hasCap('soju.im/bouncer-networks');
        },
        bouncerUnsupported() {
            return this.probeComplete && !this.hasBouncerCap;
        },
        showBncTab() {
            return !this.probeComplete || !this.hasSasl;
        },
        showAccountTab() {
            return !this.probeComplete || this.hasSasl;
        },
        showRegisterTab() {
            return this.probeComplete && !!this.probeRegInfo;
        },
        showTabs() {
            return this.showBncTab || this.showAccountTab || this.showRegisterTab;
        },
        probeRegInfo() {
            const caps = this.probeCaps;
            if (!caps) {
                return null;
            }
            const value = caps['draft/account-registration'];
            if (typeof value === 'undefined') {
                return null;
            }
            const info = parseAccountRegistrationCap(value);
            return info.beforeConnect ?
                info :
                null;
        },
        userLen() {
            return this.probeLimit('USERLEN');
        },
        nickLen() {
            return this.probeLimit('NICKLEN');
        },
        derivedNick() {
            return stripAccountSuffix((this.fields.user || '').trim());
        },
        isDerivedNickValid() {
            const nickPattern = compileNickPattern(
                this.$state.setting('startupOptions.nick_format')
            );
            if (!nickPattern) {
                log.error('Nick format error in startupOptions.nick_format');
                return false;
            }

            return !!this.derivedNick.match(nickPattern);
        },
        isDerivedNickLengthValid() {
            return withinLimit(this.derivedNick, this.nickLen);
        },
        isBncUserLengthValid() {
            return this.activeTab !== 'bnc' ||
                withinLimit(this.fields.user, this.userLen);
        },
        isServerPasswordValid() {
            return this.activeTab === 'bnc' ||
                isValidServerPassword(this.fields.serverPassword);
        },
        passwordStrength() {
            return passwordScore(
                this.activeTab === 'register' ? this.fields.password : ''
            );
        },
        passwordStrengthClass() {
            return 'kiwi-welcome-password-strength-level--' + this.passwordStrength;
        },
        passwordStrengthLabel() {
            const labels = [
                'password_strength_weak',
                'password_strength_fair',
                'password_strength_good',
                'password_strength_strong',
            ];
            return labels[Math.max(0, this.passwordStrength - 1)] || labels[0];
        },
        registerPasswordHint() {
            const info = this.probeRegInfo;
            if (!info) {
                return '';
            }
            if (info.minPasswordLength && info.maxPasswordLength) {
                return this.$t('register_password_length', {
                    min: info.minPasswordLength,
                    max: info.maxPasswordLength,
                });
            }
            if (info.minPasswordLength) {
                return this.$t('register_password_min', {
                    min: info.minPasswordLength,
                });
            }
            if (info.maxPasswordLength) {
                return this.$t('register_password_max', {
                    max: info.maxPasswordLength,
                });
            }
            return '';
        },
        passwordWithinLimits() {
            const info = this.probeRegInfo;
            if (!info) {
                return false;
            }

            const length = byteLength(this.fields.password);
            if (info.minPasswordLength && length < info.minPasswordLength) {
                return false;
            }
            if (info.maxPasswordLength && length > info.maxPasswordLength) {
                return false;
            }
            return true;
        },
        readyBnc() {
            const fields = this.tabs.bnc;
            return !!fields.user.trim() &&
                !!fields.password &&
                this.isDerivedNickValid &&
                this.isDerivedNickLengthValid &&
                withinLimit(fields.user, this.userLen);
        },
        readyAccount() {
            return !!this.fields.user.trim() &&
                !!this.fields.password &&
                !!this.isDerivedNickValid &&
                !!this.isDerivedNickLengthValid &&
                !!this.isServerPasswordValid;
        },
        readyRegister() {
            return !!this.fields.user.trim() &&
                !!this.fields.password &&
                this.passwordWithinLimits &&
                (!this.probeRegInfo.emailRequired || !!this.fields.email.trim()) &&
                !!this.isDerivedNickValid &&
                !!this.isDerivedNickLengthValid &&
                !!this.isServerPasswordValid;
        },
        formReady() {
            if (this.bouncerUnsupported || this.probePending) {
                return false;
            }
            if (this.activeTab === 'register' && this.showRegisterTab) {
                return this.readyRegister;
            }
            if (this.activeTab === 'account' && this.showAccountTab) {
                return this.readyAccount;
            }
            return this.activeTab === 'bnc' && this.showBncTab && this.readyBnc;
        },
        rememberPasswordDisabled() {
            if (!this.fields.rememberSettings) {
                return true;
            }
            return this.activeTab === 'bnc' && !this.fields.password;
        },
        layoutRememberSettings() {
            return this.fields.rememberSettings;
        },
        layoutRememberPasswords() {
            return this.fields.rememberSettings &&
                this.fields.rememberPasswords &&
                !this.rememberPasswordDisabled;
        },
        awaitingVerify() {
            return !!(this.network &&
                this.network.registration &&
                this.network.registration.awaitingVerify);
        },
    },
    watch: {
        showBncTab() {
            this.ensureValidTab();
        },
        showAccountTab() {
            this.ensureValidTab();
        },
        showRegisterTab() {
            this.ensureValidTab();
        },
    },
    created() {
        this.restoreLoginState();
        this.maybeProbeServer();
    },
    methods: {
        hasCap(name) {
            return !!this.probeCaps &&
                Object.prototype.hasOwnProperty.call(this.probeCaps, name);
        },
        probeLimit(token) {
            const tokens = (this.serverInfo && this.serverInfo.isupport) || null;
            const limit = parseInt(tokens && tokens[token], 10);
            return limit > 0 ? limit : 0;
        },
        restoreLoginState() {
            const remembered = !!this.$state.user_settings.remember_password;
            const controller = this.$state.networks.find((network) => (
                network.isBouncerController && network.isBouncerController()
            ));

            if (controller) {
                const account = controller.connection.account || '';
                const password = controller.password || '';
                if (account || password) {
                    this.tabs.account.user = account;
                    this.tabs.account.password = password;
                    this.tabs.account.rememberPasswords = remembered && !!password;
                    this.activeTab = 'account';
                    return;
                }

                const user = controller.username || controller.connection.nick || '';
                const serverPassword = controller.connection.password || '';
                if (user || serverPassword) {
                    this.tabs.bnc.user = user;
                    this.tabs.bnc.password = serverPassword;
                    this.tabs.bnc.rememberPasswords = remembered && !!serverPassword;
                    this.activeTab = 'bnc';
                    return;
                }
            }

            const options = this.startupOptions;
            if (options.account || options.password) {
                this.tabs.account.user = options.account || '';
                this.tabs.account.password = options.password || '';
                this.tabs.account.rememberPasswords = remembered && !!options.password;
                this.activeTab = 'account';
            }
        },
        maybeProbeServer() {
            if (this.startupOptions.probeServerCaps !== true) {
                return;
            }

            const connection = this.connectOptions;
            if (!connection.hostname || connection.hostname === 'default') {
                return;
            }

            this.probePending = true;
            const sessionId = (window.location.hash || '').substr(1);
            let probe;
            try {
                probe = probeServerCaps({
                    createTransport: () => createProbeTransport({
                        direct: connection.direct,
                        kiwiServer: this.$state.settings.kiwiServer,
                        sessionId: sessionId,
                        host: connection.hostname,
                        port: connection.port,
                        tls: connection.tls,
                        path: connection.direct_path,
                    }),
                    transportOptions: {
                        direct: connection.direct,
                        host: connection.hostname,
                        port: connection.port,
                    },
                });
            } catch (err) {
                log.error('Server probe could not start:', err);
                this.probePending = false;
                return;
            }

            probe.then((info) => {
                this.serverInfo = info;
                this.probePending = false;
                this.ensureValidTab();
            }).catch((err) => {
                log.error('Server probe failed:', err);
                this.serverInfo = {
                    caps: {},
                    isupport: {},
                    extendedIsupport: false,
                    capsComplete: false,
                };
                this.probePending = false;
            });
        },
        ensureValidTab() {
            if (this.bouncerUnsupported) {
                return;
            }

            const available = [];
            if (this.showAccountTab) {
                available.push('account');
            }
            if (this.showBncTab) {
                available.push('bnc');
            }
            if (this.showRegisterTab) {
                available.push('register');
            }

            if (available.length > 0 && available.indexOf(this.activeTab) === -1) {
                this.activeTab = available[0];
            }
        },
        startUp() {
            if (!this.formReady) {
                return;
            }

            this.connectErrors = [];
            this.statusMessage = '';
            this.loading = true;

            const connection = this.connectOptions;
            const mode = this.activeTab;
            const fields = this.fields;
            const user = (fields.user || '').trim();
            const derivedNick = stripAccountSuffix(user);
            const isRegister = mode === 'register' && !!this.probeRegInfo;
            const registrationPassword = isRegister ? fields.password : '';

            log(`Connecting to bouncer at ${connection.hostname}:${connection.port}`);

            let bncnet = this.$state.networks.find((network) => (
                network.is_bnc && !network.connection.bncnetid
            ));

            if (!bncnet) {
                bncnet = this.$state.addNetwork('BNC', derivedNick, {
                    server: connection.hostname,
                    port: connection.port,
                    tls: connection.tls,
                });
            }

            bncnet.is_bnc = true;
            bncnet.hidden = false;
            bncnet.name = 'BNC';
            bncnet.username = '';
            bncnet.password = '';
            bncnet.connection.account = '';
            bncnet.connection.password = '';
            bncnet.connection.nick = derivedNick;
            bncnet.connection.server = connection.hostname;
            bncnet.connection.port = connection.port;
            bncnet.connection.tls = connection.tls;
            bncnet.connection.direct = connection.direct;
            bncnet.connection.path = connection.direct_path;

            if (mode === 'bnc') {
                bncnet.username = user;
                bncnet.connection.password = fields.password;
            } else if (mode === 'account') {
                bncnet.connection.account = user;
                bncnet.password = fields.password;
                bncnet.connection.password = fields.serverPassword;
            } else {
                bncnet.connection.password = fields.serverPassword;
            }

            this.network = bncnet;

            let registeredAccount = '';
            if (isRegister) {
                registeredAccount = this.probeRegInfo.customAccountName ?
                    user :
                    derivedNick;
            }

            let cleanUpEvents = () => {
                bncnet.ircClient.off('registered', onRegistered);
                bncnet.ircClient.off('irc error', onError);
                bncnet.ircClient.off('close', onClose);
            };

            let onRegistered = () => {
                cleanUpEvents();

                if (isRegister) {
                    bncnet.connection.account = registeredAccount;
                    bouncer.bnc.username = registeredAccount;
                    bouncer.bnc.password = registrationPassword;
                }

                this.$state.user_settings.remember_password =
                    fields.rememberSettings && fields.rememberPasswords;

                if (this.$refs.layout) {
                    this.$refs.layout.close();
                }
            };

            let onError = (event) => {
                cleanUpEvents();
                this.statusMessage = this.$t('invalid_login');
                if (event && event.reason) {
                    this.connectErrors.push(event.reason);
                }
                this.loading = false;
            };

            let onClose = () => {
                cleanUpEvents();
                this.statusMessage = this.$t('invalid_login');
                if (bncnet.last_error) {
                    this.connectErrors.push(bncnet.last_error);
                }
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

            // Accessing ircClient installs the middleware methods (including
            // armPreConnectRegistration) via IrcClient.create(). This must
            // happen before arming, but connect() itself comes last.
            const ircClient = bncnet.ircClient;

            if (isRegister) {
                const regAccount = this.probeRegInfo.customAccountName ?
                    user :
                    '*';
                const regEmail = fields.email.trim() || '*';
                bncnet.armPreConnectRegistration(
                    regAccount,
                    regEmail,
                    registrationPassword
                );
                fields.password = '';
            }

            ircClient.connect();
        },
        submitRegisterCode() {
            const code = this.registerCode.trim();
            if (!this.network || !code) {
                return;
            }
            this.network.verifyAccount(code);
            this.registerCode = '';
        },
        cancelRegistration() {
            if (this.network) {
                this.network.cancelPreConnectRegistration();
            }
            this.registerCode = '';
            this.loading = false;
        },
    },
};
</script>
