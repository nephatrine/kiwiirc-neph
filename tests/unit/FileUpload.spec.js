import {
    acceptUploadUrl,
    basicAuthorization,
    effectiveRetention,
    effectiveService,
    filehostAvailable,
    filehostSupported,
    filehostUploadUrl,
    resolveUploadLocation,
    retentionFor,
    serviceFromId,
    services
} from '@/libs/fileupload';
import { filehostCredentials } from '@/libs/fileupload/filehost';

const { TextEncoder } = require('util');

global.TextEncoder = TextEncoder;

describe('fileupload', () => {
    test('resolves known services and treats none as disabled', () => {
        expect(serviceFromId('litterbox')).toBe(services.litterbox);
        expect(serviceFromId('none')).toBe(null);
        expect(serviceFromId('')).toBe(null);
        expect(serviceFromId(undefined)).toBe(null);
        expect(serviceFromId('missing')).toBe(null);
    });

    test('marks only non-ephemeral services as persistent', () => {
        expect(services.filehost.persistent).toBe(true);
        expect(services.litterbox.persistent).toBeFalsy();
    });

    test('falls back to the default retention', () => {
        let service = services.litterbox;
        expect(retentionFor(service, '1h')).toBe('1h');
        expect(retentionFor(service, '12h')).toBe('12h');
        expect(retentionFor(service, '24h')).toBe('24h');
        expect(retentionFor(service, '72h')).toBe('72h');
        expect(retentionFor(service, 'never')).toBe('72h');
        expect(retentionFor(service, '')).toBe('72h');
        expect(retentionFor(null, '1h')).toBe('');
    });

    test('accepts only http and https upload urls', () => {
        expect(acceptUploadUrl('https://litter.catbox.moe/abc')).toBe('https://litter.catbox.moe/abc');
        expect(acceptUploadUrl('  http://example.com/a  ')).toBe('http://example.com/a');
        expect(acceptUploadUrl('https://example.com/a\nb')).toBe('https://example.com/ab');
        expect(acceptUploadUrl(['java', 'script:alert(1)'].join(''))).toBe('');
        expect(acceptUploadUrl('data:text/html,hi')).toBe('');
        expect(acceptUploadUrl('/relative')).toBe('');
        expect(acceptUploadUrl('https://user:pass@example.com/a')).toBe('');
        expect(acceptUploadUrl('')).toBe('');
        expect(acceptUploadUrl(null)).toBe('');
    });

    test('prefers draft/FILEHOST and rejects http on tls', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
            'SOJU.IM/FILEHOST': 'https://soju.example/upload',
        });
        expect(filehostUploadUrl(network)).toBe('https://draft.example/upload');

        network = filehostNetwork({
            'DRAFT/FILEHOST': true,
            'SOJU.IM/FILEHOST': 'https://soju.example/upload',
        });
        expect(filehostUploadUrl(network)).toBe('https://soju.example/upload');

        network = filehostNetwork({
            'DRAFT/FILEHOST': 'http://draft.example/upload',
            'SOJU.IM/FILEHOST': 'https://soju.example/upload',
        }, true);
        expect(filehostUploadUrl(network)).toBe('https://soju.example/upload');

        network = filehostNetwork({
            'DRAFT/FILEHOST': 'http://draft.example/upload',
        }, true);
        expect(filehostUploadUrl(network)).toBe('');

        network = filehostNetwork({
            'SOJU.IM/FILEHOST': 'http://soju.example/upload',
        }, false);
        expect(filehostUploadUrl(network)).toBe('http://soju.example/upload');
    });

    test('resolves a relative FILEHOST Location', () => {
        expect(resolveUploadLocation(
            'https://uploads.example/upload',
            '/upload/hoh5eFThae4e.jpeg'
        )).toBe('https://uploads.example/upload/hoh5eFThae4e.jpeg');
        expect(resolveUploadLocation(
            'https://uploads.example/upload',
            'https://files.example/a.jpeg'
        )).toBe('https://files.example/a.jpeg');
        expect(resolveUploadLocation('https://uploads.example/upload', '')).toBe('');
    });

    test('ignores pre-bind bouncer FILEHOST tokens', () => {
        let network = filehostNetwork({});
        network.bouncer_isupport = {
            'SOJU.IM/FILEHOST': 'https://bound.example/upload',
        };

        expect(filehostUploadUrl(network)).toBe('');
    });

    test('strips SASL account suffixes for FILEHOST credentials', () => {
        let network = filehostNetwork({});
        network.sasl_account = 'USER/NETWORK@CLIENT';
        network.password = 'secret';

        expect(filehostCredentials(network)).toEqual({
            account: 'USER',
            password: 'secret',
        });
    });

    test('prefers FILEHOST when enabled and available', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
        });
        let state = {
            setting(name) {
                return name === 'fileupload.service' ? 'litterbox' : undefined;
            },
        };

        expect(filehostSupported(network)).toBe(true);
        expect(effectiveService(state, network)).toBe(services.filehost);

        network.setting = (name) => (
            name === 'useFilehost' ? false : undefined
        );
        expect(effectiveService(state, network)).toBe(services.litterbox);
    });

    test('requires SASL credentials before FILEHOST is used', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
        });
        let state = {
            setting() {
                return 'none';
            },
        };
        expect(filehostAvailable(network)).toBe(true);
        expect(effectiveService(state, network)).toBe(services.filehost);

        network.sasl_account = '';
        expect(filehostAvailable(network)).toBe(false);
        expect(effectiveService(state, network)).toBe(null);

        network.sasl_account = 'alice';
        network.password = '';
        expect(filehostAvailable(network)).toBe(false);
        expect(effectiveService(state, network)).toBe(null);
    });

    test('uses the global service and retention when FILEHOST is disabled', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
        });
        network.setting = (name) => (
            name === 'useFilehost' ? false : undefined
        );
        let state = {
            setting(name) {
                if (name === 'fileupload.service') {
                    return 'litterbox';
                }
                if (name === 'fileupload.litterbox.retention') {
                    return '24h';
                }
                return undefined;
            },
        };

        expect(effectiveService(state, network)).toBe(services.litterbox);
        expect(effectiveRetention(state, services.litterbox)).toBe('24h');
    });

    test('ignores a legacy global FILEHOST preference', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
        });
        network.setting = (name) => (
            name === 'useFilehost' ? false : undefined
        );
        let state = {
            setting(name) {
                return name === 'fileupload.service' ? 'filehost' : undefined;
            },
        };

        expect(effectiveService(state, network)).toBe(null);
    });

    test('detects FILEHOST support without credentials', () => {
        let network = filehostNetwork({
            'DRAFT/FILEHOST': 'https://draft.example/upload',
        });
        network.sasl_account = '';
        network.password = '';

        expect(filehostSupported(network)).toBe(true);
        expect(filehostAvailable(network)).toBe(false);
    });

    test('encodes FILEHOST basic auth', () => {
        expect(basicAuthorization('alice', 'secret')).toBe('Basic YWxpY2U6c2VjcmV0');
    });
});

function filehostNetwork(isupport, tls) {
    return {
        connection: { tls: !!tls },
        sasl_account: 'alice',
        password: 'secret',
        supports(name) {
            return isupport[name.toUpperCase()];
        },
    };
}
