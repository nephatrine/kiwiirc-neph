import {
    isPrivateAddress,
    pinnedLookup,
    resolveTarget,
    validateHttpUrl
} from '../../desktop/electron/http-policy';
import { buildMultipart } from '../../desktop/electron/http';

describe('Desktop HTTP policy', () => {
    it('rejects non-HTTP URLs and URL credentials', () => {
        expect(() => validateHttpUrl('file:///etc/passwd')).toThrow();
        expect(() => validateHttpUrl('data:text/plain,hello')).toThrow();
        expect(() => validateHttpUrl('https://user:pass@example.com/')).toThrow();
    });

    it('recognizes private and reserved addresses', () => {
        expect(isPrivateAddress('127.0.0.1')).toBe(true);
        expect(isPrivateAddress('10.1.2.3')).toBe(true);
        expect(isPrivateAddress('172.16.0.1')).toBe(true);
        expect(isPrivateAddress('192.168.1.1')).toBe(true);
        expect(isPrivateAddress('169.254.1.1')).toBe(true);
        expect(isPrivateAddress('100.64.0.1')).toBe(true);
        expect(isPrivateAddress('::1')).toBe(true);
        expect(isPrivateAddress('fc00::1')).toBe(true);
        expect(isPrivateAddress('fe80::1')).toBe(true);
        expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
        expect(isPrivateAddress('93.184.216.34')).toBe(false);
    });

    it('rejects a hostname that resolves to a private address by default', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '10.0.0.5', family: 4 },
        ]);

        await expect(resolveTarget('https://example.test/', false, lookup))
            .rejects.toThrow('private network access is disabled');
    });

    it('allows a hostname that resolves to a private address when opted in', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '10.0.0.5', family: 4 },
        ]);

        const target = await resolveTarget('https://example.test/', true, lookup);

        expect(target.address).toBe('10.0.0.5');
        expect(target.family).toBe(4);
    });

    it('rejects mixed public and private DNS results by default', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
            { address: '192.168.0.5', family: 4 },
        ]);

        await expect(resolveTarget('https://example.test/', false, lookup)).rejects.toThrow();
    });

    it('supports the all-address lookup form used by newer Node runtimes', () => {
        const lookup = pinnedLookup([
            { address: '2001:db8::1', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ]);
        const done = jest.fn();

        lookup('example.test', { all: true }, done);

        expect(done).toHaveBeenCalledWith(null, [
            { address: '2001:db8::1', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ]);
    });

    it('supports the single-address lookup form', () => {
        const lookup = pinnedLookup('93.184.216.34', 4);
        const done = jest.fn();

        lookup('example.test', {}, done);

        expect(done).toHaveBeenCalledWith(null, '93.184.216.34', 4);
    });

    it('builds a multipart body with fields and a file', () => {
        const result = buildMultipart(
            { reqtype: 'fileupload', time: '72h' },
            {
                name: 'test.txt',
                type: 'text/plain',
                data: Buffer.from('hello'),
            }
        );

        expect(result.contentType).toContain('multipart/form-data; boundary=');
        expect(result.body.toString()).toContain('name="reqtype"');
        expect(result.body.toString()).toContain('name="time"');
        expect(result.body.toString()).toContain('filename="test.txt"');
        expect(result.body.toString()).toContain('hello');
    });
});
