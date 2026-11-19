import * as Utils from '@/helpers/Utils';
import { hash32 } from '@/helpers/MurmurHash3';
import { v4Source, v6Source } from '@/helpers/IpRegex';

describe('Utils.getPath', () => {
    const obj = { a: { b: { c: 5 } }, arr: [{ x: 1 }, { x: 2 }] };

    test('reads dotted and array paths and returns undefined for missing paths', () => {
        expect(Utils.getPath(obj, 'a.b.c')).toBe(5);
        expect(Utils.getPath(obj, 'arr.1.x')).toBe(2);
        expect(Utils.getPath(obj, ['a', 'b', 'c'])).toBe(5);
        expect(Utils.getPath(obj, ['arr', '0', 'x'])).toBe(1);
        expect(Utils.getPath(obj, 'a.x.y')).toBeUndefined();
        expect(Utils.getPath(obj, 'a.b.c.d')).toBeUndefined();
        expect(Utils.getPath(null, 'a')).toBeUndefined();
    });
});

describe('Utils.setPath', () => {
    test('creates nested objects and arrays and replaces intermediates', () => {
        let obj = {};
        expect(Utils.setPath(obj, 'a.b.c', 42)).toBe(obj);
        expect(obj).toEqual({ a: { b: { c: 42 } } });

        obj = {};
        Utils.setPath(obj, 'x.y.z', 1);
        expect(obj).toEqual({ x: { y: { z: 1 } } });

        obj = {};
        Utils.setPath(obj, ['list', '0', 'name'], 'bob');
        expect(obj).toEqual({ list: [{ name: 'bob' }] });

        obj = { a: 5 };
        Utils.setPath(obj, ['a', 'b', 'c'], 1);
        expect(obj).toEqual({ a: { b: { c: 1 } } });
    });
});

describe('Utils.find / findIndex / filter / each', () => {
    const users = [
        { nick: 'bob', admin: false },
        { nick: 'amy', admin: true },
        { nick: 'sam', admin: false },
    ];

    test('find matches with every shorthand', () => {
        expect(Utils.find(users, (user) => user.nick === 'amy')).toEqual(users[1]);
        expect(Utils.find(users, 'admin')).toEqual(users[1]);
        expect(Utils.find(users, ['nick', 'sam'])).toEqual(users[2]);
        expect(Utils.find(users, { admin: true })).toEqual(users[1]);
        expect(Utils.find(users, ['nick', 'nobody'])).toBeUndefined();

        const networks = { n1: { id: 1 }, n2: { id: 2 } };
        expect(Utils.find(networks, ['id', 2])).toEqual({ id: 2 });
        expect(Utils.find(networks, { id: 1 })).toEqual({ id: 1 });
        expect(Utils.find(networks, { id: 9 })).toBeUndefined();
    });

    test('findIndex matches with every shorthand', () => {
        expect(Utils.findIndex(users, ['nick', 'sam'])).toBe(2);
        expect(Utils.findIndex(users, 'admin')).toBe(1);
        expect(Utils.findIndex(users, (user) => user.nick === 'bob')).toBe(0);
        expect(Utils.findIndex(users, ['nick', 'none'])).toBe(-1);
    });

    test('filter works on arrays and objects', () => {
        expect(Utils.filter(users, { admin: false })).toEqual([users[0], users[2]]);
        expect(Utils.filter({ a: 1, b: 2, c: 3 }, (value) => value > 1)).toEqual([2, 3]);
    });

    test('each iterates arrays and objects', () => {
        let seen = [];
        Utils.each(users, (user, index) => seen.push([index, user.nick]));
        expect(seen).toEqual([[0, 'bob'], [1, 'amy'], [2, 'sam']]);

        let seenObject = {};
        Utils.each({ a: 1, b: 2 }, (value, key) => {
            seenObject[key] = value;
        });
        expect(seenObject).toEqual({ a: 1, b: 2 });
    });

    test('each stops early when the callback returns false', () => {
        let count = 0;
        Utils.each([1, 2, 3, 4], () => {
            count++;
            return count < 2;
        });
        expect(count).toBe(2);
    });
});

describe('Utils.escapeHtml', () => {
    test('escapes HTML characters and leaves safe values untouched', () => {
        expect(Utils.escapeHtml('a & b')).toBe('a &amp; b');
        expect(Utils.escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
        expect(Utils.escapeHtml('it\'s')).toBe('it&#39;s');
        expect(Utils.escapeHtml('plain text')).toBe('plain text');
        expect(Utils.escapeHtml(0)).toBe('0');
        expect(Utils.escapeHtml(null)).toBe('');
        expect(Utils.escapeHtml(undefined)).toBe('');
    });
});

describe('Utils.escapeRegExp', () => {
    test('escapes regular expression characters', () => {
        expect(Utils.escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
        expect(Utils.escapeRegExp('(x)[y]{z}')).toBe('\\(x\\)\\[y\\]\\{z\\}');
        expect(Utils.escapeRegExp('plain')).toBe('plain');
    });
});

describe('Utils.trim', () => {
    test('trims whitespace or the given characters', () => {
        expect(Utils.trim('  hi  ')).toBe('hi');
        expect(Utils.trim('\n hi \t')).toBe('hi');
        expect(Utils.trim(null)).toBe('');
        expect(Utils.trim('.,!hi!,.', '.,!')).toBe('hi');
        expect(Utils.trim('))nick((', '()')).toBe('nick');
        expect(Utils.trim('no-trim', '.,!')).toBe('no-trim');
    });
});

describe('Utils.sortBy / orderBy', () => {
    const list = [
        { name: 'b', n: 3 },
        { name: 'a', n: 1 },
        { name: 'c', n: 2 },
        { name: 'a', n: 4 },
    ];

    test('sortBy sorts ascending, is stable, and returns a new array', () => {
        expect(Utils.sortBy(list, 'n').map((item) => item.n)).toEqual([1, 2, 3, 4]);
        expect(Utils.sortBy(list, 'name').map((item) => item.name)).toEqual(['a', 'a', 'b', 'c']);
        expect(Utils.sortBy(list, 'name').map((item) => item.n)).toEqual([1, 4, 3, 2]);

        let sorted = Utils.sortBy(list, 'n');
        expect(sorted).not.toBe(list);
        expect(list[0].n).toBe(3);
    });

    test('orderBy supports per-field directions', () => {
        expect(Utils.orderBy(list, ['name', 'n'], ['asc', 'desc']).map((item) => item.n))
            .toEqual([4, 1, 3, 2]);
        expect(Utils.orderBy(list, ['n'], ['desc']).map((item) => item.n)).toEqual([4, 3, 2, 1]);
    });
});

describe('Utils.deepClone', () => {
    test('clones nested structures, primitives, and dates', () => {
        const sample = { a: 1, b: [1, 2, { c: 3 }], d: { e: { f: 'g' } } };
        const copy = Utils.deepClone(sample);
        expect(copy).toStrictEqual(sample);
        expect(copy).not.toBe(sample);
        expect(copy.b).not.toBe(sample.b);
        expect(copy.b[2]).not.toBe(sample.b[2]);
        expect(copy.d.e).not.toBe(sample.d.e);

        expect(Utils.deepClone(5)).toBe(5);
        expect(Utils.deepClone(null)).toBeNull();
        expect(Utils.deepClone('x')).toBe('x');

        const date = new Date(1000);
        const dateCopy = Utils.deepClone(date);
        expect(dateCopy).not.toBe(date);
        expect(dateCopy.getTime()).toBe(1000);
    });
});

describe('Utils.toTimestamp', () => {
    test('converts supported values and falls back to zero', () => {
        expect(Utils.toTimestamp(1234)).toBe(1234);
        expect(Utils.toTimestamp('5678')).toBe(5678);
        expect(Utils.toTimestamp(new Date(91011))).toBe(91011);
        expect(Utils.toTimestamp('2026-11-10T20:06:05.166Z'))
            .toBe(Date.parse('2026-11-10T20:06:05.166Z'));
        expect(Utils.toTimestamp()).toBe(0);
        expect(Utils.toTimestamp(null)).toBe(0);
        expect(Utils.toTimestamp('')).toBe(0);
        expect(Utils.toTimestamp('not a date')).toBe(0);
        expect(Utils.toTimestamp(new Date('invalid'))).toBe(0);
    });
});

describe('Utils.isPlainObject', () => {
    test('identifies plain objects and rejects other values', () => {
        expect(Utils.isPlainObject({})).toBe(true);
        expect(Utils.isPlainObject({ a: 1 })).toBe(true);
        expect(Utils.isPlainObject(Object.create(null))).toBe(true);
        expect(Utils.isPlainObject([])).toBe(false);
        expect(Utils.isPlainObject(null)).toBe(false);
        expect(Utils.isPlainObject(1)).toBe(false);
        expect(Utils.isPlainObject('x')).toBe(false);
        expect(Utils.isPlainObject(new Date())).toBe(false);
        expect(Utils.isPlainObject(() => {})).toBe(false);
    });
});

describe('IpRegex', () => {
    test('matches and rejects IPv4 addresses', () => {
        const v4 = new RegExp('^' + v4Source + '$');

        ['0.0.0.0', '127.0.0.1', '192.168.1.1', '255.255.255.255', '8.8.8.8'].forEach((ip) => {
            expect(v4.test(ip)).toBe(true);
        });

        ['256.0.0.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', '1.2.3.256'].forEach((ip) => {
            expect(v4.test(ip)).toBe(false);
        });
    });

    test('matches and rejects IPv6 addresses', () => {
        const v6 = new RegExp('^' + v6Source + '$');

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

        ['notanip', '12345::', ':::1', 'g::1', '1.2.3.4'].forEach((ip) => {
            expect(v6.test(ip)).toBe(false);
        });
    });
});

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
