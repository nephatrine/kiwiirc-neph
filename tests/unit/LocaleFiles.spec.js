import fs from 'fs';
import path from 'path';
import autocompleteCommands from '@/res/autocompleteCommands';

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
