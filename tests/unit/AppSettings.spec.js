import AppSettings from '@/components/AppSettings.vue';
import GlobalApi from '@/libs/GlobalApi';
import {
    FORMAT_12H,
    FORMAT_24H,
    FORMAT_DECIMAL,
    TIME_SYSTEM_12H,
    TIME_SYSTEM_24H,
    TIME_SYSTEM_DECIMAL
} from '@/helpers/TimestampFormat';
import state from '@/libs/state';
import { setLocalEmojiPacks } from '@/libs/LocalEmojiPacks';
import {
    CUSTOM_AVATAR_STYLE,
    DICEBEAR_FALLBACK_URLS,
    LOCAL_IDENTICON
} from '@/helpers/AvatarFallback';

/* eslint-disable no-underscore-dangle */

// src/main.js supplies these through webpack's DefinePlugin; jest does not.
global.__VERSION__ = '2.0.0';
global.__COMMITHASH__ = 'testhash';

describe('AppSettings channel defaults', () => {
    let s;

    beforeEach(() => {
        s = state.create();
    });

    afterEach(() => {
        setLocalEmojiPacks([]);
        delete window.kiwiDesktop;
        s.$destroy();
    });

    function getComputed(name) {
        return AppSettings.computed[name].get.call({ $state: s });
    }

    function setComputed(name, value) {
        AppSettings.computed[name].set.call({ $state: s }, value);
    }

    const bindings = [
        ['settingBufferShowNotifications', 'show_notifications', false],
        ['settingBufferShowJoinParts', 'show_joinparts', false],
        ['settingBufferShowTopics', 'show_topics', false],
        ['settingBufferShowNickChanges', 'show_nick_changes', false],
        ['settingBufferShowModeChanges', 'show_mode_changes', false],
        ['settingBufferExtraFormatting', 'extra_formatting', false],
        ['settingBufferShowRealNames', 'show_realnames', true],
        ['settingBufferShowHostnames', 'show_hostnames', true],
        ['settingBufferShowTopicInHeader', 'show_topic_in_header', true],
        ['settingBufferShowPresenceChanges', 'show_presence_changes', false],
        ['settingBufferShowMessageInfo', 'show_message_info', false],
        ['settingBufferShowLinkPreviews', 'show_link_previews', false],
        ['settingBufferNicklistAvatars', 'nicklist_avatars', true],
        ['settingBufferSharedInput', 'shared_input', true],
        ['settingBufferWarnExpectedCommand', 'warn_expected_command', false],
        ['settingBufferFlashTitle', 'flash_title', 'off'],
        ['settingBufferServerAsActivity', 'server_as_activity', true],
    ];

    it('does not count server messages as activity by default', () => {
        expect(s.setting('buffers.server_as_activity')).toBe(false);
    });

    it('uses the updated buffer defaults', () => {
        expect(s.setting('buffers.nicklist_avatars')).toBe(true);
        expect(s.setting('buffers.emoji_convert_as_typed')).toBe(false);
        expect(s.setting('buffers.show_topic_in_header')).toBe(false);
        expect(s.setting('buffers.show_presence_changes')).toBe(false);
        expect(s.setting('buffers.show_joinparts')).toBe(false);
        expect(s.setting('buffers.show_nick_changes')).toBe(false);
        expect(s.setting('buffers.show_topics')).toBe(true);
        expect(s.setting('buffers.show_mode_changes')).toBe(true);
        expect(s.setting('buffers.extra_formatting')).toBe(true);
        expect(s.setting('emojiPackPreference')).toBe('local');
    });

    it('shows the preset switcher by default and binds its setting', () => {
        expect(getComputed('settingShowPresetSwitcher')).toBe(true);

        setComputed('settingShowPresetSwitcher', false);

        expect(s.setting('showPresetSwitcher')).toBe(false);
        expect(getComputed('settingShowPresetSwitcher')).toBe(false);
    });

    it('offers the Corporate and Cyberdeck layouts and realnames for them', () => {
        const context = {
            $state: s,
            messageLayouts: AppSettings.computed.messageLayouts.call({}),
        };

        AppSettings.computed.settingMessageLayout.set.call(context, 'corporate');

        expect(s.setting('buffers.messageLayout')).toBe('corporate');
        expect(AppSettings.computed.settingMessageLayout.get.call(context))
            .toBe('corporate');

        AppSettings.computed.settingMessageLayout.set.call(context, 'cyberdeck');

        expect(s.setting('buffers.messageLayout')).toBe('cyberdeck');
        expect(AppSettings.computed.settingMessageLayout.get.call(context))
            .toBe('cyberdeck');

        expect(AppSettings.computed.messageLayoutUsesRealNames.call({
            settingMessageLayout: 'corporate',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesRealNames.call({
            settingMessageLayout: 'cyberdeck',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesRealNames.call({
            settingMessageLayout: 'modern',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesRealNames.call({
            settingMessageLayout: 'inline',
        })).toBe(false);

        expect(AppSettings.computed.messageLayoutUsesAvatars.call({
            settingMessageLayout: 'corporate',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesAvatars.call({
            settingMessageLayout: 'cyberdeck',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesAvatars.call({
            settingMessageLayout: 'modern',
        })).toBe(true);
        expect(AppSettings.computed.messageLayoutUsesAvatars.call({
            settingMessageLayout: 'traditional',
        })).toBe(false);
        expect(AppSettings.computed.messageLayoutUsesAvatars.call({
            settingMessageLayout: 'inline',
        })).toBe(false);
    });

    it('only shows pack preference with custom emoji or a desktop client', () => {
        delete window.kiwiDesktop;
        s.setting('customEmojis', {});
        expect(AppSettings.computed.emojiPackPreferenceVisible.call({ $state: s }))
            .toBe(false);

        s.setting('customEmojis', { kiwi: 'https://example.com/kiwi.png' });
        expect(AppSettings.computed.emojiPackPreferenceVisible.call({ $state: s }))
            .toBe(true);

        s.setting('customEmojis', {});
        window.kiwiDesktop = {};
        expect(AppSettings.computed.emojiPackPreferenceVisible.call({ $state: s }))
            .toBe(true);
    });

    it('lists installed emoji packs and detects the desktop bridge', () => {
        expect(AppSettings.computed.desktopEmojiPacksAvailable.call({})).toBe(false);

        window.kiwiDesktop = {
            emojiPacks: {
                list: jest.fn(),
                install: jest.fn(),
                uninstall: jest.fn(),
            },
        };
        expect(AppSettings.computed.desktopEmojiPacksAvailable.call({})).toBe(true);

        setLocalEmojiPacks([{
            id: 'kiwi-pack-abcd1234',
            name: 'Kiwi Pack',
            installedAt: 1,
            packs: [{
                id: 'kiwi',
                name: 'Kiwi Pack',
                emoji: {
                    kiwi: {
                        url: 'kiwi-emoji://kiwi-pack-abcd1234/images/kiwi.png',
                    },
                },
            }],
        }]);

        expect(AppSettings.computed.installedEmojiPacks.call({})).toMatchObject([{
            id: 'kiwi-pack-abcd1234',
            name: 'Kiwi Pack',
        }]);
    });

    it('shows desktop update controls and status', () => {
        window.kiwiDesktop = {
            version: '2.2.0',
            updates: {
                check: jest.fn(),
                status: jest.fn(),
                onStatus: jest.fn(),
            },
        };

        expect(AppSettings.computed.desktopUpdatesAvailable.call({})).toBe(true);
        expect(AppSettings.computed.desktopVersion.call({})).toBe('2.2.0');
        expect(AppSettings.computed.desktopUpdateAvailable.call({
            desktopUpdateResult: {
                updateAvailable: true,
                releaseUrl: 'https://example.com/release',
            },
        })).toBe(true);
        expect(AppSettings.computed.desktopUpdateStatus.call({
            desktopUpdateError: '',
            desktopUpdateResult: {
                updateAvailable: true,
                latestVersion: '2.3.0',
            },
            $t: (key, values) => `${key}:${values.version}`,
        })).toBe('settings_update_available:2.3.0');
    });

    it('shows channel emoji pack controls when a network has packs', () => {
        expect(AppSettings.computed.hasEmojiPacks.call({ activeNetwork: null }))
            .toBe(false);

        const network = s.addNetwork('TestNet', 'nick', {
            server: 'irc.example.net',
        });
        const buffer = s.addBuffer(network.id, '#test');
        const context = { activeNetwork: network };

        expect(AppSettings.computed.hasEmojiPacks.call(context)).toBe(false);

        buffer.metadata['draft/emoji'] = 'https://example.com/emoji.json';
        expect(AppSettings.computed.hasEmojiPacks.call(context)).toBe(true);

        delete buffer.metadata['draft/emoji'];
        network.setting('emojiChannelPolicies', {
            '#other': {
                name: '#other',
                policy: 'always',
            },
        });
        expect(AppSettings.computed.hasEmojiPacks.call(context)).toBe(true);
    });

    it('binds the global emoji pack preference', () => {
        expect(AppSettings.computed.settingEmojiPackPreference.get.call({ $state: s }))
            .toBe('local');

        AppSettings.computed.settingEmojiPackPreference.set.call(
            { $state: s },
            'remote'
        );
        expect(s.setting('emojiPackPreference')).toBe('remote');
    });

    it('only offers protocol registration in Personal mode with a gateway', () => {
        const descriptor = Object.getOwnPropertyDescriptor(
            navigator,
            'registerProtocolHandler'
        );
        const handler = jest.fn();

        try {
            Object.defineProperty(navigator, 'registerProtocolHandler', {
                configurable: true,
                value: undefined,
            });
            s.setting('startupScreen', 'personal');
            s.setting('kiwiServer', '/webirc/kiwiirc/');
            s.setting('allowRegisterProtocolHandler', true);
            expect(AppSettings.computed.canRegisterProtocolHandler.call({ $state: s }))
                .toBe(false);

            Object.defineProperty(navigator, 'registerProtocolHandler', {
                configurable: true,
                value: handler,
            });
            expect(AppSettings.computed.canRegisterProtocolHandler.call({ $state: s }))
                .toBe(true);

            s.setting('startupScreen', 'customServer');
            expect(AppSettings.computed.canRegisterProtocolHandler.call({ $state: s }))
                .toBe(false);

            s.setting('startupScreen', 'personal');
            s.setting('kiwiServer', '');
            expect(AppSettings.computed.canRegisterProtocolHandler.call({ $state: s }))
                .toBe(false);
        } finally {
            if (descriptor) {
                Object.defineProperty(navigator, 'registerProtocolHandler', descriptor);
            } else {
                delete navigator.registerProtocolHandler;
            }
        }
    });

    it('lists upload services by platform', () => {
        delete window.kiwiDesktop;
        expect(AppSettings.computed.fileuploadServices.call({}).map((service) => (
            service.id
        ))).toEqual(['litterbox']);

        window.kiwiDesktop = {};
        try {
            expect(AppSettings.computed.fileuploadServices.call({}).map((service) => (
                service.id
            ))).toEqual([
                'litterbox',
                'catbox',
                'filebin',
                'sharebin',
                'uguu',
                'webdav',
            ]);
        } finally {
            delete window.kiwiDesktop;
        }
    });

    it('binds the global upload service and retention', () => {
        expect(getComputed('fileuploadServiceChoice')).toBe('none');

        setComputed('fileuploadServiceChoice', 'litterbox');
        expect(s.setting('fileupload.service')).toBe('litterbox');

        const context = {
            $state: s,
            fileuploadServiceChoice: 'litterbox',
        };
        expect(AppSettings.computed.fileuploadRetentionOptions.call(context))
            .toEqual(['1h', '12h', '24h', '72h']);
        expect(AppSettings.computed.fileuploadRetentionChoice.get.call(context))
            .toBe('72h');

        AppSettings.computed.fileuploadRetentionChoice.set.call(context, '1h');
        expect(s.setting('fileupload.litterbox.retention')).toBe('1h');
    });

    it('exposes the plugin settings block lists', () => {
        const api = GlobalApi.singleton();
        api.generalSettingsBlocks.length = 0;
        api.networkSettingsBlocks.length = 0;

        const data = AppSettings.data();

        expect(data.generalSettingsBlocks).toBe(api.generalSettingsBlocks);
        expect(data.networkSettingsBlocks).toBe(api.networkSettingsBlocks);
    });

    it('exposes the active network for the network tab', () => {
        const network = s.addNetwork('TestNet', 'nick', {});
        s.ui.active_network = network.id;

        expect(AppSettings.computed.activeNetwork.call({ $state: s }))
            .toBe(network);

        s.ui.active_network = 0;
        expect(AppSettings.computed.activeNetwork.call({ $state: s }))
            .toBeUndefined();
    });

    it('detects touch support for touch-only settings', () => {
        const descriptor = Object.getOwnPropertyDescriptor(
            navigator,
            'maxTouchPoints'
        );

        try {
            Object.defineProperty(navigator, 'maxTouchPoints', {
                configurable: true,
                value: 1,
            });
            expect(AppSettings.computed.touchSupported.call({ $state: s }))
                .toBe(true);

            Object.defineProperty(navigator, 'maxTouchPoints', {
                configurable: true,
                value: 0,
            });
            expect(AppSettings.computed.touchSupported.call({ $state: s }))
                .toBe('ontouchstart' in window);
        } finally {
            if (descriptor) {
                Object.defineProperty(navigator, 'maxTouchPoints', descriptor);
            } else {
                delete navigator.maxTouchPoints;
            }
        }
    });

    it('maps the time system to timestamp formats', () => {
        expect(getComputed('timestampTimeSystem')).toBe(TIME_SYSTEM_24H);

        setComputed('timestampTimeSystem', TIME_SYSTEM_12H);
        expect(s.setting('buffers.timestamp_format')).toBe(FORMAT_12H);
        expect(getComputed('timestampTimeSystem')).toBe(TIME_SYSTEM_12H);

        setComputed('timestampTimeSystem', TIME_SYSTEM_DECIMAL);
        expect(s.setting('buffers.timestamp_format')).toBe(FORMAT_DECIMAL);
        expect(getComputed('timestampTimeSystem')).toBe(TIME_SYSTEM_DECIMAL);

        setComputed('timestampTimeSystem', TIME_SYSTEM_24H);
        expect(s.setting('buffers.timestamp_format')).toBe(FORMAT_24H);
    });

    it('hides the time system for an unrecognized timestamp format', () => {
        s.setting('buffers.timestamp_format', '%Y-%m-%d %H:%M');

        expect(getComputed('timestampTimeSystem')).toBeNull();
    });

    it('binds global settings', () => {
        const cases = [
            ['settingShowEmojiPicker', 'showEmojiPicker', true, false],
            ['settingShowColorPicker', 'showColorPicker', true, false],
            ['settingNotificationSounds', 'notificationSounds', true, false],
            ['settingUnreadBadges', 'unreadBadges', true, false],
            ['settingHideIgnored', 'hideIgnored', true, false],
            ['settingShowColors', 'showColors', true, false],
            ['settingShowPrefix', 'showPrefix', true, false],
            ['settingGlobalShowBotMessages', 'showBotMessages', true, false],
            ['settingShowStylePicker', 'showStylePicker', true, false],
            ['settingShowExportButton', 'showExportButton', false, true],
        ];

        cases.forEach(([computedName, key, initial, next]) => {
            expect(getComputed(computedName)).toBe(initial);
            setComputed(computedName, next);
            expect(s.setting(key)).toBe(next);
        });

        expect(getComputed('settingGlobalShowRedactions'))
            .toBe(s.setting('buffers.show_redactions'));
        setComputed('settingGlobalShowRedactions', 'hidden');
        expect(s.setting('buffers.show_redactions')).toBe('hidden');
    });

    it('shows request history only when chathistory is available', () => {
        expect(AppSettings.computed.chathistorySupported.call({ $state: s }))
            .toBe(false);

        const network = s.addNetwork('TestNet', 'nick', {});
        network.enabled_caps = ['draft/chathistory'];
        s.ui.active_network = network.id;

        expect(AppSettings.computed.chathistorySupported.call({ $state: s }))
            .toBe(true);
    });

    it('sorts away users in the nicklist by default', () => {
        expect(s.setting('nicklistGroupAway')).toBe(true);
    });

    it('loads and saves desktop settings', async() => {
        window.kiwiDesktop = {
            settings: {
                get: jest.fn(() => Promise.resolve({
                    closeToTray: false,
                    spellcheck: false,
                })),
                set: jest.fn((patch) => Promise.resolve({
                    closeToTray: true,
                    spellcheck: true,
                    ...patch,
                })),
            },
            autoLaunch: {
                get: jest.fn(() => Promise.resolve({
                    supported: true,
                    enabled: false,
                })),
                set: jest.fn(() => Promise.resolve({
                    supported: true,
                    enabled: true,
                })),
            },
        };
        const ctx = {
            desktopTrayAvailable: true,
            desktopSettingsAvailable: true,
            desktopCloseToTray: true,
            desktopSpellcheck: true,
            desktopAutoLaunchAvailable: false,
            desktopAutoLaunch: false,
        };

        await AppSettings.methods.loadDesktopSettings.call(ctx);
        expect(ctx.desktopCloseToTray).toBe(false);
        expect(ctx.desktopSpellcheck).toBe(false);
        expect(ctx.desktopAutoLaunchAvailable).toBe(true);
        expect(ctx.desktopAutoLaunch).toBe(false);

        ctx.desktopCloseToTray = true;
        await AppSettings.methods.saveDesktopCloseToTray.call(ctx);
        expect(window.kiwiDesktop.settings.set).toHaveBeenCalledWith({
            closeToTray: true,
        });

        ctx.desktopSpellcheck = true;
        await AppSettings.methods.saveDesktopSpellcheck.call(ctx);
        expect(window.kiwiDesktop.settings.set).toHaveBeenCalledWith({
            spellcheck: true,
        });

        ctx.desktopAutoLaunch = true;
        await AppSettings.methods.saveDesktopAutoLaunch.call(ctx);
        expect(window.kiwiDesktop.autoLaunch.set).toHaveBeenCalledWith(true);
        expect(ctx.desktopAutoLaunch).toBe(true);
    });

    it('defaults grouped nicklists off and binds the setting', () => {
        expect(s.setting('nicklistGrouped')).toBe(false);
        expect(getComputed('settingNicklistGrouped')).toBe(false);

        setComputed('settingNicklistGrouped', true);

        expect(s.setting('nicklistGrouped')).toBe(true);
        expect(getComputed('settingNicklistGrouped')).toBe(true);
    });

    it.each(bindings)('binds %s to buffers.%s', (computedName, key, value) => {
        expect(getComputed(computedName)).toBe(s.setting('buffers.' + key));

        setComputed(computedName, value);

        expect(s.setting('buffers.' + key)).toBe(value);
        expect(getComputed(computedName)).toBe(value);
    });

    it('binds avatar settings', () => {
        expect(getComputed('settingAvatarFallbackStyle')).toBe(LOCAL_IDENTICON);
        expect(getComputed('settingAvatarFallbackUrl')).toBe('');
        expect(getComputed('settingAvatarShowImageBackground')).toBe(true);
        expect(getComputed('settingAvatarShowWithoutUser')).toBe(true);
        expect(getComputed('settingAvatarAwayStatusPosition')).toBe(2);

        setComputed('settingAvatarFallbackUrl', 'https://example.com/{nickname}');
        setComputed('settingAvatarShowImageBackground', false);
        setComputed('settingAvatarShowWithoutUser', false);
        setComputed('settingAvatarAwayStatusPosition', 3);

        expect(s.setting('avatars.fallback_avatar_url'))
            .toBe('https://example.com/{nickname}');
        expect(s.setting('avatars.show_image_background')).toBe(false);
        expect(s.setting('avatars.show_without_user')).toBe(false);
        expect(s.setting('avatars.away_status_position')).toBe(3);
    });

    it('writes the DiceBear URL when a remote style is selected', () => {
        setComputed('settingAvatarFallbackStyle', 'dicebear-bottts');

        expect(s.setting('avatars.fallback_style')).toBe('dicebear-bottts');
        expect(s.setting('avatars.fallback_avatar_url'))
            .toBe(DICEBEAR_FALLBACK_URLS['dicebear-bottts']);
        expect(getComputed('settingAvatarFallbackStyle')).toBe('dicebear-bottts');
    });

    it('clears the URL for local identicons', () => {
        s.setting(
            'avatars.fallback_avatar_url',
            DICEBEAR_FALLBACK_URLS['dicebear-identicon']
        );

        setComputed('settingAvatarFallbackStyle', LOCAL_IDENTICON);

        expect(s.setting('avatars.fallback_style')).toBe(LOCAL_IDENTICON);
        expect(s.setting('avatars.fallback_avatar_url')).toBe('');
    });

    it('keeps the URL editable for custom fallbacks', () => {
        s.setting('avatars.fallback_avatar_url', 'https://example.com/{nickname}');

        setComputed('settingAvatarFallbackStyle', CUSTOM_AVATAR_STYLE);

        expect(s.setting('avatars.fallback_style')).toBe(CUSTOM_AVATAR_STYLE);
        expect(s.setting('avatars.fallback_avatar_url'))
            .toBe('https://example.com/{nickname}');
    });

    it('infers the fallback style from an existing URL', () => {
        s.setting(
            'avatars.fallback_avatar_url',
            DICEBEAR_FALLBACK_URLS['dicebear-bottts']
        );

        expect(getComputed('settingAvatarFallbackStyle')).toBe('dicebear-bottts');
    });

    it('falls back cleanly when the stored style was removed', () => {
        s.setting('avatars.fallback_style', 'dicebear-rings');
        s.setting(
            'avatars.fallback_avatar_url',
            'https://api.dicebear.com/10.x/rings/svg?seed={nickname}'
        );

        expect(getComputed('settingAvatarFallbackStyle')).toBe(CUSTOM_AVATAR_STYLE);

        s.setting('avatars.fallback_avatar_url', '');
        expect(getComputed('settingAvatarFallbackStyle')).toBe(LOCAL_IDENTICON);
    });
});
