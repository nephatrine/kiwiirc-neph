/**
 * Configuration templates
 *
 * All the default values for config options throughout kiwi are set here, under
 * the 'default' template object below.
 * If a 'default.template' value is set in the user config, this is used to
 * find the next template object below and is merged over the default config
 * template.
 * The user config (config.json by default) is then merged over the resulting
 * config object.
 *
 * The advanced settings dialog also displays these settings by iterating
 * through the keys. The values must not be null otherwise they will not be
 * shown.
 */

export const configTemplates = {

    default: {
        plugins: [],
        windowTitle: 'Kiwi IRC - The web IRC client',
        useMonospace: false,
        language: '',
        theme: 'Dark',
        google_fonts: ['Source Sans Pro:wght@400;700', 'Source Code Pro'],
        themes: [
            { name: 'Default', url: 'static/themes/default' },
            { name: 'Dark', url: 'static/themes/dark' },
            { name: 'Ayu Mirage', url: 'static/themes/ayu-mirage', google_fonts: ['Inter:wght@400;700', 'Fira Code:wght@400;700'] },
            { name: 'Ayu Dark', url: 'static/themes/ayu-dark', google_fonts: ['Inter:wght@400;700', 'Fira Code:wght@400;700'] },
            { name: 'Ayu Light', url: 'static/themes/ayu-light', google_fonts: ['Inter:wght@400;700', 'Fira Code:wght@400;700'] },
            { name: 'Catppuccin Frappe', url: 'static/themes/catppuccin-frappe', google_fonts: ['Plus Jakarta Sans:wght@400;700', 'JetBrains Mono:wght@400;700'] },
            { name: 'Catppuccin Macchiato', url: 'static/themes/catppuccin-macchiato', google_fonts: ['Plus Jakarta Sans:wght@400;700', 'JetBrains Mono:wght@400;700'] },
            { name: 'Catppuccin Mocha', url: 'static/themes/catppuccin-mocha', google_fonts: ['Plus Jakarta Sans:wght@400;700', 'JetBrains Mono:wght@400;700'] },
            { name: 'Catppuccin Latte', url: 'static/themes/catppuccin-latte', google_fonts: ['Plus Jakarta Sans:wght@400;700', 'JetBrains Mono:wght@400;700'] },
            { name: 'Coffee', url: 'static/themes/coffee' },
            { name: 'Dracula', url: 'static/themes/dracula', google_fonts: ['Rubik:wght@400;700', 'Space Mono:wght@400;700'] },
            { name: 'Everforest Dark', url: 'static/themes/everforest-dark', google_fonts: ['Outfit:wght@400;700', 'Inconsolata:wght@400;700'] },
            { name: 'Everforest Light', url: 'static/themes/everforest-light', google_fonts: ['Outfit:wght@400;700', 'Inconsolata:wght@400;700'] },
            { name: 'GitHub Dark', url: 'static/themes/github-dark', google_fonts: ['DM Sans:wght@400;700', 'Red Hat Mono:wght@400;700'] },
            { name: 'GitHub Light', url: 'static/themes/github-light', google_fonts: ['DM Sans:wght@400;700', 'Red Hat Mono:wght@400;700'] },
            { name: 'GrayFox', url: 'static/themes/grayfox' },
            { name: 'Gruvbox Dark', url: 'static/themes/gruvbox-dark', google_fonts: ['Public Sans:wght@400;700', 'IBM Plex Mono:wght@400;700'] },
            { name: 'Gruvbox Light', url: 'static/themes/gruvbox-light', google_fonts: ['Public Sans:wght@400;700', 'IBM Plex Mono:wght@400;700'] },
            { name: 'Kanagawa Wave', url: 'static/themes/kanagawa-wave', google_fonts: ['Noto Sans:wght@400;700', 'Source Code Pro:wght@400;700'] },
            { name: 'Kanagawa Dragon', url: 'static/themes/kanagawa-dragon', google_fonts: ['Noto Sans:wght@400;700', 'Source Code Pro:wght@400;700'] },
            { name: 'Kanagawa Lotus', url: 'static/themes/kanagawa-lotus', google_fonts: ['Noto Sans:wght@400;700', 'Source Code Pro:wght@400;700'] },
            { name: 'Monokai', url: 'static/themes/monokai', google_fonts: ['Albert Sans:wght@400;700', 'Ubuntu Sans Mono:wght@400;700'] },
            { name: 'NightsWatch', url: 'static/themes/nightswatch' },
            { name: 'Nord Dark', url: 'static/themes/nord-dark', google_fonts: ['Manrope:wght@400;700', 'Overpass Mono:wght@400;700'] },
            { name: 'Nord Light', url: 'static/themes/nord-light', google_fonts: ['Manrope:wght@400;700', 'Overpass Mono:wght@400;700'] },
            { name: 'One Dark', url: 'static/themes/one-dark', google_fonts: ['Work Sans:wght@400;700', 'Roboto Mono:wght@400;700'] },
            { name: 'One Light', url: 'static/themes/one-light', google_fonts: ['Work Sans:wght@400;700', 'Roboto Mono:wght@400;700'] },
            { name: 'Osprey', url: 'static/themes/osprey' },
            { name: 'Oxocarbon Dark', url: 'static/themes/oxocarbon-dark', google_fonts: ['Space Grotesk:wght@400;700', 'Azeret Mono:wght@400;700'] },
            { name: 'Oxocarbon Light', url: 'static/themes/oxocarbon-light', google_fonts: ['Space Grotesk:wght@400;700', 'Azeret Mono:wght@400;700'] },
            { name: 'Radioactive', url: 'static/themes/radioactive', google_fonts: ['Oxanium:wght@400;700', 'Share Tech Mono'] },
            { name: 'Rosé Pine', url: 'static/themes/rose-pine', google_fonts: ['Figtree:wght@400;700', 'Cousine:wght@400;700'] },
            { name: 'Rosé Pine Moon', url: 'static/themes/rose-pine-moon', google_fonts: ['Figtree:wght@400;700', 'Cousine:wght@400;700'] },
            { name: 'Rosé Pine Dawn', url: 'static/themes/rose-pine-dawn', google_fonts: ['Figtree:wght@400;700', 'Cousine:wght@400;700'] },
            { name: 'Solarized Dark', url: 'static/themes/solarized-dark', google_fonts: ['Source Sans 3:wght@400;700', 'Inconsolata:wght@400;700'] },
            { name: 'Solarized Light', url: 'static/themes/solarized-light', google_fonts: ['Source Sans 3:wght@400;700', 'Inconsolata:wght@400;700'] },
            { name: 'SynthWave \'84', url: 'static/themes/synthwave84', google_fonts: ['Rajdhani:wght@400;700', 'Share Tech Mono'] },
            { name: 'Tokyo Night', url: 'static/themes/tokyo-night', google_fonts: ['Urbanist:wght@400;700', 'Chivo Mono:wght@400;700'] },
        ],
        // Restricted to a single IRC server
        restricted: true,
        // The startup screen
        startupScreen: 'customServer',
        // Where to find the kiwi server
        kiwiServer: '/webirc/kiwiirc/',
        // If active, all connections will be routed via this BNC server. Network settings
        // will be read and updated to the BNC as they are changed.
        bnc: {
            active: false,
            server: '',
            port: 6667,
            tls: false,
            path: '',
            username: '',
            password: '',
        },
        warnOnExit: true,
        quitMessage: 'Page closed',
        // Default buffer settings
        buffers: {
            messageLayout: 'modern',
            alert_on: 'highlight',
            favorite: false,
            timestamp_format: '%H:%M:%S',
            // If timestamp_full_format is falsy, the browsers locale date format will be used
            timestamp_full_format: '',
            show_timestamps: true,
            scrollback_size: 250,
            show_hostnames: false,
            show_joinparts: true,
            show_topics: true,
            show_topic_in_header: false,
            show_nick_changes: true,
            show_mode_changes: true,
            show_presence_changes: true,
            traffic_as_activity: false,
            server_as_activity: true,
            coloured_nicklist: true,
            colour_nicknames_in_messages: true,
            block_pms: false,
            extra_formatting: true,
            mute_sound: false,
            hide_message_counts: false,
            show_realnames: false,
            default_ban_mask: '*!%i@%h',
            default_kick_reason: 'Your behaviour is not conducive to the desired environment.',
            shared_input: false,
            show_message_info: true,
            who_loop: true,
            share_typing: true,
            // flash_title: message/highlight/off
            flash_title: 'message',
            nicklist_avatars: false,
            warn_expected_command: true,
            show_link_previews: true,
            inline_link_auto_previews: true,
            inline_link_auto_previews_query: true,
            inline_link_auto_preview_whitelist: '.*',
            show_buffer_groups: true,
            // prompt_leave: all/channels/queries/none
            prompt_leave: 'channels',
            // auto_request_history: all/channels/queries/none
            auto_request_history: 'all',
            emoji_convert_as_typed: true,
            emoji_convert_incoming: true,
            ignore_bots: false,
            show_redactions: 'placeholder',
            show_notifications: true,
            lenient_rerouting: true,
        },
        avatars: {
            away_status_position: 1,
            initials_length: 1,
            show_image_background: true,
            show_without_user: false,
            fallback_avatar_url: '',
        },
        // Startup screen default
        startupOptions: {
            server: '',
            port: 6667,
            tls: false,
            channel: '',
            nick: 'kiwi_?',
            direct: false,
            state_key: 'kiwi-state',
            remember_buffers: true,
            nick_format: '',
        },
        skipHiddenMessages: false,
        autoReconnect: false,
        autoReconnectMaxWait: 30000,
        autoReconnectMaxRetries: 10,
        disconnectOnSaslFail: true,
        defaultSaslMechanism: 'AUTO',
        allowRegisterProtocolHandler: false,
        noticeActiveBuffer: true,
        nicklistGroupAway: false,
        showChanlistModes: false,
        showAutocomplete: true,
        autocompleteTokens: ['/', '#', '@'],
        forceShowEmojiPicker: false,
        showEmojiPicker: true,
        showColorPicker: false,
        showSendButton: false,
        showAwayStatusIndicators: true,
        sidebarDefault: 'nicklist',
        showRaw: false,
        useBufferHistory: true,
        changeNickOnCollision: true,
        hideSettings: null,
        highlights: '',
        teamHighlights: false,
        aliases: `
# General aliases
/p /part $1+
/me /action $destination $1+
/j /join $1+
/q /query $1+
/w /whois $1+
/raw /quote $1+
/connect /server $1+
/disconnect /quit $1+
/cycle $channel? /lines /part $channel | /join $channel
/active /back $1+
/umode /mode $nick $1+

# Op related aliases
/op /quote mode $channel +o $1+
/deop /quote mode $channel -o $1+
/hop /quote mode $channel +h $1+
/dehop /quote mode $channel -h $1+
/voice /quote mode $channel +v $1+
/devoice /quote mode $channel -v $1+
/k /kick $channel $1+
/bans /mode $channel +b
/ban /quote mode $channel +b $1+
/unban /quote mode $channel -b $1+

# Misc aliases
/slap /me slaps $1 around a bit with a large trout
/tick /msg $channel ✔`,
        embedly: {
            Key: '',
        },
        textFormats: {
            user: '%nick',
            user_full: '%nick (%username@%host)',
            channel_join: '→ %text',
            channel_part: '← %text (%reason)',
            channel_quit: '← %text (%reason)',
            channel_kicked: '← %text (%reason)',
            channel_selfkick: '× %text (%reason)',
            channel_badpassword: '× %text',
            channel_topic: 'ⓘ %text',
            channel_banned: '× %text',
            channel_badkey: '⚠ %text',
            channel_inviteonly: '⚠ %channel %text',
            channel_alreadyin: '⚠ %nick %text',
            channel_limitreached: '⚠ %channel %text',
            channel_invalid_name: '⚠ %channel %text',
            channel_topic_setby: 'ⓘ %text',
            channel_has_been_invited: 'ⓘ %nick %text',
            server_connecting: '%text',
            server_connecting_error: '%text',
            mode: 'ⓘ %text',
            selfmode: 'ⓘ %nick %text',
            nickname_alreadyinuse: '⚠ %text',
            network_disconnected: '%text',
            network_connected: '%text',
            whois_channels: '%text',
            whois_idle_and_signon: '%text',
            whois_away: '%text',
            whois_server: '%text',
            whois_idle: '%text',
            whois_notfound: 'ⓘ %text',
            nick_changed: 'ⓘ %text',
            applet_notfound: '⚠ %text',
            encoding_changed: 'ⓘ %text',
            encoding_invalid: '⚠ %text',
            settings_saved: 'ⓘ %text',
            ignore_title: '%text:',
            ignore_none: '%text',
            ignore_nick: '%text',
            ignore_stop_notice: '%text',
            ignore_stopped: '%text',
            chanop_privs_needed: '⚠ %text',
            no_such_nick: 'ⓘ %nick: %text',
            unknown_command: 'ⓘ %text',
            motd: '%text',
            ctcp_response: '[CTCP %nick reply] %message',
            ctcp_request: '[CTCP %nick] %message',
            privmsg: '%text',
            notice: '[NOTICE] %text',
            action: '* %nick %text',
            whois_ident: '%nick [%nick!%ident@%host] * %text',
            whois_error: '[%nick] %text',
            whois: '%text',
            whowas_ident: 'was [%nick!%ident@%host] * %name',
            whowas_server: 'using %server (%info)',
            whowas_error: '[%nick] %text',
            who: '%nick [%nick!%ident@%host] * %realname',
            quit: '%text',
            rejoin: '%text',
            set_setting: 'ⓘ %text',
            list_aliases: 'ⓘ %text',
            ignored_pattern: 'ⓘ %text',
            wallops: '[WALLOPS] %text',
            message_nick: '%prefix%nick',
            general_error: '⚠ %text',
        },
        fileupload: {
            service: 'none',
            litterbox: {
                retention: '72h',
            },
        },
        presetNetworks: [],
    },

    // Config template for those hardcore irc veterans
    irc: {
        showEmojiPicker: false,
        sidebarDefault: 'nicklist',
        buffers: {
            messageLayout: 'inline',
            show_hostnames: true,
            coloured_nicklist: false,
            colour_nicknames_in_messages: false,
            show_message_info: false,
            share_typing: false,
            inline_link_auto_previews: false,
        },
    },

    // Config template for working as part of a team
    team: {
        teamHighlights: true,
        buffers: {
            messageLayout: 'modern',
            show_joinparts: false,
            show_nick_changes: true,
            show_mode_changes: true,
            show_realnames: true,
        },
    },

};
