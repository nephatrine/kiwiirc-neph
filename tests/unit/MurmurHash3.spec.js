import { hash32 } from '@/helpers/MurmurHash3';

describe('MurmurHash3.hash32', () => {
    test('hashes known inputs, multi-block data, and seeds', () => {
        const known = {
            '': 0,
            'a': 1009084850,
            'ab': 2613040991,
            'abc': 3017643002,
            'abcd': 1139631978,
            'abcde': 3902511862,
            'foo': 4138058784,
            'bar': 1158584717,
            'nick': 1833562727,
            'JohnDoe': 4256835724,
            'test123': 2983061069,
            'Kiwi IRC': 2463734224,
        };

        Object.keys(known).forEach((input) => {
            expect(hash32(input)).toBe(known[input]);
        });

        // 100 chars exercises the block loop and the remainder switch.
        expect(hash32('x'.repeat(100))).toBe(2625171602);

        const value = hash32('some longer string that covers several blocks');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffffff);

        expect(hash32('foo', 1)).not.toBe(hash32('foo'));
    });

    test('treats missing input as an empty string', () => {
        expect(hash32()).toBe(0);
        expect(hash32('', 0)).toBe(0);
    });
});
