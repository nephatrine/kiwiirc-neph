import { v4Source, v6Source } from '@/helpers/IpRegex';

describe('IpRegex', () => {
    describe('v4Source', () => {
        const v4 = new RegExp('^' + v4Source + '$');

        test('matches valid IPv4 addresses', () => {
            ['0.0.0.0', '127.0.0.1', '192.168.1.1', '255.255.255.255', '8.8.8.8'].forEach((ip) => {
                expect(v4.test(ip)).toBe(true);
            });
        });

        test('rejects invalid IPv4 addresses', () => {
            ['256.0.0.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', '1.2.3.256'].forEach((ip) => {
                expect(v4.test(ip)).toBe(false);
            });
        });
    });

    describe('v6Source', () => {
        const v6 = new RegExp('^' + v6Source + '$');

        test('matches valid IPv6 addresses', () => {
            [
                '::1',
                '::',
                '2001:db8::1',
                'fe80::1',
                '2001:0db8:0000:0000:0000:0000:0000:0001',
                '::ffff:192.168.1.1',
                '2001:db8::7%eth0',
            ].forEach((ip) => {
                expect(v6.test(ip)).toBe(true);
            });
        });

        test('rejects invalid IPv6 addresses', () => {
            ['notanip', '12345::', ':::1', 'g::1', '1.2.3.4'].forEach((ip) => {
                expect(v6.test(ip)).toBe(false);
            });
        });
    });
});
