import fs from 'fs';
import path from 'path';
import autocompleteCommands from '@/res/autocompleteCommands';
import { configTemplates } from '@/res/configTemplates';

const localeDir = path.join(process.cwd(), 'src/res/locales');

function readLocale(file) {
    let entries = {};
    let current = null;

    fs.readFileSync(path.join(localeDir, file), 'utf8').split('\n').forEach((line) => {
        let msgid = line.match(/^msgid "(.*)"$/);
        if (msgid) {
            current = msgid[1] === '' ? null : msgid[1];
            if (current) {
                entries[current] = '';
            }
            return;
        }

        let msgstr = line.match(/^msgstr "(.*)"$/);
        if (current && msgstr) {
            entries[current] = msgstr[1];
        }
    });

    return entries;
}

describe('locale files', () => {
    const en = readLocale('app.en-US.po');
    const dev = readLocale('app.dev.po');

    it('keeps the development locale aligned with en-US', () => {
        expect(Object.keys(dev).sort()).toEqual(Object.keys(en).sort());
        Object.keys(en).forEach((key) => {
            expect(dev[key]).toBe(en[key]);
        });

        expect(en.bot_user).toBe('bot user');
        expect(dev.bot_user).toBe('bot user');
    });

    it('contains no stale cheatsheet or orphaned settings entries', () => {
        expect(en).not.toHaveProperty('hostserv_cheatsheet_title');
        expect(dev).not.toHaveProperty('hostserv_cheatsheet_title');
        expect(en).not.toHaveProperty('histserv_cheatsheet_title');
        expect(dev).not.toHaveProperty('histserv_cheatsheet_title');

        [
            'settings_ignore_bots',
            'settings_notify_mentioned',
            'side_formatting',
            'settings_channel_defaults',
            'settings_channel_defaults_hint',
        ].forEach((key) => {
            expect(en).not.toHaveProperty(key);
            expect(dev).not.toHaveProperty(key);
        });
    });

    it('uses double-brace placeholders and translates autocomplete labels', () => {
        // The avatar hint tells the user what to type into the URL field, so its
        // single-brace placeholder is literal text and must stay that way.
        const intentional = ['settings_avatar_fallback_url_hint'];

        [en, dev].forEach((entries) => {
            Object.keys(entries).forEach((key) => {
                if (intentional.indexOf(key) > -1) {
                    return;
                }

                const singles = entries[key]
                    .replace(/\{\{[^}]*\}\}/g, '')
                    .match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];

                expect({ key, singles }).toEqual({ key, singles: [] });
            });
        });

        autocompleteCommands.forEach((command) => {
            if (command.description.indexOf('locale_id_') !== 0) {
                return;
            }

            const key = command.description.slice('locale_id_'.length);
            expect(en).toHaveProperty(key);
            expect(dev).toHaveProperty(key);
        });
    });
});

describe('dead legacy config cleanup', () => {
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
