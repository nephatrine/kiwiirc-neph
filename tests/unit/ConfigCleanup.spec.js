import { configTemplates } from '@/res/configTemplates';

const deadTextFormats = [
    'channel_badpassword',
    'channel_banned',
    'channel_badkey',
    'channel_inviteonly',
    'channel_alreadyin',
    'channel_limitreached',
    'channel_invalid_name',
    'channel_topic_setby',
    'channel_has_been_invited',
    'server_connecting',
    'server_connecting_error',
    'selfmode',
    'network_disconnected',
    'network_connected',
    'whois_channels',
    'whois_idle_and_signon',
    'whois_away',
    'whois_server',
    'whois_idle',
    'whois_notfound',
    'applet_notfound',
    'encoding_changed',
    'encoding_invalid',
    'settings_saved',
    'ignore_title',
    'ignore_none',
    'ignore_nick',
    'ignore_stop_notice',
    'ignore_stopped',
    'chanop_privs_needed',
    'no_such_nick',
    'unknown_command',
    'whois_ident',
    'whois',
    'who',
    'quit',
    'rejoin',
    'set_setting',
    'list_aliases',
    'ignored_pattern',
    'message_nick',
];

describe('dead legacy config cleanup', () => {
    test('does not define removed buffer options or unused text formats', () => {
        expect(configTemplates.default.buffers).not.toHaveProperty('ignore_bots');
        expect(configTemplates.default.buffers).not.toHaveProperty('auto_request_history');
        expect(configTemplates.default.buffers).not.toHaveProperty('mute_sound');
        expect(configTemplates.default.buffers).not.toHaveProperty('hide_message_counts');

        deadTextFormats.forEach((key) => {
            expect(configTemplates.default.textFormats).not.toHaveProperty(key);
        });
    });
});
