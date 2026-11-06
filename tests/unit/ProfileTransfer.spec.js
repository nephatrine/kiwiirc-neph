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
    it('exports state without passwords by default', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s);

        expect(bundle.format).toBe('kiwi-profile');
        expect(bundle.version).toBe(1);
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toBeUndefined();
    });

    it('exports passwords separately when requested', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
            source: 'desktop',
        });

        expect(bundle.source).toBe('desktop');
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
    });

    it('omits passwords for networks with rememberPassword disabled', () => {
        const { s, network } = makeState();
        network.setting('rememberPassword', false);

        expect(collectProfileSecrets(s)).toEqual({});
    });

    it('strips legacy passwords from imported state', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s);
        bundle.state.networks[0].password = 'legacy-sasl';
        bundle.state.networks[0].connection.password = 'legacy-server';

        const validated = validateProfileBundle(bundle);

        expect(validated.state.networks[0].password).toBe('');
        expect(validated.state.networks[0].connection.password).toBe('');
    });

    it('imports state and applies matching secrets', () => {
        const { s } = makeState();
        const bundle = buildProfileBundle(s, {
            includePasswords: true,
            secrets: collectProfileSecrets(s),
        });

        const imported = state.create();
        imported.settings.startupOptions = {};
        const result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(1);
        expect(imported.networks[0].name).toBe('ProfileNet');
        expect(imported.networks[0].connection.password).toBe('server-secret');
        expect(imported.networks[0].password).toBe('sasl-secret');
        expect(imported.networks[0].connection.account).toBe('ProfileAccount');
    });

    it('does not apply secrets to a network that opted out', () => {
        const { s, network } = makeState();
        network.setting('rememberPassword', false);
        const bundle = buildProfileBundle(s, {
            includePasswords: true,
            secrets: {
                1: {
                    connection: 'server-secret',
                    sasl: 'sasl-secret',
                },
            },
        });
        bundle.state.networks[0].settings.rememberPassword = false;

        const imported = state.create();
        imported.settings.startupOptions = {};
        const result = applyProfileBundle(imported, bundle);

        expect(result.appliedSecrets).toBe(0);
        expect(imported.networks[0].connection.password).toBe('');
        expect(imported.networks[0].password).toBe('');
    });

    it('rejects invalid profile data', () => {
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
});
