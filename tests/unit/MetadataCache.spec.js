import {
    clear,
    flush,
    load,
    paintBuffer,
    paintUser,
    rememberChannel,
    rememberUser
} from '@/libs/MetadataCache';

const STORAGE_KEY = 'kiwi-metadata-cache';
const DAY = 24 * 60 * 60 * 1000;

function createStorage() {
    let store = {};
    return {
        store,
        get(name) {
            return Promise.resolve(store[name]);
        },
        set(name, val) {
            store[name] = val;
            return Promise.resolve();
        },
    };
}

function createNetwork() {
    return {
        nick: 'me',
        connection: {
            server: 'irc.example',
            account: 'me',
            nick: 'me',
        },
        isChannelName(input) {
            return typeof input === 'string' && '#&'.indexOf(input[0]) > -1;
        },
        buffers: [],
        users: {},
    };
}

function savedNet(storage) {
    let parsed = JSON.parse(storage.store[STORAGE_KEY]);
    return Object.values(parsed.networks)[0];
}

describe('MetadataCache', () => {
    let storage;
    let network;
    let now;

    beforeEach(async() => {
        jest.useFakeTimers();
        now = 1000000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        storage = createStorage();
        network = createNetwork();
        await load(storage);
    });

    afterEach(async() => {
        await clear();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('stores a channel display-name and not its avatar', async() => {
        rememberChannel(network, '#Chan', 'Lobby');
        await flush();

        let channels = savedNet(storage).channels;
        expect(channels['#chan']).toEqual({ name: 'Lobby', seen: now });
        expect(channels['#chan'].avatar).toBeUndefined();
    });

    test('skips an empty channel name and clear deletes the cache', async() => {
        rememberChannel(network, '#chan', 'Lobby');
        rememberChannel(network, '#chan', '   ');
        await flush();

        expect(savedNet(storage).channels['#chan']).toBeUndefined();

        await clear();
        expect(storage.store[STORAGE_KEY]).toBe(null);
    });

    test('does not store a user with neither name nor avatar', async() => {
        rememberUser(network, {
            nick: 'Alice',
            metadata: { 'display-name': 'A' },
        });
        rememberUser(network, {
            nick: 'Alice',
            metadata: {},
        });
        await flush();

        expect(savedNet(storage).users['n:ALICE']).toBeUndefined();
    });

    test('stores a user with only a name or only an avatar', async() => {
        rememberUser(network, {
            nick: 'Alice',
            metadata: { 'display-name': 'A' },
        });
        rememberUser(network, {
            nick: 'Bob',
            metadata: { avatar: 'https://cdn.example/bob.png' },
        });
        await flush();

        let users = savedNet(storage).users;
        expect(users['n:ALICE']).toEqual({ name: 'A', avatar: '', seen: now });
        expect(users['n:BOB']).toEqual({
            name: '',
            avatar: 'https://cdn.example/bob.png',
            seen: now,
        });
    });

    test('evicts the oldest user when the 101st is stored', async() => {
        for (let i = 0; i < 101; i++) {
            now = 1000 + i;
            rememberUser(network, {
                nick: 'u' + i,
                metadata: { 'display-name': 'U' + i },
            });
        }
        await flush();

        let users = savedNet(storage).users;
        expect(Object.keys(users)).toHaveLength(100);
        expect(users['n:U0']).toBeUndefined();
        expect(users['n:U100'].name).toBe('U100');
    });

    test('ignores entries older than 7 days', () => {
        rememberUser(network, {
            nick: 'Alice',
            metadata: { 'display-name': 'A' },
        });
        rememberUser(network, {
            nick: 'Bob',
            metadata: { 'display-name': 'B' },
        });
        rememberChannel(network, '#chan', 'Lobby');

        now += (6 * DAY);
        let recent = { nick: 'Alice', metadata: {}, lastMetadataFetch: 0 };
        paintUser(network, recent);
        expect(recent.metadata['display-name']).toBe('A');

        now = 1000000 + (8 * DAY);
        let expired = { nick: 'Bob', metadata: {}, lastMetadataFetch: 0 };
        let buffer = { name: '#chan', metadata: {}, lastMetadataFetch: 0 };
        paintUser(network, expired);
        paintBuffer(network, buffer);
        expect(expired.metadata['display-name']).toBeUndefined();
        expect(buffer.metadata['display-name']).toBeUndefined();
        expect(expired.lastMetadataFetch).toBe(0);
        expect(buffer.lastMetadataFetch).toBe(0);
    });

    test('moves a nick entry to the account key when the account is learned', async() => {
        rememberUser(network, {
            nick: 'Alice',
            metadata: { 'display-name': 'A', 'avatar': 'https://cdn.example/a.png' },
        });

        let user = {
            nick: 'Alice',
            account: 'alice',
            metadata: {},
            lastMetadataFetch: 0,
        };
        paintUser(network, user);
        await flush();

        let users = savedNet(storage).users;
        expect(users['n:ALICE']).toBeUndefined();
        expect(users['a:alice'].name).toBe('A');
        expect(user.metadata['display-name']).toBe('A');
        expect(user.metadata.avatar).toBe('https://cdn.example/a.png');
        expect(user.lastMetadataFetch).toBe(0);
    });

    test('does not overwrite metadata or mark a fetch when painting', () => {
        rememberUser(network, {
            nick: 'Alice',
            metadata: {
                'display-name': 'Cached',
                'avatar': 'https://cdn.example/cached.png',
            },
        });
        rememberChannel(network, '#chan', 'Cached');

        let user = {
            nick: 'Alice',
            metadata: {
                'display-name': 'Kept',
                'avatar': 'https://cdn.example/kept.png',
            },
            lastMetadataFetch: 5,
        };
        let buffer = {
            name: '#chan',
            metadata: { 'display-name': 'Kept' },
            lastMetadataFetch: 5,
        };

        paintUser(network, user);
        paintBuffer(network, buffer);

        expect(user.metadata['display-name']).toBe('Kept');
        expect(user.metadata.avatar).toBe('https://cdn.example/kept.png');
        expect(user.lastMetadataFetch).toBe(5);
        expect(buffer.metadata['display-name']).toBe('Kept');
        expect(buffer.metadata.avatar).toBeUndefined();
        expect(buffer.lastMetadataFetch).toBe(5);
    });

    test('drops the oldest half of users and retries once when storage is full', async() => {
        let calls = 0;
        storage.set = (name, val) => {
            calls += 1;
            if (name !== STORAGE_KEY) {
                return Promise.reject(new Error('unexpected key ' + name));
            }
            if (calls === 1) {
                let err = new Error('quota');
                err.name = 'QuotaExceededError';
                return Promise.reject(err);
            }
            storage.store[name] = val;
            return Promise.resolve();
        };

        for (let i = 0; i < 100; i++) {
            now = 1000 + i;
            rememberUser(network, {
                nick: 'u' + i,
                metadata: { 'display-name': 'U' + i },
            });
        }
        await flush();

        let users = savedNet(storage).users;
        expect(calls).toBe(2);
        expect(Object.keys(users)).toHaveLength(50);
        expect(users['n:U0']).toBeUndefined();
        expect(users['n:U99'].name).toBe('U99');
        expect(storage.store['kiwi-state']).toBeUndefined();
    });

    test('does not paint poisoned storage', async() => {
        rememberChannel(network, '#chan', 'Lobby');
        rememberUser(network, {
            nick: 'Alice',
            metadata: { 'display-name': 'A', 'avatar': 'https://cdn.example/a.png' },
        });
        await flush();

        let parsed = JSON.parse(storage.store[STORAGE_KEY]);
        let net = Object.values(parsed.networks)[0];
        net.channels['#chan'].name = 'ok\u0000name';
        net.channels['#chan'].avatar = 'https://evil.example/x.png';
        net.users['n:ALICE'].name = '  hi  ';
        let scheme = String.fromCharCode(106, 97, 118, 97, 115, 99, 114, 105, 112, 116);
        net.users['n:ALICE'].avatar = scheme + ':alert(1)';
        storage.store[STORAGE_KEY] = JSON.stringify(parsed);
        await load(storage);

        let buffer = { name: '#chan', metadata: {}, lastMetadataFetch: 0 };
        let user = { nick: 'Alice', metadata: {}, lastMetadataFetch: 0 };
        paintBuffer(network, buffer);
        paintUser(network, user);

        expect(buffer.metadata['display-name']).toBe('okname');
        expect(buffer.metadata.avatar).toBeUndefined();
        expect(buffer.lastMetadataFetch).toBe(0);
        expect(user.metadata['display-name']).toBe('hi');
        expect(user.metadata.avatar).toBeUndefined();
        expect(user.lastMetadataFetch).toBe(0);
    });

    test('treats bad JSON as an empty cache', async() => {
        storage.store[STORAGE_KEY] = '{no';
        await expect(load(storage)).resolves.toBeUndefined();

        let user = { nick: 'Alice', metadata: {}, lastMetadataFetch: 0 };
        paintUser(network, user);
        expect(user.metadata['display-name']).toBeUndefined();
    });

    test('a late save cannot restore the cache after clear', async() => {
        let waiting = [];
        let originalSet = storage.set;
        storage.set = (name, val) => new Promise((resolve) => {
            waiting.push(() => {
                storage.store[name] = val;
                resolve();
            });
        });

        try {
            rememberUser(network, {
                nick: 'Alice',
                metadata: { 'display-name': 'A' },
            });
            let saving = flush();
            await Promise.resolve();
            expect(waiting).toHaveLength(1);

            let clearing = clear();
            waiting.shift()();
            await saving;
            expect(waiting).toHaveLength(1);
            waiting.shift()();
            await clearing;

            expect(storage.store[STORAGE_KEY]).toBe(null);
        } finally {
            waiting.splice(0).forEach((release) => release());
            storage.set = originalSet;
        }
    });
});
