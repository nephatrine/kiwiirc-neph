import state from '@/libs/state';
import {
    applyProfileBundle,
    buildProfileBundle,
    collectProfileSecrets,
    parseProfileBundleText,
    validateProfileBundle
} from '@/libs/ProfileTransfer';

function makeState() {
    const s = state.create();
    s.settings.startupOptions = {};
    const network = s.addNetwork('ProfileNet', 'ProfileNick', {
        server: 'irc.example.com',
    });
    network.password = 'sasl-secret';
    network.connection.password = 'server-secret';
    network.connection.account = 'ProfileAccount';
    return { s, network };
}

describe('Profile transfer', () => {
    it('exports state without secrets unless requested', () => {
        const { s, network } = makeState();
        const plain = buildProfileBundle(s);

        expect(plain.format).toBe('kiwi-profile');
        expect(plain.version).toBe(1);
        expect(plain.state.networks[0].password).toBe('');
        expect(plain.state.networks[0].connection.password).toBe('');
        expect(plain.secrets).toBeUndefined();

        const withPasswords = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
            source: 'desktop',
        });
        expect(withPasswords.source).toBe('desktop');
        expect(withPasswords.state.networks[0].password).toBe('');
        expect(withPasswords.state.networks[0].connection.password).toBe('');
        expect(withPasswords.secrets).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });

        network.setting('rememberPassword', false);
        expect(collectProfileSecrets(s)).toEqual({});
    });

    it('strips legacy passwords and rejects invalid profile data', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s);
        bundle.state.networks[0].password = 'legacy-sasl';
        bundle.state.networks[0].connection.password = 'legacy-server';

        const validated = validateProfileBundle(bundle);
        expect(validated.state.networks[0].password).toBe('');
        expect(validated.state.networks[0].connection.password).toBe('');

        expect(() => parseProfileBundleText('not json')).toThrow('invalid profile JSON');
        expect(() => validateProfileBundle({
            format: 'kiwi-profile',
            version: 2,
            state: { networks: [] },
        })).toThrow('unsupported profile version');
        expect(() => validateProfileBundle({
            format: 'other',
            version: 1,
            state: { networks: [] },
        })).toThrow('invalid profile format');
    });

    it('imports state and applies matching secrets unless the network opted out', () => {
        let ctx = makeState();
        let bundle = buildProfileBundle(ctx.s, {
            includePasswords: true,
            secrets: collectProfileSecrets(ctx.s),
        });

        let imported = state.create();
        imported.settings.startupOptions = {};
        let result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(1);
        expect(imported.networks[0].name).toBe('ProfileNet');
        expect(imported.networks[0].connection.password).toBe('server-secret');
        expect(imported.networks[0].password).toBe('sasl-secret');
        expect(imported.networks[0].connection.account).toBe('ProfileAccount');

        ctx = makeState();
        ctx.network.setting('rememberPassword', false);
        bundle = buildProfileBundle(ctx.s, {
            includePasswords: true,
            secrets: {
                1: {
                    connection: 'server-secret',
                    sasl: 'sasl-secret',
                },
            },
        });
        bundle.state.networks[0].settings.rememberPassword = false;

        imported = state.create();
        imported.settings.startupOptions = {};
        result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(0);
        expect(imported.networks[0].connection.password).toBe('');
        expect(imported.networks[0].password).toBe('');
    });

    it('protects the WebDAV password in profile exports', () => {
        const { s } = makeState();
        s.setting('fileupload.webdav.password', 'webdav-secret');

        const plain = buildProfileBundle(s);
        expect(plain.state.user_settings.fileupload.webdav.password).toBeUndefined();
        expect(plain.secrets).toBeUndefined();

        const withPasswords = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
        });
        expect(withPasswords.state.user_settings.fileupload.webdav.password)
            .toBeUndefined();
        expect(withPasswords.secrets.fileupload).toEqual({
            webdavPassword: 'webdav-secret',
        });

        const imported = state.create();
        imported.settings.startupOptions = {};
        applyProfileBundle(imported, withPasswords);
        expect(imported.setting('fileupload.webdav.password'))
            .toBe('webdav-secret');
        expect(JSON.parse(imported.exportState(true)).user_settings
            .fileupload.webdav.password).toBeUndefined();
    });
});
