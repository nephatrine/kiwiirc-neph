<template>
    <startup-layout
        ref="layout"
        :remember-settings="remember_settings"
        :remember-passwords="remember_settings && remember_password"
        class="kiwi-welcome-simple"
    >
        <template v-if="startupOptions.altComponent" #connection>
            <component :is="startupOptions.altComponent" @close="onAltClose" />
        </template>
        <template v-else #connection>
            <form class="u-form u-form--big kiwi-welcome-simple-form" @submit.prevent="formSubmit">
                <h2>
                    <img v-if="serverIcon" :src="serverIcon" class="kiwi-welcome-server-icon" alt="">
                    <span v-html="greetingText" />
                </h2>
                <div
                    v-if="network && (connectErrors.length > 0 || network.state_error)"
                    class="kiwi-welcome-simple-error"
                >
                    <template v-if="connectErrors.length > 0">
                        <span v-for="err in connectErrors" :key="err">{{ err }}</span>
                    </template>
                    <template v-else>
                        <span>{{ $t('network_noconnect') }}</span>
                        <span>{{ readableStateError(network.state_error) }}</span>
                    </template>
                </div>

                <div v-if="useTabs" class="kiwi-welcome-tabs">
                    <button
                        v-if="showAnonymousTab"
                        type="button"
                        :class="{ 'kiwi-welcome-tab--active': activeTab === 'anonymous' }"
                        class="kiwi-welcome-tab"
                        @click="activeTab = 'anonymous'"
                    >
                        {{ $t('anonymous_tab') }}
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

                <template v-if="useTabs">
                    <template v-if="activeTab === 'anonymous' && showAnonymousTab">
                        <div v-if="showAccountTab" class="kiwi-welcome-anonymous-warning">
                            {{ $t('anonymous_warning') }}
                        </div>
                        <input-text
                            ref="anonymousTabNick"
                            v-model="nick"
                            v-focus="!isIframe && !nick"
                            :label="$t('nick')"
                            type="text"
                            :class="{ 'kiwi-welcome-invalid-nick': !isNickValid }"
                        />
                    </template>
                    <template v-else-if="activeTab === 'account' && showAccountTab">
                        <div class="kiwi-welcome-simple-input-container">
                            <input-text
                                ref="accountTabAccount"
                                v-model="account"
                                v-focus="!isIframe && !account"
                                :label="$t('account')"
                                type="text"
                                autocomplete="username"
                            />
                            <input-text
                                v-model="password"
                                v-focus="!isIframe && !!account && !password"
                                :show-plain-text="true"
                                :label="$t('password')"
                                type="password"
                                autocomplete="current-password"
                            />
                        </div>
                    </template>
                    <template v-else-if="activeTab === 'register' && showRegisterTab">
                        <div class="kiwi-welcome-simple-input-container">
                            <input-text
                                ref="registerTabAccount"
                                v-model="registerAccount"
                                :label="$t('account')"
                                type="text"
                                autocomplete="username"
                                :class="{
                                    'kiwi-welcome-invalid-nick':
                                        !(probeRegInfo && probeRegInfo.customAccountName)
                                        && !!registerAccount.trim() && !isNickValid,
                                }"
                            />
                            <input-text
                                ref="registerTabPassword"
                                v-model="registerPassword"
                                :show-plain-text="true"
                                :label="$t('register_account_password')"
                                type="password"
                                autocomplete="new-password"
                            />
                            <input-text
                                v-model="registerEmail"
                                :label="$t(probeRegInfo && probeRegInfo.emailRequired
                                    ? 'register_account_email_required'
                                    : 'register_account_email_optional')"
                                type="email"
                                autocomplete="email"
                            />
                            <div v-if="registerPasswordHint" class="kiwi-welcome-register-hint">
                                {{ registerPasswordHint }}
                            </div>
                        </div>
                    </template>
                </template>
                <template v-else>
                    <input-text
                        v-model="nick"
                        v-focus="!isIframe && (!nick || !show_password_box)"
                        :label="$t('nick')"
                        :autocomplete="nickIsLoginUsername ? 'username' : undefined"
                        type="text"
                        :class="{ 'kiwi-welcome-invalid-nick': !isNickValid }"
                    />

                    <template v-if="activeTab === 'register' && showRegisterTab">
                        <div class="kiwi-welcome-simple-input-container">
                            <input-text
                                v-if="probeRegInfo && probeRegInfo.customAccountName"
                                v-model="registerAccount"
                                :label="$t('register_account_name')"
                                :placeholder="nick"
                                :autocomplete="nickIsLoginUsername ? undefined : 'username'"
                                type="text"
                            />
                            <input-text
                                v-model="registerEmail"
                                :label="$t(probeRegInfo && probeRegInfo.emailRequired
                                    ? 'register_account_email_required'
                                    : 'register_account_email_optional')"
                                type="email"
                                autocomplete="email"
                            />
                            <input-text
                                v-model="registerPassword"
                                :show-plain-text="true"
                                :label="$t('register_account_password')"
                                type="password"
                                autocomplete="new-password"
                            />
                            <div v-if="registerPasswordHint" class="kiwi-welcome-register-hint">
                                {{ registerPasswordHint }}
                            </div>
                        </div>
                    </template>

                    <template v-else>
                        <div v-if="showPass && toggablePass" class="kiwi-welcome-simple-input-container">
                            <label
                                class="kiwi-welcome-simple-have-password"
                            >
                                <input v-model="show_password_box" type="checkbox">
                                <span> {{ $t('password_have') }} </span>
                            </label>
                        </div>

                        <div
                            v-if="showPass && (show_password_box || !toggablePass)"
                            class="kiwi-welcome-simple-input-container"
                        >
                            <input-text
                                v-model="account"
                                :label="$t('account_name')"
                                :placeholder="nick"
                                :autocomplete="nickIsLoginUsername ? undefined : 'username'"
                                type="text"
                            />
                            <input-text
                                v-model="password"
                                v-focus="(!isIframe && nick) || show_password_box"
                                :show-plain-text="true"
                                :label="$t('password')"
                                type="password"
                                autocomplete="current-password"
                            />
                        </div>
                    </template>
                </template>

                <div class="kiwi-welcome-simple-input-container">
                    <label>
                        <input v-model="remember_settings" type="checkbox">
                        <span> {{ $t('remember_settings') }} </span>
                    </label>
                </div>

                <template v-if="useTabs">
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
                            v-model="accountNick"
                            :label="$t('nick')"
                            :placeholder="accountNickSuggestion"
                            type="text"
                            :class="{ 'kiwi-welcome-invalid-nick': !isNickValid }"
                            @input="accountNickTouched = true"
                        />
                        <input-text
                            v-if="activeTab === 'register' && showRegisterTab
                                && probeRegInfo && probeRegInfo.customAccountName"
                            v-model="registerNick"
                            :label="$t('nick')"
                            type="text"
                            :class="{ 'kiwi-welcome-invalid-nick': !isNickValid }"
                        />
                        <input-text
                            v-if="showChannel"
                            v-model="channel"
                            :label="$t('channel')"
                        />
                        <div class="kiwi-welcome-advanced-row">
                            <label>
                                <input
                                    v-model="remember_password"
                                    :disabled="rememberPasswordDisabled"
                                    type="checkbox"
                                >
                                <span> {{ $t('remember_password') }} </span>
                            </label>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div
                        v-if="showChannel"
                        class="kiwi-welcome-simple-input-container"
                    >
                        <input-text
                            v-model="channel"
                            :label="$t('channel')"
                        />
                    </div>

                    <div class="kiwi-welcome-simple-input-container">
                        <label>
                            <input
                                v-model="remember_password"
                                :disabled="rememberPasswordDisabled"
                                type="checkbox"
                            >
                            <span> {{ $t('remember_password') }} </span>
                        </label>
                    </div>
                </template>

                <div v-if="termsContent" class="kiwi-welcome-simple-terms">
                    <div>
                        <input v-model="termsAccepted" type="checkbox">
                    </div>
                    <div class="kiwi-welcome-simple-terms-content" v-html="termsContent" />
                </div>

                <captcha
                    :network="network"
                />

                <button
                    v-if="!network || network.state === 'disconnected'"
                    :disabled="!formReady"
                    class="u-button u-button-primary u-submit kiwi-welcome-simple-start"
                    type="submit"
                    v-html="buttonText"
                />
                <template v-else-if="network.registration.awaitingVerify">
                    <p>{{ $t('register_verify_prompt') }}</p>
                    <div class="kiwi-welcome-simple-input-container">
                        <input-text
                            v-model="registerCode"
                            :label="$t('register_verify_code')"
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
                    type="button"
                    class="u-button u-button-primary u-submit kiwi-welcome-simple-start"
                    disabled
                >
                    <i class="fa fa-spin fa-spinner" aria-hidden="true" />
                </button>

                <div v-html="footerText" />
            </form>
        </template>
    </startup-layout>
</template>

<script>
'kiwi public';

import _ from 'lodash';
import * as Misc from '@/helpers/Misc';
import Logger from '@/libs/Logger';
import BouncerProvider from '@/libs/BouncerProvider';
import { probeServerCaps, createProbeTransport } from '@/libs/ServerProbe';
import { parseAccountRegistrationCap } from '@/libs/accountRegistration';
import Captcha from '@/components/Captcha';
import StartupLayout from './CommonLayout';

let log = Logger.namespace('Welcome.vue');

export default {
    components: {
        Captcha,
        StartupLayout,
    },
    data() {
        return {
            connectErrors: [],
            network: null,
            channel: '',
            nick: '',
            account: '',
            password: '',
            showChannel: true,
            showPass: true,
            toggablePass: true,
            showNick: true,
            show_password_box: false,
            connectWithoutChannel: false,
            serverInfo: null,
            showPlainText: false,
            captchaReady: false,
            termsAccepted: false,
            remember_settings: true,
            remember_password: false,
            activeTab: 'account',
            accountNickTouched: false,
            suspendAccountAutofill: false,
            showAdvanced: false,
            accountNick: '',
            registerNick: '',
            registerAccount: '',
            registerEmail: '',
            registerPassword: '',
            registerCode: '',
        };
    },
    computed: {
        isIframe() {
            return !(window === window.parent || window.opener);
        },
        startupOptions() {
            return this.$state.settings.startupOptions;
        },
        // Bouncer mode keeps the legacy single login form; the tabbed
        // Anonymous / Account / Register flow is standard mode only.
        useTabs() {
            return !this.$state.settings.startupOptions.bouncer;
        },
        greetingText() {
            let greeting = this.$state.settings.startupOptions.greetingText;
            if (typeof greeting === 'string') {
                return greeting;
            }
            if (this.serverInfo && this.serverInfo.isupport.NETWORK) {
                return this.$t('welcome_to_network', {
                    network: _.escape(this.serverInfo.isupport.NETWORK),
                });
            }
            return this.$t('start_greeting');
        },
        footerText() {
            let footer = this.$state.settings.startupOptions.footerText;
            return typeof footer === 'string' ?
                footer :
                '';
        },
        termsContent() {
            let terms = this.$state.settings.startupOptions.termsContent;
            return typeof terms === 'string' ?
                terms :
                '';
        },
        buttonText() {
            let greeting = this.$state.settings.startupOptions.buttonText;
            if (typeof greeting === 'string') {
                return greeting;
            }
            return this.activeTab === 'register' && this.showRegisterTab ?
                this.$t('register_submit') :
                this.$t('start_button');
        },
        // Raw probe results, null until a probe has answered. Tab
        // availability treats "no probe" as "not proven", so both
        // Anonymous and Account stay visible until the probe says otherwise.
        probeCaps() {
            return (this.serverInfo && this.serverInfo.caps) || null;
        },
        probeIsupport() {
            return (this.serverInfo && this.serverInfo.isupport) || null;
        },
        // Account tab: shown unless the probe affirmatively returned caps
        // without sasl. If it is the only remaining pathway (Anonymous
        // forbidden, no registration), it shows anyway as a last resort.
        accountOffered() {
            return !this.probeCaps || !!this.probeCaps.sasl;
        },
        showAccountTab() {
            return this.accountOffered ||
                (!this.anonymousAllowed && !this.showRegisterTab);
        },
        // Anonymous tab: shown unless the probe affirmatively saw
        // DRAFT/ACCOUNTREQUIRED in the ISUPPORT tokens.
        anonymousAllowed() {
            return !this.probeIsupport ||
                this.probeIsupport['DRAFT/ACCOUNTREQUIRED'] === undefined;
        },
        showAnonymousTab() {
            return this.anonymousAllowed;
        },
        // Registration is only offered when a probe found
        // draft/account-registration with before-connect enabled
        probeRegInfo() {
            const caps = (this.serverInfo && this.serverInfo.caps) || {};
            const value = caps['draft/account-registration'];
            if (typeof value === 'undefined') {
                return null;
            }
            const info = parseAccountRegistrationCap(value);
            return info.beforeConnect ?
                info :
                null;
        },
        // True when the probe proved account names default to the nick, so the
        // legacy (bouncer) nickname field carries the username autofill
        // token. The tabbed Account and Register forms always put the token
        // on their account fields instead, so the two never duplicate it.
        nickIsLoginUsername() {
            const caps = (this.serverInfo && this.serverInfo.caps) || {};
            const value = caps['draft/account-registration'];
            if (typeof value === 'undefined') {
                return false;
            }
            return !parseAccountRegistrationCap(value).customAccountName;
        },
        showRegisterTab() {
            return !!this.probeRegInfo && !this.$state.settings.startupOptions.bouncer;
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
        // The nick the Account tab will use when its nick field is left
        // empty: the account name with any trailing @suffix stripped.
        // Shown as the field placeholder and accepted by validation, so a
        // configured default nick (or none at all) never forces the user
        // to type a nick by hand.
        accountNickSuggestion() {
            return this.stripAccountSuffix((this.account || '').trim());
        },
        // Nick actually validated and connected with. Each tab owns its
        // identity: the Account tab uses its nick override, falling back
        // to the account-derived suggestion; the Register tab uses the
        // account field verbatim (the account IS the nick unless
        // custom-account-name is set, when its own nick override wins);
        // Anonymous and legacy mode use the nick field verbatim.
        effectiveNick() {
            if (this.useTabs && this.activeTab === 'account' && this.showAccountTab) {
                return this.accountNick || this.accountNickSuggestion;
            }
            if (this.useTabs && this.activeTab === 'register' && this.showRegisterTab) {
                return this.registerModeNick();
            }
            return this.nick;
        },
        channelReady() {
            if (this.connectWithoutChannel || this.channel) {
                if (this.connectWithoutChannel) {
                    return true;
                }
                // Make sure the channel name starts with a common channel prefix
                let valid = true;
                let bufferObjs = Misc.extractBuffers(this.channel);
                bufferObjs.forEach((bufferObj) => {
                    if ('#&'.indexOf(bufferObj.name[0]) === -1) {
                        valid = false;
                    }
                });
                return valid;
            }
            return false;
        },
        serverIcon() {
            if (!this.serverInfo) {
                return '';
            }
            const tokens = this.serverInfo.isupport || {};
            const key = Object.keys(tokens).find((name) => (
                name === 'ICON' || name.endsWith('/ICON')
            ));
            return key ?
                Misc.sanitizeUrl(tokens[key]) :
                '';
        },
        isNickValid() {
            let nickPatternStr = this.$state.setting('startupOptions.nick_format');
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
                    pattern = _.escapeRegExp(nickPatternStr);
                    flags = 'i';
                }

                try {
                    nickPattern = new RegExp(pattern, flags);
                } catch (error) {
                    log.error('Nick format error: ' + error.message);
                    return false;
                }
            }

            return (this.effectiveNick || '').match(nickPattern);
        },
        readyToStart() {
            let ready = !!this.nick;

            if (!this.channelReady) {
                ready = false;
            }

            // If toggling the password is is disabled, assume it is required
            if (!this.toggablePass && !this.password) {
                ready = false;
            }

            if (!this.isNickValid) {
                ready = false;
            }

            if (this.termsContent && !this.termsAccepted) {
                ready = false;
            }

            return ready;
        },
        readyAnonymous() {
            return !!this.nick && this.channelReady && !!this.isNickValid &&
                (!this.termsContent || this.termsAccepted);
        },
        readyAccount() {
            return !!this.effectiveNick && !!this.account.trim() && !!this.password &&
                this.channelReady && !!this.isNickValid &&
                (!this.termsContent || this.termsAccepted);
        },
        readyToRegister() {
            const info = this.probeRegInfo;
            if (!info) {
                return false;
            }

            // The account field is always required: it is the login the
            // server creates. The nick field is optional: when empty (or
            // hidden under Advanced / without custom-account-name) the
            // account name is used as the nick via effectiveNick.
            let ready = !!this.registerAccount.trim() && !!this.registerPassword;

            if (!this.channelReady) {
                ready = false;
            }

            if (info.emailRequired && !this.registerEmail.trim()) {
                ready = false;
            }

            const length = new TextEncoder().encode(this.registerPassword).length;
            if (info.minPasswordLength && length < info.minPasswordLength) {
                ready = false;
            }
            if (info.maxPasswordLength && length > info.maxPasswordLength) {
                ready = false;
            }

            if (!this.isNickValid) {
                ready = false;
            }

            if (this.termsContent && !this.termsAccepted) {
                ready = false;
            }

            return ready;
        },
        formReady() {
            if (!this.useTabs) {
                return this.readyToStart;
            }
            if (this.activeTab === 'register' && this.showRegisterTab) {
                return this.readyToRegister;
            }
            if (this.activeTab === 'account' && this.showAccountTab) {
                return this.readyAccount;
            }
            return this.readyAnonymous;
        },
        // Remember Password needs Remember Me plus a password actually in
        // play. In tabbed mode that means the Account and Register tabs,
        // whose password fields are always shown; the Anonymous tab has no
        // password. Legacy (bouncer) mode keeps the old rule: a forced
        // (untoggable) account block counts as in play.
        rememberPasswordDisabled() {
            if (!this.remember_settings) {
                return true;
            }
            if (!this.useTabs) {
                return !this.showPass ||
                    (this.toggablePass && !this.show_password_box);
            }
            return this.activeTab !== 'account' && this.activeTab !== 'register';
        },
    },
    watch: {
        show_password_box(newVal) {
            if (newVal === false) {
                // clear the password when show password is unchecked
                this.password = '';
            }
        },
        rememberPasswordDisabled(disabled) {
            if (disabled) {
                this.remember_password = false;
            }
        },
        // Default the Account tab's nick override from the account name
        // until the user takes over that field themselves. Only fills an
        // empty override so a typed value is never clobbered. The override
        // lives on its own field, so other tabs are never affected.
        account(newVal) {
            // The restore in created() assigns the remembered account
            // before the user can type anything: skip that first run so
            // the nick override starts empty (placeholder shows the
            // default) instead of echoing the restored account.
            if (this.suspendAccountAutofill) {
                this.suspendAccountAutofill = false;
                return;
            }
            if (this.accountNickTouched || this.accountNick) {
                return;
            }
            const stripped = this.stripAccountSuffix((newVal || '').trim());
            if (stripped) {
                this.accountNick = stripped;
            }
        },
        showAccountTab() {
            this.ensureValidTab();
        },
        showAnonymousTab() {
            this.ensureValidTab();
        },
        showRegisterTab() {
            this.ensureValidTab();
        },
        // Keyboard focus follows the tab: the Account input on the Account
        // and Register tabs, the Nick input on the Anonymous tab. v-focus
        // only fires for freshly-inserted empty fields, so without this a
        // tab with remembered values would land focus nowhere.
        activeTab() {
            this.focusActiveTab();
        },
    },
    created() {
        let options = this.startupOptions;
        let connectOptions = this.connectOptions();

        // Take some settings from a previous network if available
        let previousNet = null;
        if (connectOptions.hostname.trim()) {
            previousNet = this.$state.getNetworkFromAddress(connectOptions.hostname.trim());
        }

        let restoreNick = '';
        let restoreAccount = '';
        if (previousNet && previousNet.connection.nick) {
            restoreNick = previousNet.connection.nick;
            restoreAccount = previousNet.connection.account || '';
        } else if (Misc.queryStringVal('nick')) {
            restoreNick = Misc.queryStringVal('nick');
            restoreAccount = Misc.queryStringVal('account') || '';
        } else {
            restoreNick = options.nick;
            restoreAccount = options.account || '';
        }

        if (restoreAccount) {
            // Account user: pre-fill the Account tab only. The other tabs
            // keep their defaults: Anonymous gets the configured default
            // nick (an account nick cannot be reused anonymously) and
            // Register starts blank for the new account.
            this.account = restoreAccount;
            this.suspendAccountAutofill = true;
            this.nick = this.processNickRandomNumber(options.nick || '');
        } else {
            // Anonymous user: pre-fill the Anonymous tab only, plus a
            // one-time copy of the nick into the Register account field
            // (reserving your nick as an account is the common flow).
            // The Account tab stays blank.
            this.nick = this.processNickRandomNumber(restoreNick || '');
            this.account = '';
            if (this.nick) {
                this.registerAccount = this.nick;
            }
        }

        if (options.password) {
            this.password = options.password;
        } else if (previousNet && previousNet.password) {
            this.password = previousNet.password;
            this.show_password_box = true;
        } else {
            this.password = '';
        }

        let previousChannels = '';
        if (previousNet) {
            previousChannels = previousNet.buffers
                .filter((b) => b.isChannel())
                .map((b) => b.name)
                .join(',');
        }

        this.channel = decodeURIComponent(window.location.hash) || previousChannels || options.channel || '';
        this.showChannel = typeof options.showChannel === 'boolean' ?
            options.showChannel :
            true;
        this.showNick = typeof options.showNick === 'boolean' ?
            options.showNick :
            true;
        this.showPass = typeof options.showPassword === 'boolean' ?
            options.showPassword :
            true;
        this.toggablePass = typeof options.toggablePassword === 'boolean' ?
            options.toggablePassword :
            true;

        // Restore the password-memory preference, clamped to the same rule
        // as the checkbox: meaningless without Remember Me or a password
        // field, so never restored checked in those states.
        this.remember_password = !!this.$state.user_settings.remember_password;
        if (this.rememberPasswordDisabled) {
            this.remember_password = false;
        }

        this.connectWithoutChannel = !!options.allowNoChannel;

        let wasLogout = window.sessionStorage.getItem('kiwi-logout');
        if (wasLogout) {
            window.sessionStorage.removeItem('kiwi-logout');
        }

        if (options.bouncer) {
            this.toggablePass = false;
            this.showPass = true;
            this.showChannel = false;
            this.connectWithoutChannel = true;

            let bouncer = new BouncerProvider(this.$state);
            bouncer.enable(
                connectOptions.hostname,
                connectOptions.port,
                connectOptions.tls,
                connectOptions.direct,
                connectOptions.direct_path
            );
        }

        const autoReady = this.useTabs ? this.formReady : this.readyToStart;
        if (!wasLogout && options.autoConnect && autoReady) {
            this.startUp(this.useTabs ? this.activeTab : 'login');
        }

        this.maybeProbeServer(connectOptions, options);
    },
    mounted() {
        this.focusActiveTab();
    },
    methods: {
        // Put keyboard focus on the tab's leading field whenever the user
        // switches tabs (or on first paint). v-focus only fires for
        // freshly-inserted empty fields, so a tab with remembered values
        // would otherwise land focus nowhere, and the Register account
        // field carries no v-focus at all.
        focusActiveTab() {
            if (this.isIframe || !this.useTabs) {
                return;
            }
            this.$nextTick(() => {
                let target = null;
                if (this.activeTab === 'account' && this.showAccountTab) {
                    target = this.$refs.accountTabAccount;
                } else if (this.activeTab === 'register' && this.showRegisterTab) {
                    target = this.$refs.registerTabAccount ||
                        this.$refs.registerTabPassword;
                } else if (this.activeTab === 'anonymous' && this.showAnonymousTab) {
                    target = this.$refs.anonymousTabNick;
                }
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            });
        },
        // Nick for a Register-tab connect, from that tab's own fields.
        // An empty account field falls back to the Anonymous nick so a
        // connect attempt never goes out with a blank NICK (the submit
        // button stays disabled until the account is filled anyway).
        registerModeNick() {
            const custom = !!(this.probeRegInfo && this.probeRegInfo.customAccountName);
            if (!custom) {
                return (this.registerAccount || '').trim() || this.nick;
            }
            return this.registerNick || (this.registerAccount || '').trim() || this.nick;
        },
        // An account name doubles as a nick suggestion: strip a trailing
        // `@suffix` (eg. ankle@phone becomes ankle) for the nickname default.
        stripAccountSuffix(name) {
            const idx = (name || '').indexOf('@');
            return idx === -1 ?
                name :
                name.substr(0, idx);
        },
        // Keep the active tab on one the server actually offers. Account
        // first, then Anonymous; Register is never auto-picked.
        ensureValidTab() {
            if (!this.useTabs) {
                return;
            }
            const available = [];
            if (this.showAccountTab) {
                available.push('account');
            }
            if (this.showAnonymousTab) {
                available.push('anonymous');
            }
            if (this.showRegisterTab) {
                available.push('register');
            }
            if (available.length > 0 && !available.includes(this.activeTab)) {
                this.activeTab = available[0];
            }
        },
        // Ask the IRC server what it supports before the user logs in, so
        // the form can match reality (hide SASL fields, require accounts).
        // Strictly additive: any failure leaves the configured defaults.
        maybeProbeServer(connectOptions, options) {
            if (options.probeServerCaps !== true || options.bouncer) {
                return;
            }
            if (!connectOptions.hostname) {
                return;
            }
            if (options.autoConnect && (this.useTabs ? this.formReady : this.readyToStart)) {
                return;
            }
            probeServerCaps({
                createTransport: () => createProbeTransport({
                    direct: connectOptions.direct,
                    kiwiServer: this.$state.settings.kiwiServer,
                    sessionId: (window.location.hash || '').substr(1),
                    host: connectOptions.hostname,
                    port: connectOptions.port,
                    tls: connectOptions.tls,
                    path: connectOptions.direct_path,
                }),
                transportOptions: {
                    direct: connectOptions.direct,
                    host: connectOptions.hostname,
                    port: connectOptions.port,
                },
            }).then((info) => {
                this.applyServerInfo(info);
            });
        },
        applyServerInfo(info) {
            if (!info) {
                return;
            }
            this.serverInfo = info;
            // Tab availability derives from the probe results directly; if
            // the probe hid the current tab, move to one that is offered.
            this.ensureValidTab();
        },
        onAltClose(event) {
            if (event.channel) {
                this.channel = event.channel;
            }
            if (event.nick) {
                this.nick = event.nick;
            }
            if (event.password) {
                this.password = event.password;
            }
            if (event.error) {
                this.connectErrors.push(event.error);
            }

            this.$state.settings.startupOptions.altComponent = null;
        },
        readableStateError(err) {
            return Misc.networkErrorMessage(err);
        },
        formSubmit() {
            if (this.formReady) {
                this.startUp(this.useTabs ? this.activeTab : 'login');
            }
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
        },
        startUp(mode) {
            this.connectErrors = [];

            let options = Object.assign({}, this.$state.settings.startupOptions);
            let connectOptions = this.connectOptions();
            let netAddress = _.trim(connectOptions.hostname);

            // Check if we have this network already
            let net = this.network || this.$state.getNetworkFromAddress(netAddress);

            // Register mode never logs in with SASL: the password below is the
            // new account password and is armed for the pre-connect REGISTER
            // instead of being stored as the SASL secret. Anonymous mode
            // likewise carries no account identity at all.
            let isRegister = mode === 'register' && !!this.probeRegInfo;
            let isAnonymous = mode === 'anonymous';
            let password = (isRegister || isAnonymous) ?
                '' :
                this.password;
            let loginAccount = (isRegister || isAnonymous) ?
                '' :
                this.account;

            // Each tab owns its identity: connect with that tab's nick so
            // nothing leaks between tabs (an account nick must never go
            // out on an anonymous connect, nor a stale nick on REGISTER).
            let modeNick = this.nick;
            if (mode === 'account') {
                modeNick = this.accountNick || this.accountNickSuggestion;
            } else if (isRegister) {
                modeNick = this.registerModeNick();
            }

            let identityChanged = net && (
                net.connection.nick !== modeNick ||
                net.connection.account !== loginAccount
            );
            if (identityChanged) {
                // Identity changed, purge previous session buffers and messages
                while (net.buffers.length > 0) {
                    this.$state.removeBuffer(net.buffers[0]);
                }
                this.$state.addBuffer(net.id, '*').joined = true;
            }

            // If the network doesn't already exist, add a new one
            net = net || this.$state.addNetwork('Network', modeNick, {
                server: netAddress,
                port: connectOptions.port,
                tls: connectOptions.tls,
                password: password,
                account: loginAccount,
                encoding: _.trim(options.encoding),
                direct: connectOptions.direct,
                path: connectOptions.direct_path || '',
                gecos: options.gecos,
                username: options.username,
            });

            // Clear the server buffer in case it already existed and contains messages relating to
            // the previous connection, such as errors. They are now redundant since this is a
            // new connection.
            net.serverBuffer().clearMessages();

            // If we retreived an existing network, update the nick+password with what
            // the user has just put in place
            net.connection.nick = modeNick;
            net.connection.account = loginAccount;
            if (options.bouncer) {
                // Bouncer mode uses server PASS
                net.connection.password = `${modeNick}:${password}`;
                net.password = '';
            } else {
                net.connection.password = '';
                net.password = password;
            }

            if (_.trim(options.encoding || '')) {
                net.connection.encoding = _.trim(options.encoding);
            }

            this.network = net;

            // Only switch to the first channel we join if multiple are being joined
            let hasSwitchedActiveBuffer = false;
            let bufferObjs = Misc.extractBuffers(this.channel);
            bufferObjs.forEach((bufferObj) => {
                let newBuffer = this.$state.addBuffer(net.id, bufferObj.name);
                newBuffer.enabled = true;

                if (newBuffer && !hasSwitchedActiveBuffer) {
                    this.$state.setActiveBuffer(net.id, newBuffer.name);
                    hasSwitchedActiveBuffer = true;
                }

                if (bufferObj.key) {
                    newBuffer.key = bufferObj.key;
                }
            });

            // switch to server buffer if no channels are joined
            if (!options.bouncer && !hasSwitchedActiveBuffer) {
                this.$state.setActiveBuffer(net.id, net.serverBuffer().name);
            }

            // Accessing ircClient installs the middleware methods (including
            // armPreConnectRegistration) via IrcClient.create(). This must
            // happen before arming, but connect() itself comes last.
            const ircClient = net.ircClient;

            if (isRegister) {
                // Arm the pre-connect REGISTER before the framework starts
                // negotiating. The password never touches the network state.
                const regInfo = this.probeRegInfo;
                const regAccount = regInfo.customAccountName ?
                    this.registerAccount.trim() :
                    '*';
                const regEmail = this.registerEmail.trim() || '*';
                net.armPreConnectRegistration(regAccount, regEmail, this.registerPassword);
                this.registerPassword = '';
            }

            ircClient.connect();
            let onRegistered = () => {
                // Persist the password-memory preference alongside everything
                // else; it only takes effect on disk when Remember Me starts
                // the watcher in layout.close().
                this.$state.user_settings.remember_password = this.remember_settings &&
                    this.remember_password;
                if (this.$refs.layout) {
                    this.$refs.layout.close();
                }
                net.ircClient.off('registered', onRegistered);
                net.ircClient.off('close', onClosed);
                net.ircClient.off('irc error', onError);
            };
            let onClosed = () => {
                let lastError = this.network.last_error;
                if (lastError && !this.connectErrors.includes(lastError)) {
                    this.connectErrors.push(lastError);
                }
                net.ircClient.off('registered', onRegistered);
                net.ircClient.off('close', onClosed);
                net.ircClient.off('irc error', onError);
            };
            let onError = (event) => {
                if (!event.reason || this.connectErrors.includes(event.reason)) {
                    return;
                }
                this.connectErrors.push(event.reason);
            };
            net.ircClient.once('registered', onRegistered);
            net.ircClient.once('close', onClosed);
            net.ircClient.on('irc error', onError);
        },
        processNickRandomNumber(nick) {
            // Replace ? with a random number
            let tmp = (nick || '').replace(/\?/g, () => Math.floor(Math.random() * 100).toString());
            return _.trim(tmp);
        },
        handleCaptcha(isReady) {
            this.captchaReady = isReady;
        },
        connectOptions() {
            let options = Object.assign({}, this.$state.settings.startupOptions);
            let connectOptions = Misc.connectionInfoFromConfig(options);

            // If a server isn't specified in the config, set some defaults
            // The webircgateway will have a default network set and will connect
            // there instead. This just removes the requirement of specifying the same
            // irc network address in both the server-side and client side configs
            connectOptions.hostname = connectOptions.hostname || 'default';
            if (!connectOptions.port && connectOptions.direct) {
                connectOptions.port = connectOptions.tls ?
                    443 :
                    80;
            } else if (!connectOptions.port && !connectOptions.direct) {
                connectOptions.port = connectOptions.tls ?
                    6697 :
                    6667;
            }

            return connectOptions;
        },
    },
};
</script>

<style>

/* Containers */
form.kiwi-welcome-simple-form {
    width: 70%;
    padding: 20px;
}

.kiwi-welcome-server-icon {
    height: 1.2em;
    vertical-align: -0.2em;
    margin-right: 0.3em;
}

@media (width <= 1025px) {
    form.kiwi-welcome-simple-form {
        width: 100%;
    }
}

@media (width <= 850px) {
    form.kiwi-welcome-simple-form {
        background: var(--brand-default-bg);
        border-radius: 5px;
        box-shadow: 0 2px 10px 0 rgb(0, 0, 0, 0.2);
    }
}

@media (width <= 600px) {
    form.kiwi-welcome-simple-form {
        max-width: 350px;
    }
}

form.kiwi-welcome-simple-form h2 {
    margin: 0 0 40px 0;
    padding: 0;
    cursor: default;
    font-weight: 600;
    font-size: 2.2em;
    text-align: center;
    line-height: 1.2em;
}

.kiwi-welcome-simple-error {
    text-align: center;
    margin: 1em 0;
    padding: 1em;
}

.kiwi-welcome-simple-error span {
    display: block;
    font-style: italic;
    margin-bottom: 8px;
}

.kiwi-welcome-simple-error span:last-of-type {
    margin-bottom: 0;
}

.kiwi-welcome-simple-input-container {
    width: 100%;
    height: auto;
    position: relative;
    margin: 0 0 20px 0;
}

.kiwi-welcome-simple-input-container:last-of-type {
    margin: 20px 0 40px 0;
}

.kiwi-welcome-simple-terms {
    display: flex;
    flex-direction: row;
}

.kiwi-welcome-simple-terms .kiwi-welcome-simple-terms-content {
    margin-top: 3px;
    line-height: 20px;
}

.kiwi-welcome-simple-form .u-submit {
    width: 100%;
    height: 50px;
    font-size: 1.3em;
}

.kiwi-welcome-simple-start {
    font-size: 1.1em;
    cursor: pointer;
}

.kiwi-welcome-simple-start[disabled] {
    cursor: not-allowed;
    opacity: 0.65;
}

.kiwi-welcome-tabs {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 20px;
}

.kiwi-welcome-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 1.1em;
    padding: 6px 16px;
    color: inherit;
    opacity: 0.65;
}

.kiwi-welcome-tab--active {
    border-bottom-color: var(--brand-primary);
    opacity: 1;
}

.kiwi-welcome-register-hint {
    font-size: 0.9em;
    font-style: italic;
    margin-top: 4px;
}

.kiwi-welcome-anonymous-warning {
    font-size: 0.9em;
    font-style: italic;
    margin-bottom: 12px;
}

.kiwi-welcome-register-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.kiwi-welcome-advanced-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 0.95em;
    opacity: 0.75;
    padding: 4px 0;
}

.kiwi-welcome-advanced-box {
    border: 1px solid var(--brand-primary);
    border-radius: 5px;
    padding: 16px 16px 0 16px;
    margin: 0 0 20px 0;
}

.kiwi-welcome-advanced-box .kiwi-welcome-advanced-row {
    margin: 0 0 16px 0;
}

</style>
