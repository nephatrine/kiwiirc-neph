import * as Utils from '@/helpers/Utils';

describe('Utils.getPath', () => {
    const obj = { a: { b: { c: 5 } }, arr: [{ x: 1 }, { x: 2 }] };

    test('reads dotted paths', () => {
        expect(Utils.getPath(obj, 'a.b.c')).toBe(5);
        expect(Utils.getPath(obj, 'arr.1.x')).toBe(2);
    });

    test('reads array paths', () => {
        expect(Utils.getPath(obj, ['a', 'b', 'c'])).toBe(5);
        expect(Utils.getPath(obj, ['arr', '0', 'x'])).toBe(1);
    });

    test('returns undefined for missing paths', () => {
        expect(Utils.getPath(obj, 'a.x.y')).toBeUndefined();
        expect(Utils.getPath(obj, 'a.b.c.d')).toBeUndefined();
        expect(Utils.getPath(null, 'a')).toBeUndefined();
    });
});

describe('Utils.setPath', () => {
    test('creates missing objects', () => {
        let obj = {};
        Utils.setPath(obj, ['a', 'b', 'c'], 42);
        expect(obj).toEqual({ a: { b: { c: 42 } } });
    });

    test('creates nested keys from a dotted string', () => {
        let obj = {};
        Utils.setPath(obj, 'x.y.z', 1);
        expect(obj).toEqual({ x: { y: { z: 1 } } });
    });

    test('creates arrays for numeric keys', () => {
        let obj = {};
        Utils.setPath(obj, ['list', '0', 'name'], 'bob');
        expect(obj).toEqual({ list: [{ name: 'bob' }] });
    });

    test('returns the original object', () => {
        let obj = {};
        expect(Utils.setPath(obj, 'a', 1)).toBe(obj);
    });

    test('replaces non-object intermediates', () => {
        let obj = { a: 5 };
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
    });

    test('find works on objects', () => {
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
    test('escapes the HTML characters', () => {
        expect(Utils.escapeHtml('a & b')).toBe('a &amp; b');
        expect(Utils.escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
        expect(Utils.escapeHtml('it\'s')).toBe('it&#39;s');
    });

    test('leaves safe strings untouched', () => {
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
    test('trims whitespace by default', () => {
        expect(Utils.trim('  hi  ')).toBe('hi');
        expect(Utils.trim('\n hi \t')).toBe('hi');
        expect(Utils.trim(null)).toBe('');
    });

    test('trims the given characters', () => {
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

    test('sortBy sorts ascending and is stable', () => {
        expect(Utils.sortBy(list, 'n').map((item) => item.n)).toEqual([1, 2, 3, 4]);
        expect(Utils.sortBy(list, 'name').map((item) => item.name)).toEqual(['a', 'a', 'b', 'c']);
        expect(Utils.sortBy(list, 'name').map((item) => item.n)).toEqual([1, 4, 3, 2]);
    });

    test('sortBy returns a new array', () => {
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
    test('clones nested arrays and objects', () => {
        const sample = { a: 1, b: [1, 2, { c: 3 }], d: { e: { f: 'g' } } };
        const copy = Utils.deepClone(sample);
        expect(copy).toStrictEqual(sample);
        expect(copy).not.toBe(sample);
        expect(copy.b).not.toBe(sample.b);
        expect(copy.b[2]).not.toBe(sample.b[2]);
        expect(copy.d.e).not.toBe(sample.d.e);
    });

    test('passes primitives through', () => {
        expect(Utils.deepClone(5)).toBe(5);
        expect(Utils.deepClone(null)).toBeNull();
        expect(Utils.deepClone('x')).toBe('x');
    });

    test('clones dates', () => {
        const date = new Date(1000);
        const copy = Utils.deepClone(date);
        expect(copy).not.toBe(date);
        expect(copy.getTime()).toBe(1000);
    });
});

describe('Utils.isPlainObject', () => {
    test('identifies plain objects', () => {
        expect(Utils.isPlainObject({})).toBe(true);
        expect(Utils.isPlainObject({ a: 1 })).toBe(true);
        expect(Utils.isPlainObject(Object.create(null))).toBe(true);
    });

    test('rejects other values', () => {
        expect(Utils.isPlainObject([])).toBe(false);
        expect(Utils.isPlainObject(null)).toBe(false);
        expect(Utils.isPlainObject(1)).toBe(false);
        expect(Utils.isPlainObject('x')).toBe(false);
        expect(Utils.isPlainObject(new Date())).toBe(false);
        expect(Utils.isPlainObject(() => {})).toBe(false);
    });
});
