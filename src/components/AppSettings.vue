<template>
    <div class="kiwi-appsettings">

        <div :title="$t('close')" class="kiwi-appsettings-close" @click="closeSettings">
            <span>{{ $t('close') }}</span>
            <i class="bx bx-x" aria-hidden="true" />
        </div>

        <form class="u-form">
            <tabbed-view ref="tabs" class="kiwi-appsettings-tab-container">
                <tabbed-tab :header="$t('settings_general')" :focus="true" name="general">

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_general') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-general">
                            <label class="kiwi-appsettings-setting-language">
                                <span>{{ $t('settings_language') }}</span>
                                <div><i class="bx bx-globe" /></div>
                                <select v-model="settingLanguage">
                                    <option value="">
                                        Auto
                                    </option>
                                    <option v-for="l in localesList" :key="l[0]" :value="l[0]">
                                        {{ l[1] }}
                                    </option>
                                </select>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_auto_reconnect') }} </span>
                                <input v-model="settingAutoReconnect" type="checkbox">
                            </label>
                            <label v-if="desktopTrayAvailable" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_close_to_tray') }} </span>
                                <input
                                    v-model="desktopCloseToTray"
                                    type="checkbox"
                                    @change="saveDesktopCloseToTray"
                                >
                            </label>
                            <label
                                v-if="desktopAutoLaunchAvailable"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_launch_at_login') }} </span>
                                <input
                                    v-model="desktopAutoLaunch"
                                    type="checkbox"
                                    @change="saveDesktopAutoLaunch"
                                >
                            </label>
                            <label
                                v-if="desktopSettingsAvailable"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_spellcheck') }} </span>
                                <input
                                    v-model="desktopSpellcheck"
                                    type="checkbox"
                                    @change="saveDesktopSpellcheck"
                                >
                            </label>
                            <div
                                v-if="canRegisterProtocolHandler"
                                style="margin-top: 10px; text-align: center;"
                            >
                                <a
                                    class="u-button u-button-primary"
                                    @click="makeDefaultProtocolHandler()"
                                >
                                    <i>{{ $t('settings_default_handler') }}</i>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div v-if="desktopUpdatesAvailable" class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_updates') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_check_updates_auto') }} </span>
                                <input
                                    v-model="desktopCheckForUpdates"
                                    type="checkbox"
                                    @change="saveDesktopCheckForUpdates"
                                >
                            </label>
                            <p class="kiwi-appsettings-hint">
                                {{ $t('settings_check_updates_auto_hint') }}
                            </p>
                            <p v-if="desktopVersion" class="kiwi-appsettings-update-version">
                                {{ $t('settings_current_version', { version: desktopVersion }) }}
                            </p>
                            <div class="kiwi-appsettings-update-actions">
                                <button
                                    :disabled="desktopUpdateChecking"
                                    class="u-button u-button-primary"
                                    type="button"
                                    @click="checkForDesktopUpdates"
                                >
                                    {{ desktopUpdateButtonLabel }}
                                </button>
                                <button
                                    v-if="desktopUpdateAvailable"
                                    class="u-button"
                                    type="button"
                                    @click="openDesktopUpdate"
                                >
                                    {{ $t('settings_view_update') }}
                                </button>
                            </div>
                            <p
                                v-if="desktopUpdateStatus"
                                class="kiwi-appsettings-hint"
                                role="status"
                            >
                                {{ desktopUpdateStatus }}
                            </p>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_messaging_permissions') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_block_private') }} </span>
                                <input v-model="settingBufferBlockPms" type="checkbox">
                            </label>
                            <p class="kiwi-appsettings-hint">
                                {{ $t('settings_block_private_hint') }}
                            </p>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('notifications') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-notifications">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_flash_title') }} </span>
                                <select v-model="settingBufferFlashTitle">
                                    <option value="off">{{ $t('settings_flash_title_off') }}</option>
                                    <option value="message">
                                        {{ $t('settings_flash_title_messages') }}
                                    </option>
                                    <option value="highlight">
                                        {{ $t('settings_flash_title_highlights') }}
                                    </option>
                                </select>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_notifications') }} </span>
                                <input v-model="settingBufferShowNotifications" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_notification_sounds') }} </span>
                                <input v-model="settingNotificationSounds" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_unread_badges') }} </span>
                                <input v-model="settingUnreadBadges" type="checkbox">
                            </label>
                            <label class="kiwi-appsettings-full">
                                <span>{{ $t('settings_highlight') }} </span>
                                <input v-model="settingHighlights" type="text" class="u-input">
                            </label>
                            <div class="kiwi-appsettings-subsection">
                                <h4>{{ $t('settings_pertinent_messages') }}</h4>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('settings_show_joinpart') }} </span>
                                    <input v-model="settingBufferTrafficAsActivity" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('settings_server_as_activity') }} </span>
                                    <input v-model="settingBufferServerAsActivity" type="checkbox">
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_theme') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-appearance">
                            <label class="kiwi-appsettings-setting-theme">
                                <span>{{ $t('settings_theme') }} </span>
                                <a
                                    :title="$t('refresh_theme')"
                                    class="kiwi-appsettings-theme-reload"
                                    @click="refreshTheme"
                                >
                                    <i class="bx bx-refresh" aria-hidden="true" />
                                </a>
                                <select v-model="theme">
                                    <option
                                        v-for="t in settings.themes"
                                        :key="t.name"
                                        :value="t.name"
                                    >
                                        {{ t.displayName || t.name }}
                                    </option>
                                </select>
                            </label>
                            <label v-if="themeSupportsMonospace" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_use_monospace') }} </span>
                                <input v-model="settingUseMonospace" type="checkbox">
                            </label>
                            <label
                                v-if="presetSwitcherOptionVisible"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_show_preset_switcher') }} </span>
                                <input v-model="settingShowPresetSwitcher" type="checkbox">
                            </label>
                            <div
                                v-if="desktopThemesAvailable"
                                class="kiwi-appsettings-installed-themes"
                            >
                                <h4>{{ $t('settings_installed_themes') }}</h4>
                                <p class="kiwi-appsettings-hint">
                                    {{ $t('settings_installed_themes_hint') }}
                                </p>
                                <button
                                    type="button"
                                    class="u-button u-button-primary"
                                    :disabled="themeInstallBusy"
                                    @click="installTheme"
                                >
                                    {{
                                        themeInstallBusy
                                            ? $t('settings_theme_installing')
                                            : $t('settings_install_theme')
                                    }}
                                </button>
                                <p
                                    v-if="themeError"
                                    class="kiwi-appsettings-theme-error"
                                    role="alert"
                                >
                                    {{ themeError }}
                                </p>
                                <ul
                                    v-if="installedThemes.length"
                                    class="kiwi-appsettings-theme-list"
                                >
                                    <li
                                        v-for="installedTheme in installedThemes"
                                        :key="installedTheme.name"
                                    >
                                        <span>
                                            {{
                                                installedTheme.displayName
                                                    || installedTheme.name
                                            }}
                                        </span>
                                        <button
                                            type="button"
                                            class="u-button u-button-secondary"
                                            @click="uninstallTheme(installedTheme)"
                                        >
                                            {{ $t('settings_uninstall_theme') }}
                                        </button>
                                    </li>
                                </ul>
                                <p v-else class="kiwi-appsettings-hint">
                                    {{ $t('settings_no_installed_themes') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_messages_block') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-messages">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_messagelayout') }} </span>
                                <select v-model="settingMessageLayout">
                                    <option value="traditional">
                                        {{ $t('settings_messagelayout_traditional') }}
                                    </option>
                                    <option value="modern">
                                        {{ $t('settings_messagelayout_modern') }}
                                    </option>
                                    <option value="corporate">
                                        {{ $t('settings_messagelayout_corporate') }}
                                    </option>
                                    <option value="inline">
                                        {{ $t('settings_messagelayout_inline') }}
                                    </option>
                                    <option value="cyberdeck">
                                        {{ $t('settings_messagelayout_cyberdeck') }}
                                    </option>
                                </select>
                            </label>
                            <label
                                v-if="timestampTimeSystem && settingBufferShowTimestamps"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_time_system') }} </span>
                                <select v-model="timestampTimeSystem">
                                    <option value="12h">
                                        {{ $t('settings_time_system_12h') }}
                                    </option>
                                    <option value="24h">
                                        {{ $t('settings_time_system_24h') }}
                                    </option>
                                    <option value="decimal">
                                        {{ $t('settings_time_system_decimal') }}
                                    </option>
                                </select>
                            </label>
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_show_redactions') }} </span>
                                <select v-model="settingGlobalShowRedactions">
                                    <option value="hidden">
                                        {{ $t('settings_show_redactions_hidden') }}
                                    </option>
                                    <option value="placeholder">
                                        {{ $t('settings_show_redactions_placeholder') }}
                                    </option>
                                    <option value="revealed">
                                        {{ $t('settings_show_redactions_revealed') }}
                                    </option>
                                </select>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_formatting') }} </span>
                                <input v-model="settingBufferExtraFormatting" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_simple_typography') }} </span>
                                <input v-model="settingBufferSimpleTypography" type="checkbox">
                            </label>
                            <label v-if="touchSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_message_info') }} </span>
                                <input v-model="settingBufferShowMessageInfo" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_emoji_convert_incoming') }} </span>
                                <input v-model="settingBufferEmojiConvertIncoming" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_hostnames') }} </span>
                                <input v-model="settingBufferShowHostnames" type="checkbox">
                            </label>
                            <label
                                v-if="messageLayoutUsesRealNames"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_show_realnames') }} </span>
                                <input v-model="settingBufferShowRealNames" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_timestamps') }} </span>
                                <input v-model="settingBufferShowTimestamps" type="checkbox">
                            </label>
                            <label
                                v-if="messageLayoutUsesAvatars"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_unknown_avatars') }} </span>
                                <input v-model="settingAvatarShowWithoutUser" type="checkbox">
                            </label>
                            <label
                                class="kiwi-appsettings-full kiwi-appsettings-setting-scrollback"
                            >
                                <input
                                    v-model="settingBufferScrollbackSize"
                                    type="number"
                                    class="u-input"
                                >
                                <span>{{ $t('settings_scrollback') }} </span>
                            </label>
                            <div class="kiwi-appsettings-subsection">
                                <h4>{{ $t('settings_show_messages') }}</h4>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('settings_show_bot_messages') }} </span>
                                    <input v-model="settingGlobalShowBotMessages" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('side_mode_changes') }} </span>
                                    <input v-model="settingBufferShowModeChanges" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('side_nick_changes') }} </span>
                                    <input v-model="settingBufferShowNickChanges" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('settings_show_presence_changes') }} </span>
                                    <input v-model="settingBufferShowPresenceChanges" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('side_topics') }} </span>
                                    <input v-model="settingBufferShowTopics" type="checkbox">
                                </label>
                                <label class="u-checkbox-wrapper kiwi-appsettings-indented">
                                    <span>{{ $t('side_joins') }} </span>
                                    <input v-model="settingBufferShowJoinParts" type="checkbox">
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_chat_box') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_emoji_picker_max_version') }} </span>
                                <select v-model.number="settingEmojiPickerMaxVersion">
                                    <option :value="0">{{ $t('settings_emoji_version_all') }}</option>
                                    <option
                                        v-for="version in emojiVersions"
                                        :key="version"
                                        :value="version"
                                    >
                                        Unicode {{ version.toFixed(1) }}
                                    </option>
                                </select>
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_warn_expected_command') }} </span>
                                <input
                                    v-model="settingBufferWarnExpectedCommand"
                                    type="checkbox"
                                >
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_autocomplete') }} </span>
                                <input v-model="settingShowAutoComplete" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_emoji_convert_as_typed') }} </span>
                                <input v-model="settingBufferEmojiConvertAsTyped" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_typographic_replacements') }} </span>
                                <input
                                    v-model="settingBufferTypographicReplacements"
                                    type="checkbox"
                                >
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_shared_input') }} </span>
                                <input v-model="settingBufferSharedInput" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_color_picker') }} </span>
                                <input v-model="settingShowColorPicker" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_emoji_picker') }} </span>
                                <input v-model="settingShowEmojiPicker" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_style_picker') }} </span>
                                <input v-model="settingShowStylePicker" type="checkbox">
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_previews') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_inline_previews') }} </span>
                                <input v-model="settingBufferInlineLinkPreviews" type="checkbox">
                            </label>
                            <label
                                v-if="settingBufferInlineLinkPreviews"
                                class="u-checkbox-wrapper"
                            >
                                <span>{{ $t('settings_generic_link_previews') }} </span>
                                <input v-model="settingBufferGenericLinkPreviews" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_hide_preview_cards') }} </span>
                                <input v-model="settingBufferHidePreviewCards" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_link_previews') }} </span>
                                <input v-model="settingBufferShowLinkPreviews" type="checkbox">
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_channels_title') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_topic_in_header') }} </span>
                                <input v-model="settingBufferShowTopicInHeader" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_export_button') }} </span>
                                <input v-model="settingShowExportButton" type="checkbox">
                            </label>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_users') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_avatar_away_status_position') }} </span>
                                <select v-model.number="settingAvatarAwayStatusPosition">
                                    <option :value="1">
                                        {{ $t('settings_avatar_position_top_right') }}
                                    </option>
                                    <option :value="2">
                                        {{ $t('settings_avatar_position_bottom_right') }}
                                    </option>
                                    <option :value="3">
                                        {{ $t('settings_avatar_position_bottom_left') }}
                                    </option>
                                    <option :value="4">
                                        {{ $t('settings_avatar_position_top_left') }}
                                    </option>
                                </select>
                            </label>
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_avatar_fallback_style') }} </span>
                                <select v-model="settingAvatarFallbackStyle">
                                    <option
                                        v-for="style in avatarFallbackStyles"
                                        :key="style.value"
                                        :value="style.value"
                                    >
                                        {{ $t(style.labelKey) }}
                                    </option>
                                </select>
                            </label>
                            <p v-if="avatarFallbackIsRemote" class="kiwi-appsettings-hint">
                                {{ $t('settings_avatar_remote_hint') }}
                            </p>
                            <label
                                v-if="settingAvatarFallbackStyle === 'custom'"
                                class="kiwi-appsettings-full"
                            >
                                <span>{{ $t('settings_avatar_fallback_url') }} </span>
                                <input v-model="settingAvatarFallbackUrl" class="u-input">
                            </label>
                            <p
                                v-if="settingAvatarFallbackStyle === 'custom'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_avatar_fallback_url_hint') }}
                            </p>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_avatar_show_image_background') }} </span>
                                <input
                                    v-model="settingAvatarShowImageBackground"
                                    type="checkbox"
                                >
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_grouped_nicklists') }} </span>
                                <input v-model="settingNicklistGrouped" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_hide_ignored') }} </span>
                                <input v-model="settingHideIgnored" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_nicklist_avatars') }} </span>
                                <input v-model="settingBufferNicklistAvatars" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_colors') }} </span>
                                <input v-model="settingShowColors" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_show_prefix') }} </span>
                                <input v-model="settingShowPrefix" type="checkbox">
                            </label>
                        </div>
                    </div>

                    <chat-log-settings />

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_emoji_packs') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label
                                v-if="emojiPackPreferenceVisible"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_emoji_pack_preference') }} </span>
                                <select v-model="settingEmojiPackPreference">
                                    <option value="local">
                                        {{ $t('settings_emoji_pack_preference_local') }}
                                    </option>
                                    <option value="remote">
                                        {{ $t('settings_emoji_pack_preference_remote') }}
                                    </option>
                                </select>
                            </label>
                            <label
                                class="u-checkbox-wrapper"
                                :title="$t('settings_remote_emoji_packs_hint')"
                            >
                                <span>{{ $t('settings_remote_emoji_packs') }} </span>
                                <input v-model="settingRemoteEmojiPacks" type="checkbox">
                            </label>
                            <div
                                v-if="desktopEmojiPacksAvailable"
                                class="kiwi-appsettings-installed-emoji-packs"
                            >
                                <h4>{{ $t('settings_installed_emoji_packs') }}</h4>
                                <p class="kiwi-appsettings-hint">
                                    {{ $t('settings_installed_emoji_packs_hint') }}
                                </p>
                                <button
                                    type="button"
                                    class="u-button u-button-primary"
                                    :disabled="emojiPackInstallBusy"
                                    @click="installEmojiPack"
                                >
                                    {{
                                        emojiPackInstallBusy
                                            ? $t('settings_emoji_pack_installing')
                                            : $t('settings_install_emoji_pack')
                                    }}
                                </button>
                                <p
                                    v-if="emojiPackError"
                                    class="kiwi-appsettings-theme-error"
                                    role="alert"
                                >
                                    {{ emojiPackError }}
                                </p>
                                <ul
                                    v-if="installedEmojiPacks.length"
                                    class="kiwi-appsettings-theme-list"
                                >
                                    <li
                                        v-for="installedPack in installedEmojiPacks"
                                        :key="installedPack.id"
                                    >
                                        <span>{{ installedPack.name }}</span>
                                        <button
                                            type="button"
                                            class="u-button u-button-secondary"
                                            @click="uninstallEmojiPack(installedPack)"
                                        >
                                            {{ $t('settings_uninstall_emoji_pack') }}
                                        </button>
                                    </li>
                                </ul>
                                <p v-else class="kiwi-appsettings-hint">
                                    {{ $t('settings_no_installed_emoji_packs') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_fileupload') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_fileupload_service') }} </span>
                                <select v-model="fileuploadServiceChoice">
                                    <option value="none">
                                        {{ $t('settings_fileupload_none') }}
                                    </option>
                                    <option
                                        v-for="service in fileuploadServices"
                                        :key="service.id"
                                        :value="service.id"
                                    >
                                        {{ service.label }}
                                    </option>
                                </select>
                            </label>
                            <label
                                v-if="fileuploadServiceChoice === 'catbox'"
                                class="kiwi-appsettings-full"
                            >
                                <span>{{ $t('settings_fileupload_catbox_userhash') }} </span>
                                <input v-model="settingCatboxUserhash" class="u-input">
                            </label>
                            <template v-if="fileuploadServiceChoice === 'webdav'">
                                <label class="kiwi-appsettings-full">
                                    <span>{{ $t('settings_fileupload_webdav_upload_url') }} </span>
                                    <input v-model="settingWebdavUploadUrl" class="u-input">
                                </label>
                                <label class="kiwi-appsettings-full">
                                    <span>{{ $t('settings_fileupload_webdav_access_url') }} </span>
                                    <input v-model="settingWebdavAccessUrl" class="u-input">
                                </label>
                                <label class="kiwi-appsettings-full">
                                    <span>{{ $t('settings_fileupload_webdav_username') }} </span>
                                    <input v-model="settingWebdavUsername" class="u-input">
                                </label>
                                <label class="kiwi-appsettings-full">
                                    <span>{{ $t('settings_fileupload_webdav_password') }} </span>
                                    <input
                                        v-model="settingWebdavPassword"
                                        type="password"
                                        class="u-input"
                                    >
                                </label>
                            </template>
                            <label
                                v-if="fileuploadRetentionOptions.length"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_fileupload_retention') }} </span>
                                <select v-model="fileuploadRetentionChoice">
                                    <option
                                        v-for="retention in fileuploadRetentionOptions"
                                        :key="retention"
                                        :value="retention"
                                    >
                                        {{ retention }}
                                    </option>
                                </select>
                            </label>
                            <p
                                v-if="fileuploadServiceChoice === 'catbox'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_fileupload_catbox_hint') }}
                            </p>
                            <p
                                v-if="fileuploadServiceChoice === 'filebin'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_fileupload_filebin_hint') }}
                            </p>
                            <p
                                v-if="fileuploadServiceChoice === 'sharebin'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_fileupload_sharebin_hint') }}
                            </p>
                            <p
                                v-if="fileuploadServiceChoice === 'uguu'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_fileupload_uguu_hint') }}
                            </p>
                            <p
                                v-if="fileuploadServiceChoice === 'webdav'"
                                class="kiwi-appsettings-hint"
                            >
                                {{ $t('settings_fileupload_webdav_hint') }}
                            </p>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('operator_tools') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-operator-tools">
                            <label>
                                <span>{{ $t('settings_default_ban_mask') }} </span>
                                <input v-model="settingDefaultBanMask" class="u-input">
                            </label>
                            <label>
                                <span>{{ $t('settings_default_kick_reason') }}</span>
                                <input v-model="settingDefaultKickReason" class="u-input">
                            </label>
                        </div>
                    </div>

                    <div v-if="!pluginSettingsRestricted" class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_plugins') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-plugins">
                            <p class="kiwi-appsettings-hint">
                                {{ $t('settings_plugins_hint') }}
                            </p>
                            <ul
                                v-if="pluginEntries.length"
                                class="kiwi-appsettings-plugin-list"
                            >
                                <li
                                    v-for="plugin in pluginEntries"
                                    :key="plugin.name"
                                    class="kiwi-appsettings-plugin"
                                >
                                    <label class="u-checkbox-wrapper">
                                        <span>
                                            {{ plugin.label }}
                                            <em
                                                v-if="plugin.installed"
                                                class="kiwi-appsettings-plugin-source"
                                            >{{ $t('settings_plugin_installed') }}</em>
                                        </span>
                                        <input
                                            type="checkbox"
                                            :checked="!plugin.disabled"
                                            @change="setPluginEnabled(
                                                plugin,
                                                $event.target.checked
                                            )"
                                        >
                                    </label>
                                    <span
                                        class="kiwi-appsettings-plugin-status"
                                        :class="'kiwi-appsettings-plugin-status--' + plugin.status"
                                    >
                                        {{ $t(plugin.statusKey) }}
                                    </span>
                                    <button
                                        v-if="plugin.installed"
                                        type="button"
                                        class="u-button u-button-secondary"
                                        @click="removePlugin(plugin)"
                                    >
                                        {{ $t('settings_uninstall_plugin') }}
                                    </button>
                                </li>
                            </ul>
                            <p v-else class="kiwi-appsettings-hint">
                                {{ $t('settings_no_plugins') }}
                            </p>
                            <div
                                v-if="desktopPluginsAvailable"
                                class="kiwi-appsettings-plugin-actions"
                            >
                                <button
                                    type="button"
                                    class="u-button u-button-primary"
                                    :disabled="pluginInstallBusy"
                                    @click="installPlugin"
                                >
                                    {{
                                        pluginInstallBusy ?
                                            $t('settings_plugin_installing') :
                                            $t('settings_install_plugin')
                                    }}
                                </button>
                            </div>
                            <p
                                v-if="pluginError"
                                class="kiwi-appsettings-theme-error"
                                role="alert"
                            >
                                {{ pluginError }}
                            </p>
                            <p
                                v-if="pluginReloadNeeded"
                                class="kiwi-appsettings-plugin-reload"
                            >
                                {{ $t('settings_plugins_reload') }}
                                <button
                                    type="button"
                                    class="u-button"
                                    @click="reloadForPlugins"
                                >
                                    {{ $t('settings_plugins_reload_button') }}
                                </button>
                            </p>
                        </div>
                    </div>

                    <profile-settings />

                    <div
                        v-if="!$state.setting('hide_advanced') && !settingAdvancedEnable"
                        class="kiwi-appsettings-block"
                    >
                        <h3>{{ $t('settings_advanced_title') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-advanced-enable">
                            <div>
                                <span style="font-weight: 600;">
                                    {{ $t('warning') }}
                                </span>
                                {{ $t('settings_advanced_warning') }}
                            </div>
                            <div style="margin-top: 10px; text-align: center;">
                                <a class="u-button u-button-warning" @click="enableAdvancedTab()">
                                    <i>{{ $t('settings_advanced_button') }}</i>
                                </a>
                            </div>
                        </div>
                    </div>

                    <plugin-settings-block
                        v-for="block in generalSettingsBlocks"
                        :key="'settings-block-' + block.id"
                        :block="block"
                    />
                </tabbed-tab>

                <tabbed-tab
                    v-if="activeNetwork"
                    :header="activeNetwork.name"
                    name="network"
                >
                    <div
                        v-if="persistencePreferenceAvailable ||
                            typingSupported || filehostSupported"
                        class="kiwi-appsettings-block"
                    >
                        <h3>{{ $t('settings_general') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label
                                v-if="persistencePreferenceAvailable"
                                class="kiwi-appsettings-persistence kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_persistence') }} </span>
                                <select
                                    v-model="settingPersistencePreference"
                                    @change="applyPersistencePreference"
                                >
                                    <option value="keep">
                                        {{ $t('settings_persistence_keep') }}
                                    </option>
                                    <option value="default">
                                        {{ $t('settings_persistence_default') }}
                                    </option>
                                    <option value="on">
                                        {{ $t('settings_persistence_enabled') }}
                                    </option>
                                    <option value="off">
                                        {{ $t('settings_persistence_disabled') }}
                                    </option>
                                </select>
                            </label>
                            <label v-if="typingSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_share_typing') }} </span>
                                <input v-model="settingBufferShareTyping" type="checkbox">
                            </label>
                            <label v-if="filehostSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_use_filehost') }} </span>
                                <input v-model="settingUseFilehost" type="checkbox">
                            </label>
                        </div>
                    </div>

                    <network-messaging-permissions :network="activeNetwork" />

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('notifications') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_message_notifications') }} </span>
                                <select v-model="settingNetworkAlertOn">
                                    <option value="message">
                                        {{ $t('settings_notify_all') }}
                                    </option>
                                    <option value="highlight">
                                        {{ $t('settings_notify_highlights') }}
                                    </option>
                                    <option value="never">
                                        {{ $t('settings_notify_nothing') }}
                                    </option>
                                </select>
                            </label>
                            <label
                                v-if="reactionNotificationsAvailable"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_reaction_notifications') }} </span>
                                <select v-model="settingReactionNotifications">
                                    <option value="all">
                                        {{ $t('settings_notify_all') }}
                                    </option>
                                    <option value="direct">
                                        {{ $t('settings_reaction_notifications_direct') }}
                                    </option>
                                    <option value="none">
                                        {{ $t('settings_notify_nothing') }}
                                    </option>
                                </select>
                            </label>
                            <label v-if="replySupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_highlight_replies') }} </span>
                                <input v-model="settingHighlightReplies" type="checkbox">
                            </label>
                            <label class="u-checkbox-wrapper">
                                <span>{{ $t('settings_highlight_group_mentions') }} </span>
                                <input v-model="settingHighlightGroupMentions" type="checkbox">
                            </label>
                            <p class="kiwi-appsettings-hint">
                                {{ $t('settings_highlight_group_mentions_hint') }}
                            </p>
                            <label
                                v-if="webpushAvailable"
                                class="u-checkbox-wrapper kiwi-appsettings-webpush"
                            >
                                <span>{{ $t('settings_webpush') }} </span>
                                <input
                                    v-model="settingWebpushEnabled"
                                    type="checkbox"
                                    @change="applyWebpushEnabled"
                                >
                            </label>
                            <div
                                v-if="webpushError"
                                class="kiwi-appsettings-webpush-error"
                            >
                                {{ $t('webpush_failed', { reason: webpushError }) }}
                            </div>
                            <button
                                v-if="webpushError"
                                type="button"
                                class="u-button u-button-warning kiwi-appsettings-webpush-reset"
                                @click="resetWebpush"
                            >
                                {{ $t('webpush_reset') }}
                            </button>
                        </div>
                    </div>

                    <div class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_messages_block') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label
                                v-if="redactionsSupported"
                                class="kiwi-appsettings-messagelistDisplay"
                            >
                                <span>{{ $t('settings_show_redactions') }} </span>
                                <select v-model="settingBufferShowRedactions">
                                    <option value="default">
                                        {{ $t('settings_default') }}
                                    </option>
                                    <option value="hidden">
                                        {{ $t('settings_show_redactions_hidden') }}
                                    </option>
                                    <option value="placeholder">
                                        {{ $t('settings_show_redactions_placeholder') }}
                                    </option>
                                    <option value="revealed">
                                        {{ $t('settings_show_redactions_revealed') }}
                                    </option>
                                </select>
                            </label>
                            <label v-if="messageTagsSupported" class="u-checkbox-wrapper">
                                <span>{{ $t('settings_lenient_rerouting') }} </span>
                                <input v-model="settingBufferLenientRerouting" type="checkbox">
                            </label>
                            <p v-if="messageTagsSupported" class="kiwi-appsettings-hint">
                                {{ $t('settings_lenient_rerouting_hint') }}
                            </p>
                            <div class="kiwi-appsettings-subsection">
                                <h4>{{ $t('settings_show_messages') }}</h4>
                                <label
                                    v-if="botSupportFound"
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('settings_show_bot_messages') }} </span>
                                    <select v-model="settingShowBotMessages">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                                <label
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('side_mode_changes') }} </span>
                                    <select v-model="settingShowModeChanges">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                                <label
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('side_nick_changes') }} </span>
                                    <select v-model="settingShowNickChanges">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                                <label
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('settings_show_presence_changes') }} </span>
                                    <select v-model="settingShowPresenceChanges">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                                <label
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('side_topics') }} </span>
                                    <select v-model="settingShowTopics">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                                <label
                                    class="kiwi-appsettings-messagelistDisplay kiwi-appsettings-indented"
                                >
                                    <span>{{ $t('side_joins') }} </span>
                                    <select v-model="settingShowJoinParts">
                                        <option value="default">{{ $t('settings_default') }}</option>
                                        <option value="no">{{ $t('settings_no') }}</option>
                                        <option value="yes">{{ $t('settings_yes') }}</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div v-if="chathistorySupported" class="kiwi-appsettings-block">
                        <h3>{{ $t('settings_channels_title') }}</h3>
                        <div class="kiwi-appsettings-section">
                            <label class="kiwi-appsettings-messagelistDisplay">
                                <span>{{ $t('settings_auto_request_history') }} </span>
                                <select v-model="settingBufferAutoRequestHistory">
                                    <option value="all">{{ $t('settings_scope_all') }}</option>
                                    <option value="channels">{{ $t('settings_scope_channels') }}</option>
                                    <option value="queries">{{ $t('settings_scope_queries') }}</option>
                                    <option value="none">{{ $t('settings_scope_never') }}</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <emoji-packs
                        v-if="hasEmojiPacks"
                        :network="activeNetwork"
                    />

                    <plugin-settings-block
                        v-for="block in networkSettingsBlocks"
                        :key="'network-settings-block-' + block.id"
                        :block="block"
                        :network="activeNetwork"
                    />
                </tabbed-tab>

                <tabbed-tab :header="$t('settings_aliases')" name="aliases">
                    <div class="kiwi-appsettings-block kiwi-appsettings-block-aliases">
                        <h3>{{ $t('settings_aliases') }}</h3>
                        <div class="kiwi-appsettings-section kiwi-appsettings-aliases">
                            <settings-aliases />
                        </div>
                    </div>
                </tabbed-tab>

                <tabbed-tab
                    v-if="settingAdvancedEnable"
                    :header="$t('settings_advanced')"
                    name="advanced"
                >
                    <div class="kiwi-appsettings-block kiwi-appsettings-block-advanced">
                        <div class="kiwi-appsettings-section kiwi-appsettings-advanced">
                            <settings-advanced />
                        </div>
                    </div>
                </tabbed-tab>

                <tabbed-tab
                    v-for="item in pluginUiElements"
                    :key="item.id"
                    :header="item.title()"
                    :name="item.tabName"
                >
                    <component :is="item.component" v-bind="item.props" />
                </tabbed-tab>
            </tabbed-view>
        </form>
    </div>
</template>

<script>
'kiwi public';

import ThemeManager from '@/libs/ThemeManager';
import { mergeInstalledThemes } from '@/libs/InstalledThemes';
import { mergeInstalledPlugins } from '@/libs/InstalledPlugins';
import { availableLayoutPresets } from '@/helpers/LayoutPresets';
import {
    listUploadServices,
    retentionFor,
    serviceAvailableOnPlatform,
    serviceFromId
} from '@/libs/fileupload';
import desktop from '@/libs/desktop';
import * as DesktopAutoLaunch from '@/libs/desktop/AutoLaunch';
import * as DesktopSettings from '@/libs/desktop/Settings';
import * as DesktopTray from '@/libs/desktop/Tray';
import * as DesktopUpdates from '@/libs/desktop/Updates';
import { getInstalledEmojiPackages, refreshLocalEmojiPacks } from '@/libs/LocalEmojiPacks';
import { loadEmojiPacksSettings } from '@/libs/LazyLoad';
import GlobalApi from '@/libs/GlobalApi';
import localesList from '@/res/localesList';
import { emojiVersions as emojiVersionList } from '@/res/emojiLookup';
import {
    AVATAR_FALLBACK_STYLES,
    CUSTOM_AVATAR_STYLE,
    LOCAL_IDENTICON,
    avatarFallbackStyleFromUrl,
    getAvatarFallbackUrl,
    isDiceBearFallbackStyle
} from '@/helpers/AvatarFallback';
import {
    formatForTimeSystem,
    timeSystemForFormat
} from '@/helpers/TimestampFormat';
import SettingsAliases from './SettingsAliases';
import SettingsAdvanced from './SettingsAdvanced';
import ChatLogSettings from './ChatLogSettings';
import ProfileSettings from './ProfileSettings';
import PluginSettingsBlock from './utils/PluginSettingsBlock';
import NetworkMessagingPermissions from './NetworkMessagingPermissions';
import NetworkPreferencesMixin from './NetworkPreferencesMixin';

const EmojiPacks = (resolve, reject) => {
    loadEmojiPacksSettings().then(resolve).catch(reject);
};

/**
 * Returns an object for a vuejs computated property on a state settings value
 * This allows default settings from the server config, but overrides with user config
 */
function bindSetting(settingName) {
    return {
        get() {
            return this.$state.setting(settingName);
        },
        set(newVal) {
            this.$state.setting(settingName, newVal);
        },
    };
}

export default {
    components: {
        SettingsAliases,
        SettingsAdvanced,
        ChatLogSettings,
        ProfileSettings,
        PluginSettingsBlock,
        NetworkMessagingPermissions,
        EmojiPacks,
    },
    mixins: [NetworkPreferencesMixin],
    data() {
        return {
            theme: '',
            themeInstallBusy: false,
            themeError: '',
            emojiPackInstallBusy: false,
            emojiPackError: '',
            desktopTrayAvailable: false,
            desktopSettingsAvailable: false,
            desktopCloseToTray: false,
            desktopAutoLaunchAvailable: false,
            desktopAutoLaunch: false,
            desktopSpellcheck: true,
            desktopCheckForUpdates: true,
            desktopUpdateChecking: false,
            desktopUpdateResult: null,
            desktopUpdateError: '',
            pluginUiElements: GlobalApi.singleton().appSettingsPlugins,
            generalSettingsBlocks: GlobalApi.singleton().generalSettingsBlocks,
            networkSettingsBlocks: GlobalApi.singleton().networkSettingsBlocks,
            pluginStatusVersion: 0,
            pluginReloadNeeded: false,
            pluginInstallBusy: false,
            pluginError: '',
            localesList,
        };
    },
    computed: {
        themeSupportsMonospace() {
            let themeMgr = ThemeManager.instance();
            let val = themeMgr.themeVar('supports-monospace');
            return val === '1';
        },
        canRegisterProtocolHandler() {
            if (this.$state.setting('startupScreen') !== 'personal' ||
                !String(this.$state.setting('kiwiServer') || '').trim() ||
                !navigator.registerProtocolHandler ||
                !this.$state.setting('allowRegisterProtocolHandler')
            ) {
                return false;
            }
            return document.location.protocol === 'http:' ||
                document.location.protocol === 'https:';
        },
        chathistorySupported() {
            const network = this.$state.getActiveNetwork();
            return !!network &&
                typeof network.hasCap === 'function' &&
                network.hasCap('draft/chathistory');
        },
        touchSupported() {
            if (typeof navigator === 'undefined') {
                return false;
            }
            return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
        },
        emojiVersions() {
            return emojiVersionList;
        },
        timestampTimeSystem: {
            get() {
                return timeSystemForFormat(
                    this.$state.setting('buffers.timestamp_format')
                );
            },
            set(newVal) {
                const format = formatForTimeSystem(newVal);
                if (format) {
                    this.$state.setting('buffers.timestamp_format', format);
                }
            },
        },
        settings() {
            return this.$state.settings;
        },
        pluginSettingsRestricted() {
            return !!this.$state.setting('restricted');
        },
        desktopPluginsAvailable() {
            return desktop.isDesktop() &&
                desktop.plugins &&
                desktop.plugins.isAvailable();
        },
        pluginEntries() {
            // eslint-disable-next-line no-unused-vars
            const statusVersion = this.pluginStatusVersion;
            const status = GlobalApi.singleton().pluginStatus();
            const loaded = new Set(
                Array.isArray(status.loadedEntries) ?
                    status.loadedEntries :
                    status.loaded
            );
            const failed = new Set(status.failed.map((entry) => entry.name));
            const disabledSetting = this.$state.setting('plugins_disabled');
            const disabled = new Set(
                Array.isArray(disabledSetting) ? disabledSetting : []
            );

            return (this.settings.plugins || [])
                .filter((plugin) => plugin && typeof plugin.name === 'string')
                .map((plugin) => {
                    const isDisabled = disabled.has(plugin.name);
                    let statusName = 'pending';
                    let statusKey = 'settings_plugin_status_pending';

                    if (isDisabled) {
                        statusName = 'disabled';
                        statusKey = 'settings_plugin_status_disabled';
                    } else if (failed.has(plugin.name)) {
                        statusName = 'failed';
                        statusKey = 'settings_plugin_status_failed';
                    } else if (loaded.has(plugin.name)) {
                        statusName = 'loaded';
                        statusKey = 'settings_plugin_status_loaded';
                    }

                    return {
                        name: plugin.name,
                        url: plugin.url,
                        installed: !!plugin.installed,
                        desktopPluginId: plugin.desktopPluginId || '',
                        disabled: isDisabled,
                        label: plugin.displayName || plugin.name,
                        status: statusName,
                        statusKey,
                    };
                });
        },
        activeNetwork() {
            return this.$state.getActiveNetwork();
        },
        fileuploadServices() {
            return listUploadServices().filter((service) => (
                service.id !== 'filehost' &&
                serviceAvailableOnPlatform(service)
            ));
        },
        fileuploadServiceChoice: {
            get() {
                const value = this.$state.setting('fileupload.service') || 'none';
                if (!value || value === 'filehost') {
                    return 'none';
                }
                const service = serviceFromId(value);
                return serviceAvailableOnPlatform(service) ? value : 'none';
            },
            set(newVal) {
                this.$state.setting('fileupload.service', newVal || 'none');
            },
        },
        fileuploadRetentionOptions() {
            const service = serviceFromId(this.fileuploadServiceChoice);
            return (service && service.retentions) || [];
        },
        fileuploadRetentionChoice: {
            get() {
                const service = serviceFromId(this.fileuploadServiceChoice);
                if (!service) {
                    return '';
                }
                const value = service.retentionSetting ?
                    this.$state.setting(service.retentionSetting) :
                    '';
                return retentionFor(service, value);
            },
            set(newVal) {
                const service = serviceFromId(this.fileuploadServiceChoice);
                if (!service || !service.retentionSetting) {
                    return;
                }
                this.$state.setting(service.retentionSetting, newVal);
            },
        },
        desktopThemesAvailable() {
            return desktop.isDesktop() && desktop.themes.isAvailable();
        },
        presetSwitcherOptionVisible() {
            if (desktop.isDesktop() || this.$state.ui.is_narrow) {
                return false;
            }
            return availableLayoutPresets(ThemeManager.instance()).length > 0;
        },
        installedThemes() {
            return (this.settings.themes || []).filter((theme) => theme.installed);
        },
        emojiPackPreferenceVisible() {
            const customEmojis = this.$state.setting('customEmojis');
            return desktop.isDesktop() || (
                customEmojis &&
                typeof customEmojis === 'object' &&
                Object.keys(customEmojis).length > 0
            );
        },
        desktopEmojiPacksAvailable() {
            return desktop.isDesktop() && desktop.emojiPacks.isAvailable();
        },
        desktopUpdatesAvailable() {
            return desktop.isDesktop() && DesktopUpdates.isAvailable();
        },
        desktopVersion() {
            return DesktopUpdates.currentVersion();
        },
        desktopUpdateAvailable() {
            return !!(
                this.desktopUpdateResult &&
                this.desktopUpdateResult.updateAvailable &&
                this.desktopUpdateResult.releaseUrl
            );
        },
        desktopUpdateButtonLabel() {
            return this.desktopUpdateChecking ?
                this.$t('settings_checking_updates') :
                this.$t('settings_check_updates');
        },
        desktopUpdateStatus() {
            if (this.desktopUpdateError) {
                return this.$t('settings_update_check_failed');
            }
            if (!this.desktopUpdateResult) {
                return '';
            }
            if (this.desktopUpdateResult.updateAvailable) {
                return this.$t('settings_update_available', {
                    version: this.desktopUpdateResult.latestVersion,
                });
            }
            return this.$t('settings_update_up_to_date');
        },
        installedEmojiPacks() {
            return getInstalledEmojiPackages();
        },
        hasEmojiPacks() {
            const network = this.activeNetwork;
            if (!network) {
                return false;
            }

            if (typeof network.supports === 'function' &&
                network.supports('draft/EMOJI')
            ) {
                return true;
            }

            const policies = network.setting('emojiChannelPolicies') || {};
            if (Object.keys(policies).length > 0) {
                return true;
            }

            const selections = network.setting('emojiPackSelections') || {};
            if (Object.keys(selections).length > 0) {
                return true;
            }

            return network.buffers.some((buffer) => (
                buffer.isChannel() &&
                buffer.metadata &&
                buffer.metadata['draft/emoji']
            ));
        },
        settingShowAutoComplete: bindSetting('showAutocomplete'),
        settingEmojiPickerMaxVersion: bindSetting('emojiPickerMaxVersion'),
        settingAutoReconnect: bindSetting('autoReconnect'),
        settingUseMonospace: bindSetting('useMonospace'),
        settingNicklistGrouped: bindSetting('nicklistGrouped'),
        settingHideIgnored: bindSetting('hideIgnored'),
        settingShowColors: bindSetting('showColors'),
        settingShowPrefix: bindSetting('showPrefix'),
        settingShowStylePicker: bindSetting('showStylePicker'),
        settingGlobalShowBotMessages: bindSetting('showBotMessages'),
        settingGlobalShowRedactions: bindSetting('buffers.show_redactions'),
        settingShowExportButton: bindSetting('showExportButton'),
        settingShowPresetSwitcher: bindSetting('showPresetSwitcher'),
        settingHighlights: bindSetting('highlights'),
        settingNotificationSounds: bindSetting('notificationSounds'),
        settingUnreadBadges: bindSetting('unreadBadges'),
        settingBufferShowNotifications: bindSetting('buffers.show_notifications'),
        settingShowEmojiPicker: bindSetting('showEmojiPicker'),
        settingShowColorPicker: bindSetting('showColorPicker'),
        settingBufferShowTimestamps: bindSetting('buffers.show_timestamps'),
        settingBufferEmojiConvertIncoming: bindSetting('buffers.emoji_convert_incoming'),
        settingBufferEmojiConvertAsTyped: bindSetting('buffers.emoji_convert_as_typed'),
        settingRemoteEmojiPacks: bindSetting('remoteEmojiPacks'),
        settingEmojiPackPreference: bindSetting('emojiPackPreference'),
        settingCatboxUserhash: bindSetting('fileupload.catbox.userhash'),
        settingWebdavUploadUrl: bindSetting('fileupload.webdav.upload_url'),
        settingWebdavAccessUrl: bindSetting('fileupload.webdav.access_url'),
        settingWebdavUsername: bindSetting('fileupload.webdav.username'),
        settingWebdavPassword: bindSetting('fileupload.webdav.password'),
        settingBufferBlockPms: bindSetting('buffers.block_pms'),
        settingBufferScrollbackSize: bindSetting('buffers.scrollback_size'),
        settingBufferExtraFormatting: bindSetting('buffers.extra_formatting'),
        settingBufferSimpleTypography: bindSetting('buffers.simple_typography'),
        settingBufferTypographicReplacements: bindSetting('buffers.typographic_replacements'),
        settingBufferTrafficAsActivity: bindSetting('buffers.traffic_as_activity'),
        settingDefaultBanMask: bindSetting('buffers.default_ban_mask'),
        settingDefaultKickReason: bindSetting('buffers.default_kick_reason'),
        settingBufferInlineLinkPreviews: {
            get() {
                return this.$state.setting('buffers.inline_link_auto_previews')
                    || this.$state.setting('buffers.inline_link_auto_previews_query');
            },
            set(newVal) {
                this.$state.setting('buffers.inline_link_auto_previews', newVal);
                this.$state.setting('buffers.inline_link_auto_previews_query', newVal);
            },
        },
        settingBufferHidePreviewCards: bindSetting('buffers.hide_preview_cards'),
        settingBufferGenericLinkPreviews: bindSetting('buffers.generic_link_previews'),
        settingBufferShowJoinParts: bindSetting('buffers.show_joinparts'),
        settingBufferShowTopics: bindSetting('buffers.show_topics'),
        settingBufferShowNickChanges: bindSetting('buffers.show_nick_changes'),
        settingBufferShowModeChanges: bindSetting('buffers.show_mode_changes'),
        settingBufferShowRealNames: bindSetting('buffers.show_realnames'),
        settingBufferShowHostnames: bindSetting('buffers.show_hostnames'),
        settingBufferShowTopicInHeader: bindSetting('buffers.show_topic_in_header'),
        settingBufferShowPresenceChanges: bindSetting('buffers.show_presence_changes'),
        settingBufferShowMessageInfo: bindSetting('buffers.show_message_info'),
        settingBufferShowLinkPreviews: bindSetting('buffers.show_link_previews'),
        settingBufferNicklistAvatars: bindSetting('buffers.nicklist_avatars'),
        avatarFallbackStyles() {
            return AVATAR_FALLBACK_STYLES;
        },
        avatarFallbackIsRemote() {
            return isDiceBearFallbackStyle(this.settingAvatarFallbackStyle);
        },
        settingAvatarFallbackStyle: {
            get() {
                const style = this.$state.setting('avatars.fallback_style');
                const url = this.$state.setting('avatars.fallback_avatar_url');
                const supported = AVATAR_FALLBACK_STYLES.some(
                    (item) => item.value === style
                );
                if (!supported) {
                    return url ? avatarFallbackStyleFromUrl(url) : LOCAL_IDENTICON;
                }
                if ((!style || style === LOCAL_IDENTICON) && url) {
                    return avatarFallbackStyleFromUrl(url);
                }
                return style || LOCAL_IDENTICON;
            },
            set(newVal) {
                this.$state.setting('avatars.fallback_style', newVal);
                if (newVal !== CUSTOM_AVATAR_STYLE) {
                    this.$state.setting(
                        'avatars.fallback_avatar_url',
                        getAvatarFallbackUrl(newVal)
                    );
                }
            },
        },
        settingAvatarFallbackUrl: bindSetting('avatars.fallback_avatar_url'),
        settingAvatarShowImageBackground: bindSetting('avatars.show_image_background'),
        settingAvatarShowWithoutUser: bindSetting('avatars.show_without_user'),
        settingAvatarAwayStatusPosition: bindSetting('avatars.away_status_position'),
        settingBufferSharedInput: bindSetting('buffers.shared_input'),
        settingBufferWarnExpectedCommand: bindSetting('buffers.warn_expected_command'),
        settingBufferFlashTitle: bindSetting('buffers.flash_title'),
        settingBufferServerAsActivity: bindSetting('buffers.server_as_activity'),
        settingAdvancedEnable: {
            get() {
                return this.$state.ui.show_advanced_tab;
            },
            set(newVal) {
                this.$state.ui.show_advanced_tab = newVal;
            },
        },
        settingLanguage: {
            get() {
                return this.$state.setting('language') || '';
            },
            set(newVal) {
                this.$state.setting('language', newVal || null);
            },
        },
        messageLayouts() {
            return {
                traditional: 'compact',
                modern: 'modern',
                corporate: 'corporate',
                inline: 'inline',
                cyberdeck: 'cyberdeck',
            };
        },
        messageLayoutUsesAvatars() {
            return this.settingMessageLayout === 'modern' ||
                this.settingMessageLayout === 'corporate' ||
                this.settingMessageLayout === 'cyberdeck';
        },
        messageLayoutUsesRealNames() {
            return this.settingMessageLayout === 'modern' ||
                this.settingMessageLayout === 'corporate' ||
                this.settingMessageLayout === 'cyberdeck';
        },
        settingMessageLayout: {
            get() {
                let s = this.$state.setting('buffers.messageLayout');
                let keys = Object.keys(this.messageLayouts);
                return keys.find((key) => this.messageLayouts[key] === s);
            },
            set(newVal) {
                let l = this.messageLayouts;
                this.$state.setting('buffers.messageLayout', l[newVal] || l.modern);
            },
        },
    },
    watch: {
        activeNetwork() {
            this.$nextTick(() => {
                if (!this.$refs.tabs) {
                    return;
                }
                if (!this.activeNetwork) {
                    this.$refs.tabs.setActiveByName('general');
                }
                this.$refs.tabs.refreshTabs();
            });
        },
    },
    created() {
        this.listenForThemeSettings();

        this.pluginStatusListener = () => {
            this.pluginStatusVersion += 1;
        };
        this.$state.$on('plugin.loaded', this.pluginStatusListener);
        this.$state.$on('plugin.failed', this.pluginStatusListener);
        this.$once('hook:destroyed', () => {
            this.$state.$off('plugin.loaded', this.pluginStatusListener);
            this.$state.$off('plugin.failed', this.pluginStatusListener);
        });

        this.desktopTrayAvailable = DesktopTray.isAvailable();
        this.desktopSettingsAvailable = DesktopSettings.isAvailable();
        if (this.desktopSettingsAvailable) {
            const removeSettingsListener = DesktopSettings.onChanged((settings) => {
                if (!settings) {
                    return;
                }
                if (typeof settings.closeToTray === 'boolean') {
                    this.desktopCloseToTray = settings.closeToTray;
                }
                if (typeof settings.spellcheck === 'boolean') {
                    this.desktopSpellcheck = settings.spellcheck;
                }
                if (typeof settings.checkForUpdates === 'boolean') {
                    this.desktopCheckForUpdates = settings.checkForUpdates;
                }
            });
            this.$once('hook:destroyed', removeSettingsListener);
        }
        this.loadDesktopSettings();
        this.loadDesktopUpdateStatus();

        this.listen(this.$state, 'settings.tab.show', (tabName) => {
            this.showTab(tabName);
        });
    },
    methods: {
        async loadDesktopSettings() {
            try {
                const settings = await DesktopSettings.get();
                if (settings) {
                    if (typeof settings.closeToTray === 'boolean') {
                        this.desktopCloseToTray = settings.closeToTray;
                    }
                    if (typeof settings.spellcheck === 'boolean') {
                        this.desktopSpellcheck = settings.spellcheck;
                    }
                    if (typeof settings.checkForUpdates === 'boolean') {
                        this.desktopCheckForUpdates = settings.checkForUpdates;
                    }
                }
            } catch (err) {
                // Desktop settings are optional.
            }

            try {
                const autoLaunch = await DesktopAutoLaunch.get();
                this.desktopAutoLaunchAvailable = !!autoLaunch.supported;
                this.desktopAutoLaunch = !!autoLaunch.enabled;
            } catch (err) {
                // Auto-launch is optional.
            }
        },
        async saveDesktopCloseToTray() {
            try {
                const settings = await DesktopSettings.set({
                    closeToTray: this.desktopCloseToTray,
                });
                if (settings && typeof settings.closeToTray === 'boolean') {
                    this.desktopCloseToTray = settings.closeToTray;
                }
            } catch (err) {
                // Desktop settings are optional.
            }
        },
        async saveDesktopSpellcheck() {
            try {
                const settings = await DesktopSettings.set({
                    spellcheck: this.desktopSpellcheck,
                });
                if (settings && typeof settings.spellcheck === 'boolean') {
                    this.desktopSpellcheck = settings.spellcheck;
                }
            } catch (err) {
                // Desktop settings are optional.
            }
        },
        async saveDesktopCheckForUpdates() {
            try {
                const settings = await DesktopSettings.set({
                    checkForUpdates: this.desktopCheckForUpdates,
                });
                if (settings && typeof settings.checkForUpdates === 'boolean') {
                    this.desktopCheckForUpdates = settings.checkForUpdates;
                }
            } catch (err) {
                // Desktop settings are optional.
            }
        },
        async loadDesktopUpdateStatus() {
            if (!this.desktopUpdatesAvailable) {
                return;
            }

            const removeStatusListener = DesktopUpdates.onStatus((result) => {
                this.desktopUpdateResult = result;
                this.desktopUpdateError = '';
            });
            this.$once('hook:destroyed', removeStatusListener);

            try {
                const result = await DesktopUpdates.status();
                if (result) {
                    this.desktopUpdateResult = result;
                }
            } catch (err) {
                // The status is optional until the first check.
            }
        },
        async checkForDesktopUpdates() {
            if (this.desktopUpdateChecking) {
                return;
            }

            this.desktopUpdateChecking = true;
            this.desktopUpdateError = '';
            try {
                const result = await DesktopUpdates.check();
                this.desktopUpdateResult = result;
            } catch (err) {
                this.desktopUpdateError = err && err.message ? err.message : String(err);
            } finally {
                this.desktopUpdateChecking = false;
            }
        },
        openDesktopUpdate() {
            if (!this.desktopUpdateResult || !this.desktopUpdateResult.releaseUrl) {
                return;
            }
            window.open(this.desktopUpdateResult.releaseUrl, '_blank', 'noopener');
        },
        async saveDesktopAutoLaunch() {
            try {
                const autoLaunch = await DesktopAutoLaunch.set(this.desktopAutoLaunch);
                this.desktopAutoLaunchAvailable = !!autoLaunch.supported;
                this.desktopAutoLaunch = !!autoLaunch.enabled;
            } catch (err) {
                // Auto-launch is optional.
            }
        },
        closeSettings() {
            this.$state.$emit('active.component');
        },
        refreshTheme() {
            ThemeManager.instance().reload();
        },
        setPluginEnabled(plugin, enabled) {
            const current = this.$state.setting('plugins_disabled');
            const disabled = new Set(Array.isArray(current) ? current : []);

            if (enabled) {
                disabled.delete(plugin.name);
            } else {
                disabled.add(plugin.name);
            }

            this.$state.setting('plugins_disabled', Array.from(disabled).sort());
            this.pluginReloadNeeded = true;
        },
        async refreshInstalledPlugins() {
            const installed = await desktop.plugins.list();
            mergeInstalledPlugins(this.$state, installed);
        },
        async installPlugin() {
            if (!this.desktopPluginsAvailable) {
                return;
            }
            if (!window.confirm(this.$t('settings_plugin_install_confirm'))) {
                return;
            }

            this.pluginError = '';
            this.pluginInstallBusy = true;

            try {
                const result = await desktop.plugins.install();
                if (!result || result.canceled) {
                    return;
                }
                await this.refreshInstalledPlugins();
                this.pluginReloadNeeded = true;
            } catch (err) {
                this.pluginError = this.$t('settings_plugin_install_failed', {
                    reason: err.message || String(err),
                });
            } finally {
                this.pluginInstallBusy = false;
            }
        },
        async removePlugin(plugin) {
            if (!plugin.installed || !plugin.desktopPluginId) {
                return;
            }
            if (!window.confirm(this.$t('settings_plugin_uninstall_confirm', {
                name: plugin.label,
            }))) {
                return;
            }

            this.pluginError = '';

            try {
                await desktop.plugins.uninstall(plugin.desktopPluginId);
                await this.refreshInstalledPlugins();
                this.pluginReloadNeeded = true;
            } catch (err) {
                this.pluginError = this.$t('settings_plugin_uninstall_failed', {
                    reason: err.message || String(err),
                });
            }
        },
        reloadForPlugins() {
            window.location.reload();
        },
        async refreshInstalledThemes() {
            const installed = await desktop.themes.list();
            mergeInstalledThemes(this.$state, installed);
        },
        async installEmojiPack() {
            this.emojiPackError = '';
            this.emojiPackInstallBusy = true;

            try {
                const result = await desktop.emojiPacks.install();
                if (!result || result.canceled) {
                    return;
                }
                await refreshLocalEmojiPacks();
            } catch (err) {
                this.emojiPackError = this.$t('settings_emoji_pack_install_failed', {
                    reason: err.message || err,
                });
            } finally {
                this.emojiPackInstallBusy = false;
            }
        },
        async uninstallEmojiPack(pack) {
            if (typeof window.confirm === 'function' &&
                !window.confirm(this.$t('settings_emoji_pack_uninstall_confirm', {
                    name: pack.name,
                }))
            ) {
                return;
            }

            this.emojiPackError = '';
            try {
                await desktop.emojiPacks.uninstall(pack.id);
                await refreshLocalEmojiPacks();
            } catch (err) {
                this.emojiPackError = this.$t('settings_emoji_pack_uninstall_failed', {
                    reason: err.message || err,
                });
            }
        },
        async installTheme() {
            this.themeError = '';
            this.themeInstallBusy = true;

            try {
                const result = await desktop.themes.install();
                if (!result || result.canceled) {
                    return;
                }
                await this.refreshInstalledThemes();
            } catch (err) {
                this.themeError = this.$t('settings_theme_install_failed', {
                    reason: err.message || err,
                });
            } finally {
                this.themeInstallBusy = false;
            }
        },
        async uninstallTheme(theme) {
            const name = theme.displayName || theme.name;
            if (typeof window.confirm === 'function' &&
                !window.confirm(this.$t('settings_theme_uninstall_confirm', { name }))
            ) {
                return;
            }

            this.themeError = '';
            const wasActive = this.theme === theme.name;
            const fallback = this.settings.themes.find((candidate) => (
                !candidate.installed && candidate.name !== theme.name
            ));

            try {
                await desktop.themes.uninstall(theme.desktopThemeId);
                await this.refreshInstalledThemes();
                if (wasActive && fallback) {
                    this.theme = fallback.name;
                }
            } catch (err) {
                this.themeError = this.$t('settings_theme_uninstall_failed', {
                    reason: err.message || err,
                });
            }
        },
        showTab(tabName) {
            this.$refs.tabs.setActiveByName(tabName);
        },
        listenForThemeSettings() {
            let themeMgr = ThemeManager.instance();
            let watches = [];

            // Called when the current theme changes (including url refreshes)
            let updateFn = () => {
                let theme = themeMgr.currentTheme();
                this.theme = theme.name;
            };

            let failedFn = () => {
                let theme = themeMgr.currentTheme();
                this.theme = theme.name;
            };

            let watchTheme = (newVal) => {
                themeMgr.setTheme(newVal);
            };

            // Remove all our attached events to cleanup
            let teardownFn = () => {
                this.$state.$off('theme.change', updateFn);
                this.$state.$off('theme.failed', failedFn);
                watches.forEach((unwatchFn) => unwatchFn());
                this.$off('hook:destroy', teardownFn);
            };

            // Update our info with the latest theme settings before we start
            // listening for changes
            updateFn();

            this.$state.$on('theme.change', updateFn);
            this.$state.$on('theme.failed', failedFn);
            this.$once('hook:destroyed', teardownFn);

            // $watch returns a function to stop watching the data field. Add them into
            // an array to make it easier to iterate over them all and unwatch them all
            // when needed.
            watches = [
                this.$watch('theme', watchTheme),
            ];
        },
        enableAdvancedTab() {
            this.settingAdvancedEnable = true;
            this.$nextTick(() => {
                this.showTab('advanced');
                this.$el.scrollTop = 0;
            });
        },
        makeDefaultProtocolHandler() {
            if (!this.canRegisterProtocolHandler) {
                return;
            }

            const { origin, pathname } = document.location;
            try {
                navigator.registerProtocolHandler(
                    'irc',
                    origin + pathname + '#%s',
                    'Kiwi IRC'
                );
                navigator.registerProtocolHandler(
                    'ircs',
                    origin + pathname + '#%s',
                    'Kiwi IRC'
                );
            } catch {
                // Some embedded/desktop origins reject custom schemes even
                // though the API exists. The button is hidden there, but avoid
                // surfacing a stray unhandled error if it is invoked directly.
            }
        },
    },
};
</script>

<style lang="less">
.kiwi-appsettings {
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
    padding: 0;
    position: relative;

    .u-form {
        width: 100%;
        overflow: hidden;
    }
}

.u-form label.kiwi-appsettings-setting-language.kiwi-appsettings-setting-language {
    display: flex;
    margin-bottom: 2em;
}

.kiwi-appsettings-setting-language select {
    flex-grow: 0;
    max-width: 200px;
}

.kiwi-appsettings-setting-language div {
    flex-grow: 1;
    text-align: right;
    margin-right: 1em;
}

.kiwi-appsettings-setting-language .bx-globe {
    vertical-align: middle;
    font-size: 1.8em;
}

.kiwi-appsettings-setting-theme span {
    margin-left: 0;
}

.kiwi-appsettings-setting-theme select {
    float: right;
}

.kiwi-appsettings-installed-themes {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--comp-border);

    h4 {
        margin: 0 0 6px;
    }

    .u-button {
        margin-top: 4px;
    }
}

.kiwi-appsettings-theme-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;

    li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 0;
    }

    .u-button {
        margin: 0;
    }
}

.kiwi-appsettings-theme-error {
    color: var(--brand-error);
    font-size: 0.9em;
}

.kiwi-appsettings-plugin-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
}

.kiwi-appsettings-plugin {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;

    .u-checkbox-wrapper {
        flex: 1;
        margin: 0;
    }

    .u-button {
        margin: 0;
    }
}

.kiwi-appsettings-plugin-source {
    font-style: normal;
    margin-left: 6px;
    opacity: 0.7;
}

.kiwi-appsettings-plugin-status {
    font-size: 0.85em;
    opacity: 0.8;
}

.kiwi-appsettings-plugin-status--loaded {
    color: var(--brand-online);
}

.kiwi-appsettings-plugin-status--failed {
    color: var(--brand-error);
}

.kiwi-appsettings-plugin-status--disabled {
    opacity: 0.6;
}

.kiwi-appsettings-plugin-actions,
.kiwi-appsettings-plugin-reload {
    margin-top: 10px;
}

.kiwi-appsettings-setting-showjoinpart span {
    max-width: none;
}

.kiwi-appsettings-full span,
.kiwi-appsettings-full input {
    width: 100%;
}

.kiwi-appsettings-aliases {
    padding: 1em 20px 2em 20px;
}

.kiwi-appsettings .kiwi-appsettings-setting-scrollback input {
    margin-right: 10px;
    width: 80px;
}

.kiwi-appsettings-tab-container {
    width: 100%;
}

.kiwi-appsettings .u-form label {
    display: block;
}

.kiwi-appsettings .u-form label span {
    text-align: left;
    margin-left: 0;
}

.kiwi-appsettings-theme-reload {
    margin-left: 1em;
    float: right;
    cursor: pointer;
}

.kiwi-settings-aliases-input {
    height: auto;
    min-height: 400px;
    line-height: normal;
    width: 100%;
    max-width: 100%;
    resize: vertical;
}

.kiwi-appsettings-block {
    max-width: 400px;
    width: auto;
    display: block;
    box-sizing: border-box;
    margin: 20px auto 20px auto;
}

.kiwi-appsettings-block.kiwi-appsettings-block-advanced {
    max-width: inherit;
    margin: 20px;
}

.kiwi-appsettings-block h3 {
    width: 100%;
    line-height: 45px;
    padding: 0 10px;
    box-sizing: border-box;
}

.kiwi-appsettings-section {
    padding: 10px;
}

.kiwi-appsettings-hint {
    margin: 0 0 10px 2px;
    font-size: 0.9em;
    opacity: 0.8;
}

.kiwi-appsettings-update-version {
    margin: 0 0 10px 2px;
    font-size: 0.9em;
    opacity: 0.8;
}

.kiwi-appsettings-update-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}

.kiwi-appsettings-subsection {
    margin-top: 1em;
}

.kiwi-appsettings-subsection h4 {
    margin: 0 0 8px 2px;
}

.kiwi-appsettings-indented {
    margin-left: 1.5em;
    margin-bottom: 6px;
}

.kiwi-appsettings-block label {
    display: block;
    line-height: 20px;
    margin: 0 0 3px 2px;
}

.kiwi-appsettings-block label span {
    display: inline-block;
    margin-right: 1em;
    line-height: 25px;
    width: auto;
    font-weight: 500;
    text-align: left;
    max-width: none;
}

.kiwi-appsettings-webpush-error {
    color: var(--brand-error);
    padding: 0 10px 10px 10px;
    font-size: 0.9em;
}

.kiwi-appsettings-webpush-reset {
    margin: 0 10px 10px;
}

.kiwi-appsettings-block-aliases {
    max-width: 750px;
}

.kiwi-appsettings-close {
    cursor: pointer;
    position: absolute;
    top: 0;
    right: 0;
    padding: 0 10px;
    font-weight: 600;
    box-sizing: border-box;
    text-transform: uppercase;
    line-height: 55px;
    text-align: right;
    transition: background 0.3s;
}

.kiwi-appsettings-close h2 {
    padding: 10px 0 11px 20px;
    width: auto;
    float: left;
}

.kiwi-appsettings-close a {
    float: right;
    position: static;
    background: none;
    border: none;
    padding: 10px 20px;
    font-size: 1.4em;
}

.kiwi-appsettings-close i {
    margin-left: 10px;
    font-size: 1.5em;
    float: right;
    line-height: 53px;
}

.kiwi-appsettings-messagelistDisplay select {
    float: right;
}

.kiwi-appsettings-operator-tools input {
    width: 100%;
}

@media screen and (max-width: 769px) {
    .kiwi-appsettings {
        width: 100%;
        z-index: 999;
        position: fixed;
        left: 0;
        top: 0;
        transition: left 0.5s;
    }

    .kiwi-appsettings .kiwi-appsettings-block {
        width: 90%;
    }

    .kiwi-appsettings .u-form label span {
        width: auto;
        margin-right: 0;
        display: inline-block;
    }

    .kiwi-appsettings-close,
    .kiwi-appsettings-close i {
        line-height: 46px;
    }
}
</style>
