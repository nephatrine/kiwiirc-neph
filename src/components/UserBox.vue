<template>
    <div class="kiwi-userbox">
        <span v-if="isSelf" class="kiwi-userbox-selfprofile">
            {{ $t('user_you') }}
        </span>
        <div class="kiwi-userbox-header">
            <div class="kiwi-userbox-avatar">
                <UserAvatar
                    :user="user"
                    :network="network"
                    size="large"
                />
            </div>
            <div class="kiwi-userbox-userinfo">
                <span
                    class="kiwi-userbox-nick"
                    :style="{ color: user.getColour() }"
                >{{ user.metadata['display-name'] || user.nick }}</span>
                <span v-if="user.metadata.pronouns" class="kiwi-userbox-pronouns">({{ user.metadata.pronouns }})</span>
                <span v-if="userMode" class="kiwi-userbox-modestring">+{{ userMode }}</span>
                <span
                    v-if="user.metadata['display-name'] && user.metadata['display-name'] !== user.nick"
                    class="kiwi-userbox-truenick"
                >{{ user.nick }} (irc)</span>
                <span v-if="realname" class="kiwi-userbox-realname" v-html="formattedRealname" />
                <span v-if="user.username || user.host" class="kiwi-userbox-usermask">{{ user.username }}@{{ user.host }}</span>
                <span v-if="user.is_bot" :title="$t('bot')" class="kiwi-userbox-bot">🤖</span>
            </div>
        </div>

        <div v-if="user.relayed_by" class="kiwi-userbox-relayedby">
            <span>{{ $t('user_relayed_by') }}</span>
            <a class="kiwi-userbox-relayedby-bot u-link" @click="openRelayerBox">{{ user.relayed_by }}</a>
        </div>

        <template v-if="pluginUiInfoElements.length">
            <component
                :is="plugin.component"
                v-for="plugin in pluginUiInfoElements"
                :key="plugin.id"
                :plugin-props="{
                    user,
                    userbox: self,
                }"
                v-bind="plugin.props"
                :network="network"
                :buffer="buffer"
                :user="user"
                :sidebar-state="sidebarState"
            />
        </template>

        <div class="kiwi-userbox-basicinfo">
            <div v-if="user.statusMessage()" class="kiwi-userbox-status">
                <strong>{{ $t('status') }}:</strong> {{ user.statusMessage() }}
            </div>
            <div v-if="user.metadata.description && !isEditingProfile" class="kiwi-userbox-description">
                {{ user.metadata.description }}
            </div>
            <div v-if="user.metadata.homepage && !isEditingProfile" class="kiwi-userbox-homepage">
                <i class="fa fa-globe" aria-hidden="true" />
                <a
                    :href="user.metadata.homepage"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="u-link"
                >{{ user.metadata.homepage }}</a>
            </div>

            <div v-if="isSelf && isRegistering" class="kiwi-userbox-register u-form">
                <h3>{{ $t('register_account') }}</h3>
                <div v-if="network.registration.error" class="kiwi-userbox-register-error">
                    {{ network.registration.error }}
                </div>
                <template v-if="network.registration.awaitingVerify">
                    <p>{{ $t('register_verify_prompt') }}</p>
                    <label>
                        <span>{{ $t('register_verify_code') }}</span>
                        <input v-model="registerForm.code" type="text" class="u-input" autocomplete="off">
                    </label>
                    <div class="kiwi-userbox-register-actions">
                        <button
                            type="button"
                            class="u-button u-button-primary"
                            :disabled="!registerForm.code.trim()"
                            @click="submitVerify"
                        >
                            {{ $t('verify_submit') }}
                        </button>
                        <button type="button" class="u-button u-button-secondary" @click="cancelRegistration">
                            {{ $t('cancel') }}
                        </button>
                    </div>
                </template>
                <template v-else>
                    <label v-if="registrationInfo && registrationInfo.customAccountName">
                        <span>{{ $t('register_account_name') }}</span>
                        <input v-model="registerForm.account" type="text" class="u-input" autocomplete="username">
                    </label>
                    <div v-else class="kiwi-userbox-register-as">
                        {{ $t('register_as') }}: {{ network.nick }}
                    </div>
                    <label>
                        <span v-if="registrationInfo && registrationInfo.emailRequired">{{ $t('register_account_email_required') }}</span>
                        <span v-else>{{ $t('register_account_email_optional') }}</span>
                        <input
                            v-model="registerForm.email"
                            type="email"
                            class="u-input"
                            autocomplete="email"
                            :required="registrationInfo && registrationInfo.emailRequired"
                        >
                    </label>
                    <label>
                        <span>{{ $t('register_account_password') }}</span>
                        <input v-model="registerForm.password" type="password" class="u-input" autocomplete="new-password">
                    </label>
                    <div v-if="registerPasswordHint" class="kiwi-userbox-register-hint">
                        {{ registerPasswordHint }}
                    </div>
                    <div class="kiwi-userbox-register-actions">
                        <button
                            type="button"
                            class="u-button u-button-primary"
                            :disabled="!registerValid"
                            @click="submitRegistration"
                        >
                            {{ $t('register_submit') }}
                        </button>
                        <button type="button" class="u-button u-button-secondary" @click="cancelRegistration">
                            {{ $t('cancel') }}
                        </button>
                    </div>
                </template>
            </div>
            <div v-if="showServicesFallbackBlurb" class="kiwi-userbox-services-blurb">
                {{ $t('nickserv_self_blurb') }}
            </div>

            <div v-if="isSelf && isEditingProfile" class="kiwi-userbox-editprofile u-form">
                <h3>{{ $t('public_profile') }}</h3>
                <p class="kiwi-userbox-editprofile-warning">
                    <i class="fa fa-exclamation-triangle" aria-hidden="true" />
                    {{ $t('public_profile_warning') }}
                </p>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.displayName }">
                    <span>{{ $t('display_name') }}</span>
                    <input v-model="editProfile.displayName" type="text" class="u-input">
                    <div v-if="editProfileErrors.displayName" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.displayName),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.pronouns }">
                    <span>{{ $t('pronouns') }}</span>
                    <input v-model="editProfile.pronouns" type="text" class="u-input" placeholder="they/them">
                    <div v-if="editProfileErrors.pronouns" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.pronouns),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.avatar }">
                    <span>{{ $t('avatar_url') }}</span>
                    <div class="kiwi-userbox-editprofile-avatar-wrap">
                        <input v-model="editProfile.avatar" type="text" class="u-input">
                        <button
                            v-if="avatarUploadService"
                            type="button"
                            class="u-button u-button-secondary"
                            :disabled="avatarUploading"
                            :title="$t('fileupload_avatar')"
                            @click="$refs.avatarFile.click()"
                        >
                            <i
                                class="fa"
                                :class="avatarUploading ? 'fa-spinner fa-spin' : 'fa-upload'"
                                aria-hidden="true"
                            />
                        </button>
                        <input
                            ref="avatarFile"
                            type="file"
                            accept="image/*"
                            class="kiwi-userbox-editprofile-avatar-file"
                            @change="onAvatarFile"
                        >
                    </div>
                    <div v-if="editProfileErrors.avatar" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.avatar),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.homepage }">
                    <span>{{ $t('homepage_url') }}</span>
                    <input v-model="editProfile.homepage" type="text" class="u-input">
                    <div v-if="editProfileErrors.homepage" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.homepage),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.status }">
                    <span>{{ $t('status') }}</span>
                    <input v-model="editProfile.status" type="text" class="u-input">
                    <div v-if="editProfileErrors.status" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.status),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <div class="kiwi-userbox-editprofile-field" :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.color }">
                    <span>{{ $t('nickname_color') }}</span>
                    <div class="kiwi-userbox-editprofile-color-wrap">
                        <div class="kiwi-userbox-editprofile-color-input" @click="$refs.colorInput.click()">
                            <input
                                ref="colorInput"
                                v-model="editProfile.color"
                                type="color"
                                @change="onColorChange"
                            >
                            <div class="kiwi-userbox-editprofile-color-swatch" :style="{ backgroundColor: editProfile.color || user.getColour() }" />
                        </div>
                        <input
                            v-model="editProfile.color"
                            type="text"
                            class="u-input kiwi-userbox-editprofile-color-hex"
                            placeholder="#000000"
                        >
                        <button
                            type="button"
                            class="u-button u-button-secondary"
                            :title="$t('ok')"
                            @click="confirmColor"
                        >
                            <i class="fa fa-check" aria-hidden="true" />
                        </button>
                        <button
                            v-if="editProfile.color"
                            type="button"
                            class="u-button u-button-secondary"
                            :title="$t('reset')"
                            @click="editProfile.color = ''"
                        >
                            <i class="fa fa-undo" aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <label :class="{ 'kiwi-userbox-editprofile--invalid': editProfileErrors.description }">
                    <span>{{ $t('description') }}</span>
                    <textarea v-model="editProfile.description" class="u-input" rows="3" />
                    <div v-if="editProfileErrors.description" class="kiwi-userbox-editprofile-error">
                        {{ $t('metadata_too_long', {
                            current: getByteLength(editProfile.description),
                            max: network.metadata_limits.maxValueBytes,
                        }) }}
                    </div>
                </label>
                <div class="kiwi-userbox-editprofile-actions">
                    <button
                        :disabled="hasEditProfileErrors"
                        type="button"
                        class="u-button u-button-primary"
                        @click="saveProfile"
                    >
                        {{ $t('save') }}
                    </button>
                    <button type="button" class="u-button u-button-secondary" @click="isEditingProfile = false">
                        {{ $t('cancel') }}
                    </button>
                </div>
            </div>
        </div>

        <div class="kiwi-userbox-actions">
            <a v-if="showRegisterButton" class="kiwi-userbox-action" @click="startRegistration">
                <i class="fa fa-user-plus" aria-hidden="true" />
                {{ $t('register_account') }}
            </a>
            <a v-if="isSelf && !isEditingProfile && network.metadataCap()" class="kiwi-userbox-action" @click="startEditProfile">
                <i class="fa fa-pencil" aria-hidden="true" />
                {{ $t('edit_profile') }}
            </a>
            <a
                v-if="!isSelf && !buffer.isQuery() && !user.relayed_by"
                class="kiwi-userbox-action"
                @click="openQuery"
            >
                <i class="fa fa-comment-o" aria-hidden="true" />
                {{ $t('send_a_message') }}
            </a>
            <a
                v-if="!whoisRequested && !user.relayed_by"
                class="kiwi-userbox-action"
                @click="updateWhoisData"
            >
                <i class="fa fa-question-circle" aria-hidden="true" />
                {{ $t('more_information') }}
            </a>
            <div class="kiwi-userbox-actions kiwi-userbox-plugin-actions">
                <component
                    :is="plugin.component"
                    v-for="plugin in pluginUiButtonElements"
                    :key="plugin.id"
                    :plugin-props="{
                        user,
                        userbox: self,
                    }"
                    v-bind="plugin.props"
                    :network="network"
                    :buffer="buffer"
                    :user="user"
                    :sidebar-state="sidebarState"
                />
            </div>
        </div>

        <form v-if="!isSelf" class="u-form kiwi-userbox-ignoreuser">
            <label>
                <input :checked="user.ignore" type="checkbox" @change="toggleIgnore">
                <span> {{ $t('ignore_user') }} </span>
            </label>
        </form>

        <div v-if="showServicesCheatsheet" class="kiwi-userbox-services">
            <h3>{{ $t('nickserv_handy_commands') }}</h3>
            <div v-if="showServicesCardBlurb" class="kiwi-userbox-services-blurb">
                {{ $t('nickserv_card_register_blurb') }}
            </div>
            <dl class="kiwi-userbox-service-list kiwi-userbox-service-row">
                <dt>{{ $t('nickserv_register') }}</dt>
                <dd>/ns REGISTER &lt;password&gt; [email]</dd>
                <dt>{{ $t('nickserv_passwd') }}</dt>
                <dd>/ns PASSWD &lt;current&gt; &lt;new&gt; &lt;new&gt;</dd>
                <dt>{{ $t('nickserv_unregister') }}</dt>
                <dd>/ns UNREGISTER &lt;account&gt; [code]</dd>
            </dl>
            <h3>{{ $t('nickserv_cheatsheet_title') }}</h3>
            <p class="kiwi-userbox-services-hint" v-html="$t('nickserv_cheatsheet_hint')" />
            <dl class="kiwi-userbox-service-list">
                <div
                    v-for="setting in nickservSettings"
                    :key="setting.name"
                    class="kiwi-userbox-service-row"
                >
                    <dt>{{ setting.name }}</dt>
                    <dd>{{ settingValuesLabel(setting) }}</dd>
                </div>
            </dl>
        </div>

        <div v-if="showChanServicesCheatsheet" class="kiwi-userbox-services">
            <h3>{{ $t('nickserv_handy_commands') }}</h3>
            <dl class="kiwi-userbox-service-list kiwi-userbox-service-row">
                <dt>{{ $t('chanserv_howtoban') }}</dt>
                <dd>/cs HOWTOBAN &lt;#channel&gt; &lt;nick&gt;</dd>
                <dt>{{ $t('chanserv_amode') }}</dt>
                <dd>/cs AMODE &lt;#channel&gt; [mode change] [account]</dd>
                <dt>{{ $t('chanserv_register') }}</dt>
                <dd>/cs REGISTER &lt;#channel&gt;</dd>
                <dt>{{ $t('chanserv_transfer') }}</dt>
                <dd>/cs TRANSFER [accept] &lt;#channel&gt; user [code]</dd>
                <dt>{{ $t('chanserv_unregister') }}</dt>
                <dd>/cs UNREGISTER &lt;#channel&gt; [code]</dd>
            </dl>
            <h3>{{ $t('chanserv_cheatsheet_title') }}</h3>
            <p class="kiwi-userbox-services-hint" v-html="$t('chanserv_cheatsheet_hint')" />
            <dl class="kiwi-userbox-service-list">
                <div
                    v-for="setting in chanservSettings"
                    :key="setting.name"
                    class="kiwi-userbox-service-row"
                >
                    <dt>{{ setting.name }}</dt>
                    <dd>{{ settingValuesLabel(setting) }}</dd>
                </div>
            </dl>
        </div>

        <div v-if="showHostServicesCheatsheet" class="kiwi-userbox-services">
            <h3>{{ $t('nickserv_handy_commands') }}</h3>
            <dl class="kiwi-userbox-service-list kiwi-userbox-service-row">
                <dt>{{ $t('hostserv_on') }}</dt>
                <dd>/hs ON</dd>
                <dt>{{ $t('hostserv_off') }}</dt>
                <dd>/hs OFF</dd>
                <dt>{{ $t('hostserv_status') }}</dt>
                <dd>/hs STATUS [user]</dd>
            </dl>
        </div>

        <div v-if="showHistServicesCheatsheet" class="kiwi-userbox-services">
            <h3>{{ $t('nickserv_handy_commands') }}</h3>
            <dl class="kiwi-userbox-service-list kiwi-userbox-service-row">
                <dt>{{ $t('histserv_play') }}</dt>
                <dd>/msg HistServ PLAY &lt;target&gt; [limit]</dd>
                <dt>{{ $t('histserv_delete') }}</dt>
                <dd>/msg HistServ DELETE &lt;target&gt; &lt;msgid&gt;</dd>
            </dl>
        </div>

        <div
            v-if="whoisRequested && !user.relayed_by"
            :class="[whoisLoading ? 'kiwi-userbox-whois--loading' : '']"
            class="kiwi-userbox-whois"
        >
            <template v-if="whoisLoading">
                <i class="fa fa-spin fa-spinner" aria-hidden="true" />
            </template>
            <template v-else-if="pluginUiWhoisElements.length">
                <component
                    :is="plugin.component"
                    v-for="plugin in pluginUiWhoisElements"
                    :key="plugin.id"
                    :plugin-props="{
                        user,
                        userbox: self,
                    }"
                    v-bind="plugin.props"
                    :network="network"
                    :buffer="buffer"
                    :user="user"
                    :sidebar-state="sidebarState"
                />
            </template>
            <template v-else>
                <span class="kiwi-userbox-whois-line">
                    {{ user.away
                        ? `${$t('whois_status')}: ${user.away}`
                        : $t('whois_status_available')
                    }}
                </span>
                <span v-if="user.account" class="kiwi-userbox-whois-line">
                    {{ $t('user_account', { user: user.account }) }}
                </span>
                <span class="kiwi-userbox-whois-line">
                    {{ $t('user_realname', { realname: user.realname }) }}
                </span>
                <span v-if="user.is_bot" class="kiwi-userbox-whois-line">
                    {{ $t('user_bot') }}
                </span>
                <span v-if="user.whois.helpop" class="kiwi-userbox-whois-line">
                    {{ $t('user_help') }}
                </span>
                <span v-if="user.whois.operator" class="kiwi-userbox-whois-line">
                    {{ $t('user_op') }}
                </span>
                <span v-if="user.whois.server" class="kiwi-userbox-whois-line">
                    {{ $t('user_server', {
                        server: user.whois.server,
                        info: (user.whois.server_info ? `(${user.whois.server_info})` : ''),
                    }) }}
                </span>
                <span v-if="user.whois.secure" class="kiwi-userbox-whois-line">
                    {{ $t('user_secure') }}
                </span>
                <span
                    v-if="user.whois.channels"
                    class="kiwi-userbox-whois-line"
                    @click="onChannelsClick($event)"
                    v-html="$t('user_channels', { channels: userChannels })"
                />
            </template>
        </div>

        <div
            v-if="buffer.isChannel() && areWeAnOp && !isSelf && !user.relayed_by"
            class="kiwi-userbox-opactions"
        >
            <form class="u-form" @submit.prevent="">
                <label v-if="isUserOnBuffer">
                    {{ $t('user_access') }} <select v-model="userMode">
                        <option
                            v-for="mode in availableChannelModes"
                            :key="mode.mode"
                            :value="mode.mode"
                        >
                            {{ mode.description }}
                        </option>
                        <option value="">{{ $t('user_normal') }}</option>
                    </select>
                </label>
                <label v-if="isUserOnBuffer">
                    <button
                        type="button"
                        class="u-button u-button-secondary
                               kiwi-userbox-opaction-kick kiwi-userbox-opaction"
                        @click="buffer.kickUser(user)"
                    >
                        <i class="fa fa-sign-out" aria-hidden="true" />
                        {{ $t('user_kick') }}
                    </button>
                </label>
                <label>
                    <button
                        type="button"
                        class="u-button u-button-secondary
                               kiwi-userbox-opaction-ban kiwi-userbox-opaction"
                        @click="buffer.banUser(user)"
                    >
                        <i class="fa fa-ban" aria-hidden="true" />
                        {{ $t('user_ban') }}
                    </button>
                </label>
                <label v-if="isUserOnBuffer">
                    <button
                        type="button"
                        class="u-button u-button-secondary
                               kiwi-userbox-opaction-kickban kiwi-userbox-opaction"
                        @click="buffer.banKickUser(user)"
                    >
                        <i class="fa fa-exclamation-triangle" aria-hidden="true" />
                        {{ $t('user_kickban') }}
                    </button>
                </label>
            </form>
        </div>
        <div
            v-if="buffer.isQuery() && invitableBuffers.length > 0 && !user.relayed_by"
            class="kiwi-userbox-query-invite kiwi-userbox-actions u-form"
        >
            <select v-model="inviteChan" class="u-input">
                <option value="">{{ $t('select_channel') }}</option>
                <option
                    v-for="chan in invitableBuffers"
                    :key="`inviteChan-${chan}`"
                    :value="chan"
                >{{ chan }}</option>
            </select>
            <a class="u-button u-button-secondary" @click="inviteUser()">
                {{ $t('invite_user') }}
            </a>
        </div>
    </div>
</template>

<script>
'kiwi public';

import * as TextFormatting from '@/helpers/TextFormatting';
import * as Misc from '@/helpers/Misc';
import GlobalApi from '@/libs/GlobalApi';
import toHtml from '@/libs/renderers/Html';
import parseMessage from '@/libs/MessageParser';
import { effectiveRetention, effectiveService } from '@/libs/fileupload';
import { NICKSERV_SETTINGS } from '@/libs/ErgoServices';
import { CHANSERV_SETTINGS } from '@/libs/ErgoChanServ';
import UserAvatar from './UserAvatar';
import AwayStatusIndicator from './AwayStatusIndicator';

export default {
    components: {
        UserAvatar,
        AwayStatusIndicator,
    },
    props: ['network', 'buffer', 'user', 'sidebarState'],
    data() {
        return {
            self: this,
            whoisRequested: false,
            whoisLoading: false,
            inviteChan: '',
            isEditingProfile: false,
            avatarUploading: false,
            avatarUploadId: 0,
            isRegistering: false,
            registerForm: {
                account: '',
                email: '',
                password: '',
                code: '',
            },
            editProfile: {
                displayName: '',
                pronouns: '',
                avatar: '',
                description: '',
                homepage: '',
                status: '',
                color: '',
            },
            pluginUiButtonElements: GlobalApi.singleton().userboxButtonPlugins,
            pluginUiInfoElements: GlobalApi.singleton().userboxInfoPlugins,
            pluginUiWhoisElements: GlobalApi.singleton().userboxWhoisPlugins,
        };
    },
    computed: {
        // Channel modes differ on some IRCds so get them from the network options
        availableChannelModes() {
            let availableModes = [];
            let prefixes = this.network.supports('PREFIX');
            let knownPrefix = {
                q: 'Owner',
                a: 'Admin',
                o: 'Operator',
                h: 'Half-Operator',
                v: 'Voice',
            };

            prefixes.forEach((prefix) => {
                let mode = prefix.mode;
                if (knownPrefix[mode]) {
                    availableModes.push({
                        mode: mode,
                        description: knownPrefix[mode],
                    });
                }
            });

            return availableModes;
        },
        areWeAnOp() {
            if (!this.buffer) {
                return false;
            }

            return this.buffer.isUserAnOp(this.buffer.getNetwork().nick);
        },
        realname() {
            return (this.user.realname || '').trim();
        },
        formattedRealname() {
            let blocks = parseMessage(this.realname, { extras: false });
            let content = toHtml(blocks, false);
            return content;
        },
        isUserOnBuffer() {
            if (!this.buffer) {
                return false;
            }

            if (!this.user.buffers[this.buffer.id]) {
                // Probably switched buffer while the userbox was open
                return false;
            }

            return true;
        },
        userMode: {
            get() {
                if (!this.buffer) {
                    return '';
                }

                let userBufferInfo = this.user.buffers[this.buffer.id];
                if (!userBufferInfo) {
                    // Probably switched buffer while the userbox was open
                    return '';
                }

                let modes = userBufferInfo.modes;
                return modes.length > 0 ?
                    modes[0] :
                    '';
            },
            // Switch the current user mode for the new one
            set(newVal) {
                let client = this.network.ircClient;
                let oldVal = this.userMode;

                let changes = [];
                let targets = [];

                if (oldVal) {
                    changes.push('-' + oldVal);
                    targets.push(this.user.nick);
                }
                if (newVal) {
                    changes.push('+' + newVal);
                    targets.push(this.user.nick);
                }

                let params = ['MODE', this.buffer.name, changes.join('')].concat(targets);
                client.raw(params);
            },
        },
        userChannels() {
            let channels = this.user.whois.channels.trim().split(' ').sort(Misc.strCompare);
            for (let i = 0; i < channels.length; i++) {
                channels[i] = TextFormatting.linkifyChannels(channels[i]);
            }
            return channels.join(' ');
        },
        isSelf() {
            return this.user === this.network.currentUser();
        },
        invitableBuffers() {
            let buffers = [];
            this.network.buffers.forEach((buffer) => {
                if (
                    buffer.isChannel() &&
                    buffer.isUserAnOp(this.network.nick) &&
                    !buffer.hasNick(this.user.nick)
                ) {
                    buffers.push(buffer.name);
                }
            });
            return buffers;
        },
        editProfileErrors() {
            const max = this.network.metadata_limits.maxValueBytes;
            return {
                displayName: this.getByteLength(this.editProfile.displayName) > max,
                pronouns: this.getByteLength(this.editProfile.pronouns) > max,
                avatar: this.getByteLength(this.editProfile.avatar) > max,
                description: this.getByteLength(this.editProfile.description) > max,
                homepage: this.getByteLength(this.editProfile.homepage) > max,
                status: this.getByteLength(this.editProfile.status) > max,
                color: this.getByteLength(this.editProfile.color) > max,
            };
        },
        hasEditProfileErrors() {
            return Object.values(this.editProfileErrors).some((v) => v);
        },
        avatarUploadService() {
            if (!this.network || this.network.state !== 'connected') {
                return null;
            }
            let service = effectiveService(this.$state, this.network);
            if (!service || !service.persistent) {
                return null;
            }
            return service;
        },
        registrationInfo() {
            if (!this.network) {
                return null;
            }
            return this.network.accountRegistration();
        },
        showRegisterButton() {
            return this.isSelf &&
                !this.isRegistering &&
                !this.isEditingProfile &&
                this.network.state === 'connected' &&
                !(this.network.upstreamAccount && this.network.upstreamAccount()) &&
                !this.network.registration.pending &&
                !!this.registrationInfo;
        },
        registerPasswordHint() {
            const info = this.registrationInfo;
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
        registerValid() {
            const info = this.registrationInfo;
            if (!info) {
                return false;
            }
            if (info.customAccountName && !this.registerForm.account.trim()) {
                return false;
            }
            if (info.emailRequired && !this.registerForm.email.trim()) {
                return false;
            }
            const length = this.getByteLength(this.registerForm.password);
            if (length === 0) {
                return false;
            }
            if (info.minPasswordLength && length < info.minPasswordLength) {
                return false;
            }
            if (info.maxPasswordLength && length > info.maxPasswordLength) {
                return false;
            }
            return true;
        },
        isErgoNetwork() {
            return !!(this.network && typeof this.network.isErgo === 'function' && this.network.isErgo());
        },
        hasServicesAccount() {
            return !!(this.network && this.network.upstreamAccount &&
                this.network.upstreamAccount());
        },
        isNickServCard() {
            return !this.isSelf &&
                this.isErgoNetwork &&
                !!this.user &&
                typeof this.user.nick === 'string' &&
                this.user.nick.toLowerCase() === 'nickserv';
        },
        showServicesCheatsheet() {
            return this.isNickServCard;
        },
        showServicesCardBlurb() {
            return this.isNickServCard && !this.hasServicesAccount && !!this.registrationInfo;
        },
        showServicesFallbackBlurb() {
            return this.isSelf &&
                this.isErgoNetwork &&
                !this.hasServicesAccount &&
                !this.registrationInfo;
        },
        nickservSettings() {
            return NICKSERV_SETTINGS;
        },
        isChanServCard() {
            return !this.isSelf &&
                this.isErgoNetwork &&
                !!this.user &&
                typeof this.user.nick === 'string' &&
                this.user.nick.toLowerCase() === 'chanserv';
        },
        showChanServicesCheatsheet() {
            return this.isChanServCard;
        },
        chanservSettings() {
            return CHANSERV_SETTINGS;
        },
        isHostServCard() {
            return !this.isSelf &&
                this.isErgoNetwork &&
                !!this.user &&
                typeof this.user.nick === 'string' &&
                this.user.nick.toLowerCase() === 'hostserv';
        },
        showHostServicesCheatsheet() {
            return this.isHostServCard;
        },
        isHistServCard() {
            return !this.isSelf &&
                this.isErgoNetwork &&
                !!this.user &&
                typeof this.user.nick === 'string' &&
                this.user.nick.toLowerCase() === 'histserv';
        },
        showHistServicesCheatsheet() {
            return this.isHistServCard;
        },
    },
    watch: {
        user() {
            // Reset the whois view since the user is now different
            this.whoisRequested = false;
            this.whoisLoading = false;
            this.isRegistering = false;

            this.maybeFetchMetadata();
        },
        'network.registration.pending'(isPending) {
            // The form closes itself once the server accepts the registration
            if (!isPending && !this.network.registration.error) {
                this.isRegistering = false;
            }
        },
    },
    mounted() {
        this.maybeFetchMetadata();
    },
    methods: {
        toggleIgnore(event) {
            this.network.setUserIgnored(this.user, event.target.checked);
        },
        maybeFetchMetadata() {
            if (this.user.relayed_by) {
                return;
            }
            const now = Date.now();
            const cooldown = 30 * 60 * 1000;
            const isOld = now - (this.user.lastMetadataFetch || 0) > cooldown;
            const isService = this.network.isService(this.user.nick);

            if (isOld && !isService && this.network.metadataCap()) {
                this.network.getMetadata(this.user.nick, [
                    'avatar',
                    'pronouns',
                    'display-name',
                    'description',
                    'homepage',
                    'status',
                ]);
            }
        },
        settingValuesLabel(setting) {
            if (!setting.values || !setting.values.length) {
                return '';
            }
            return setting.values.join(' / ');
        },
        openQuery() {
            this.sidebarState.showNicklist();
            let buffer = this.$state.addBuffer(this.network.id, this.user.nick);
            this.$state.setActiveBuffer(this.network.id, buffer.name);
            if (this.$state.ui.is_narrow) {
                this.$state.$emit('userbox.hide');
            }
        },
        openRelayerBox() {
            let bot = this.$state.getUser(this.buffer.networkid, this.user.relayed_by);
            if (bot) {
                this.$state.$emit('userbox.show', bot, {
                    buffer: this.buffer,
                });
            }
        },
        onChannelsClick(event) {
            let channelName = event.target.getAttribute('data-channel-name');
            if (channelName) {
                let network = this.buffer.getNetwork();
                this.$state.addBuffer(this.buffer.networkid, channelName);
                network.ircClient.join(channelName);
            }
        },
        updateWhoisData() {
            this.whoisRequested = true;
            this.whoisLoading = true;
            this.network.ircClient.whois(this.user.nick, () => {
                this.whoisLoading = false;
            });
        },
        inviteUser() {
            if (!this.inviteChan) {
                return;
            }
            this.network.ircClient.invite(this.inviteChan, this.user.nick);
        },
        startRegistration() {
            this.registerForm.account = this.network.nick;
            this.registerForm.email = '';
            this.registerForm.password = '';
            this.registerForm.code = '';
            this.isRegistering = true;
        },
        cancelRegistration() {
            this.isRegistering = false;
        },
        submitRegistration() {
            if (!this.registerValid) {
                return;
            }
            const info = this.registrationInfo;
            const account = info.customAccountName ?
                this.registerForm.account.trim() :
                '*';
            const email = this.registerForm.email.trim() || '*';
            this.network.registerAccount(account, email, this.registerForm.password);
            this.registerForm.password = '';
        },
        submitVerify() {
            const code = this.registerForm.code.trim();
            if (!code) {
                return;
            }
            this.network.verifyAccount(code);
            this.registerForm.code = '';
        },
        startEditProfile() {
            this.avatarUploadId += 1;
            this.avatarUploading = false;
            this.editProfile.displayName = this.user.metadata['display-name'] || '';
            this.editProfile.pronouns = this.user.metadata.pronouns || '';
            this.editProfile.avatar = this.user.metadata.avatar || '';
            this.editProfile.description = this.user.metadata.description || '';
            this.editProfile.homepage = this.user.metadata.homepage || '';
            this.editProfile.status = this.user.metadata.status || '';
            this.editProfile.color = this.user.metadata.color || '';
            this.isEditingProfile = true;
        },
        saveProfile() {
            const m = this.network;
            const meta = this.user.metadata;
            const mapping = {
                'display-name': 'displayName',
                'pronouns': 'pronouns',
                'avatar': 'avatar',
                'description': 'description',
                'homepage': 'homepage',
                'status': 'status',
                'color': 'color',
            };

            Object.entries(mapping).forEach(([metaKey, editKey]) => {
                const newValue = this.editProfile[editKey];
                const oldValue = meta[metaKey] || '';
                if (newValue !== oldValue) {
                    m.setMetadata(metaKey, newValue);
                }
            });

            this.isEditingProfile = false;
        },
        getByteLength(str) {
            return new TextEncoder().encode(str).length;
        },
        onColorChange() {
            // No specific action needed here yet, the v-model handles it.
            // This method exists to provide a hook if we need to force focus away.
        },
        confirmColor() {
            if (this.$refs.colorInput) {
                this.$refs.colorInput.blur();
            }
        },
        async onAvatarFile(event) {
            let input = event.target;
            let file = input.files && input.files[0];
            input.value = '';
            if (!file || this.avatarUploading) {
                return;
            }
            if (!file.type || file.type.indexOf('image/') !== 0) {
                this.showAvatarUploadError(file, 'fileupload_not_image');
                return;
            }
            let service = this.avatarUploadService;
            if (!service || !this.network) {
                this.showAvatarUploadError(file, 'fileupload_failed');
                return;
            }
            this.avatarUploadId += 1;
            let uploadId = this.avatarUploadId;
            this.avatarUploading = true;
            try {
                let url = await service.upload(file, {
                    network: this.network,
                    retention: effectiveRetention(this.$state, service),
                });
                if (this.avatarUploadId === uploadId && this.isEditingProfile) {
                    this.editProfile.avatar = url;
                }
            } catch (err) {
                if (this.avatarUploadId === uploadId) {
                    this.showAvatarUploadError(file, 'fileupload_failed');
                }
            }
            if (this.avatarUploadId === uploadId) {
                this.avatarUploading = false;
            }
        },
        showAvatarUploadError(file, key) {
            if (!this.buffer) {
                return;
            }
            let message = key === 'fileupload_failed'
                ? this.$t('fileupload_failed', {
                    name: file && file.name ? file.name : '',
                })
                : this.$t(key);
            this.$state.addMessage(this.buffer, {
                time: Date.now(),
                nick: '*',
                message,
                type: 'error',
            });
        },
    },
};
</script>

<style lang="less">
.kiwi-sidebar.kiwi-sidebar-section-user {
    right: 0;
    width: 380px;
}

.kiwi-userbox {
    box-sizing: border-box;
    overflow-y: auto;
    height: 100%;
}

.kiwi-userbox-selfprofile {
    display: block;
    margin: 0 auto;
    width: 100%;
    padding: 1em;
    text-align: center;
    border-bottom: 1px solid rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
}

.kiwi-userbox-header {
    position: relative;
    padding: 0.5em;
    box-sizing: border-box;
    display: flex;
}

.kiwi-userbox-avatar {
    position: relative;
    margin: 1em;
    width: 100px;
    height: 100px;
    flex-shrink: 0;
}

.kiwi-userbox-userinfo {
    box-sizing: border-box;
    margin-top: 1.2em;
    flex-grow: 1;
    word-break: break-all;
}

.kiwi-userbox-nick {
    font-weight: 800;
    font-size: 1.4em;
}

.kiwi-userbox-modestring {
    font-weight: normal;
    font-size: 0.8em;
    margin-left: 6px;
}

.kiwi-userbox-pronouns {
    font-size: 0.9em;
    opacity: 0.7;
    margin-left: 5px;
}

.kiwi-userbox-usermask {
    display: block;
    opacity: 0.6;
    cursor: default;
    padding-left: 1px;
}

.kiwi-userbox-bot {
    display: block;
    margin-top: 4px;
    font-size: 1.2em;
    cursor: default;
}

.kiwi-userbox-realname {
    display: block;
    color: var(--comp-sidebar-fg);
    opacity: 0.8;
}

.kiwi-userbox-truenick {
    display: block;
    color: var(--comp-sidebar-fg);
    opacity: 0.8;
}

.fa-user.kiwi-userbox-icon {
    display: inline-block;
    font-size: 2em;
}

.kiwi-userbox-basicinfo {
    width: 100%;
    display: block;
    padding: 0 1.5em 0.5em 1.5em;
    box-sizing: border-box;
}

.kiwi-userbox-description {
    font-style: italic;
    margin-bottom: 1em;
    padding: 0.5em;
    background: rgba(128, 128, 128, 0.1);
    border-radius: 4px;
}

.kiwi-userbox-status {
    margin-bottom: 0.5em;
    font-size: 0.9em;
}

.kiwi-userbox-relayedby {
    display: flex;
    gap: 5px;
    padding: 0 1.5em 0.5em 1.5em;
    font-size: 0.9em;
}

.kiwi-userbox-homepage {
    margin-top: 0.5em;
    font-size: 0.9em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    i {
        margin-right: 5px;
    }
}

.kiwi-userbox-editprofile-avatar-wrap {
    display: flex;
    gap: 10px;
    align-items: center;

    .u-input {
        flex: 1;
        min-width: 0;
    }

    .u-button {
        padding: 0 12px;
        height: 38px;
        line-height: 38px;
    }
}

.kiwi-userbox-editprofile-avatar-file {
    display: none;
}

.kiwi-userbox-editprofile-color-wrap {
    display: flex;
    gap: 10px;
    align-items: center;

    .u-button {
        padding: 0 12px;
        height: 38px;
        line-height: 38px;
    }
}

.kiwi-userbox-editprofile-color-hex {
    flex: 1;
    text-align: center;
    font-family: var(--kiwi-font-mono);
}

.kiwi-userbox-editprofile-field {
    margin-bottom: 1em;

    span {
        display: block;
        font-weight: bold;
        margin-bottom: 0.3em;
    }
}

.kiwi-userbox-editprofile-color-input {
    position: relative;
    width: 60px;
    height: 38px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--brand-input-border);
    cursor: pointer;

    input[type='color'] {
        position: absolute;
        top: -10px;
        left: -10px;
        width: 100px;
        height: 100px;
        cursor: pointer;
        opacity: 0;
    }
}

.kiwi-userbox-editprofile-color-swatch {
    width: 100%;
    height: 100%;
}

.kiwi-userbox-editprofile {
    border-top: 1px solid rgba(128, 128, 128, 0.2);
    padding-top: 1em;
    margin-top: 1em;
    text-align: left;

    h3 {
        margin: 0 0 0.5em 0;
    }

    label {
        display: block;
        margin-bottom: 1em;

        span {
            display: block;
            font-weight: bold;
            margin-bottom: 0.3em;
        }

        input,
        textarea {
            width: 100%;
            box-sizing: border-box;
        }
    }
}

.kiwi-userbox-editprofile--invalid {
    input,
    textarea {
        border-color: var(--brand-error) !important;
    }

    span {
        color: var(--brand-error);
    }
}

.kiwi-userbox-editprofile-error {
    color: var(--brand-error);
    font-size: 0.8em;
    margin-top: 2px;
}

.kiwi-userbox-editprofile-warning {
    font-size: 0.9em;
    opacity: 0.8;
    color: var(--brand-warning);
    margin-bottom: 1em;
    font-style: italic;
}

.kiwi-userbox-editprofile-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.kiwi-userbox-register {
    border-top: 1px solid rgba(128, 128, 128, 0.2);
    padding-top: 1em;
    margin-top: 1em;
    text-align: left;

    h3 {
        margin: 0 0 0.5em 0;
    }

    label {
        display: block;
        margin-bottom: 1em;

        span {
            display: block;
            font-weight: bold;
            margin-bottom: 0.3em;
        }

        input {
            width: 100%;
            box-sizing: border-box;
        }
    }
}

.kiwi-userbox-register-as {
    margin-bottom: 1em;
}

.kiwi-userbox-register-error {
    color: var(--brand-error);
    font-size: 0.9em;
    margin-bottom: 1em;
}

.kiwi-userbox-register-hint {
    font-size: 0.8em;
    opacity: 0.8;
    margin-bottom: 1em;
}

.kiwi-userbox-register-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.kiwi-userbox-basicinfo-title,
.kiwi-userbox-basicinfo-data {
    display: block;
    width: 100%;
    cursor: default;
    margin: 0;
}

.kiwi-userbox-basicinfo-title {
    font-size: 1em;
    line-height: 1em;
    padding: 0;
    font-weight: 900;
}

.kiwi-userbox-basicinfo-data {
    font-weight: normal;
    opacity: 1;
}

.kiwi-userbox-actions {
    width: 100%;
    padding: 0.5em;
    text-align: center;
    user-select: none;
    box-sizing: border-box;

    /* using display flex here to prevent spaces making things uneven */
    display: flex;
    flex-wrap: wrap;
    justify-content: center;

    .kiwi-userbox-action {
        border: 1px solid;
        padding: 0.5em 1em;
        cursor: pointer;
        margin: 0.5em;
        transition: all 0.3s;
        border-radius: 3px;
    }

    .kiwi-userbox-action:empty {
        display: none;
    }

    label {
        display: block;
        cursor: pointer;

        span {
            text-align: left;
            width: auto;
        }
    }
}

.kiwi-userbox-plugin-actions {
    padding: 0;
}

.kiwi-userbox-opactions {
    width: 100%;
    text-align: center;
    box-sizing: border-box;
    margin: 0 0 1em 0;
    border-top: 1px solid;
    padding: 1em 1.5em;
}

.kiwi-userbox-opactions label {
    width: 100%;
    font-size: 1.2em;
    font-weight: 600;
    display: block;
    margin-bottom: 0.7em;
}

.kiwi-userbox-opactions label select {
    display: block;
    clear: both;
    padding: 10px;
    border-radius: 0.25em;
    box-shadow: none;
    border: 1px solid;
    width: 100%;
    margin-top: 10px;
    cursor: pointer;
}

.kiwi-userbox-opaction {
    width: 100%;
    padding: 0 1em;
    text-align: left;
    border: none;
    line-height: 2.2em;
    font-size: 0.8em;
}

.kiwi-userbox-opaction i {
    margin-right: 0.2em;
    font-size: 1.2em;
}

.kiwi-userbox-query-invite select {
    margin-right: 10px;
}

.kiwi-userbox-whois {
    line-height: 1.4em;
    padding: 1em;
    margin: 0 1em 1em 1em;
    background: none;
    box-sizing: border-box;
    border-radius: 1em;
}

.kiwi-userbox-whois-line {
    display: block;
}

.kiwi-userbox-whois--loading {
    text-align: center;
    font-size: 20px;
    line-height: 20px;
}

.kiwi-userbox-ignoreuser {
    display: flex;
    flex-direction: row;
    justify-content: center;
}

.kiwi-userbox-ignoreuser label {
    margin: 0 0 1em 0;
}

.kiwi-userbox-ignoreuser span {
    /* This fixes a vertical align issue between the checkbox and span */
    float: right;
}

.kiwi-userbox-services {
    border-top: 1px solid rgba(128, 128, 128, 0.2);
    margin: 1em 1.5em;
    padding-top: 1em;
    text-align: left;
}

.kiwi-userbox-services h3 {
    margin: 0 0 0.5em 0;
}

.kiwi-userbox-services-hint {
    font-size: 0.9em;
    opacity: 0.8;
    margin: 0 0 1em 0;
}

.kiwi-userbox-services-blurb {
    font-size: 0.9em;
    opacity: 0.8;
    font-style: italic;
    margin: 0 1.5em 1em 1.5em;
}

.kiwi-userbox-services .kiwi-userbox-services-blurb {
    margin: 0 0 1em 0;
}

.kiwi-userbox-service-list {
    margin: 0;
}

.kiwi-userbox-service-row {
    margin-bottom: 1em;
}

.kiwi-userbox-service-row dt {
    font-size: 0.9em;
    font-weight: bold;
    margin-bottom: 0.2em;
}

.kiwi-userbox-service-row dd {
    font-size: 0.9em;
    opacity: 0.8;
    margin: 0;
}

.kiwi-userbox-services h4 {
    margin: 0 0 0.5em 0;
}

@media screen and (max-width: 769px) {
    .kiwi-container--sidebar-drawn .kiwi-sidebar-userbox {
        width: 100%;
    }

    .kiwi-userbox {
        left: 0;
        right: 0;
        bottom: 40px;
        top: auto;
        max-width: 100%;
        border-width: 1px 0;
    }

    .kiwi-userbox .kiwi-userbox-header i {
        display: none;
    }

    .kiwi-userbox-actions {
        width: 100%;
        box-sizing: border-box;
    }

    .kiwi-userbox-plugin-actions {
        padding: 0;
    }

    .kiwi-userbox-actions .kiwi-userbox-action {
        width: 66%;
        clear: both;
        display: block;
    }
}
</style>
