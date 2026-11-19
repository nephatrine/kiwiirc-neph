import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import state from '@/libs/state';
import {
    initChatLogs,
    isLoggableMessage,
    toLogEntry
} from '@/libs/ChatLogRecorder';
import * as ChatLogs from '@/libs/desktop/ChatLogs';
import {
    createChatLogStore,
    databasePath,
    normalizeEntry
} from '../../desktop/electron/chat-log-store';

const DAY = 24 * 60 * 60 * 1000;

function makeEntry(overrides = {}) {
    return {
        network_id: 1,
        network_name: 'TestNet',
        buffer_name: '#test',
        time: Date.now(),
        nick: 'Alice',
        type: 'privmsg',
        message: 'hello world',
        raw_text: 'hello world',
        irc_id: `msg-${Math.random()}`,
        ...overrides,
    };
}

describe('Desktop chat log store', () => {
    let userDataDir;
    let store;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-chat-logs-'));
        store = createChatLogStore(userDataDir);
    });

    afterEach(() => {
        store.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('creates the database and searches with FTS', () => {
        store.append([
            makeEntry({ irc_id: 'a', message: 'hello world', raw_text: 'hello world' }),
            makeEntry({ irc_id: 'b', message: 'goodbye world', raw_text: 'goodbye world' }),
        ]);

        const result = store.search({ query: 'hello' });

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].message).toBe('hello world');
        expect(result.rows[0].network_name).toBe('TestNet');
        expect(store.searchMode()).toBe('fts5');
        expect(fs.existsSync(databasePath(userDataDir))).toBe(true);
    });

    it('matches token prefixes', () => {
        store.append([
            makeEntry({
                irc_id: 'otter',
                message: 'otters are great',
                raw_text: 'otters are great',
            }),
            makeEntry({
                irc_id: 'blotter',
                message: 'a blotter is useful',
                raw_text: 'a blotter is useful',
            }),
        ]);

        expect(store.search({ query: 'otter' }).rows).toHaveLength(1);
        expect(store.search({ query: 'otter' }).rows[0].message)
            .toBe('otters are great');
        expect(store.search({ query: 'otter great' }).rows).toHaveLength(1);
        expect(store.search({ query: 'otter!' }).rows).toHaveLength(1);
        expect(store.search({ query: 'blotter' }).rows).toHaveLength(1);
    });

    it('deduplicates messages by irc_id', () => {
        const entry = makeEntry({ irc_id: 'same-id' });

        expect(store.append([entry])).toBe(1);
        expect(store.append([entry])).toBe(0);
        expect(store.stats().count).toBe(1);
    });

    it('returns a target and surrounding context in chronological order', () => {
        store.append(
            Array.from({ length: 5 }, (_, index) => makeEntry({
                irc_id: `context-${index}`,
                time: 1000 + (index * 1000),
                message: `context message ${index}`,
                raw_text: `context message ${index}`,
            }))
        );

        const result = store.context({
            networkId: 1,
            bufferName: '#test',
            rowId: 3,
            before: 1,
            after: 1,
        });

        expect(result.rows.map((row) => row.message)).toEqual([
            'context message 1',
            'context message 2',
            'context message 3',
        ]);
        expect(result.hasOlder).toBe(true);
        expect(result.hasNewer).toBe(true);
    });

    it('anchors context by server time for local gap fallback', () => {
        store.append(
            Array.from({ length: 5 }, (_, index) => makeEntry({
                irc_id: `server-context-${index}`,
                time: 1000 + (index * 1000),
                server_time: 1000 + (index * 1000),
                message: `server context ${index}`,
                raw_text: `server context ${index}`,
            }))
        );

        const result = store.context({
            networkId: 1,
            bufferName: '#test',
            serverTime: 2500,
            before: 1,
            after: 1,
        });

        expect(result.rows.map((row) => row.message)).toEqual([
            'server context 1',
            'server context 2',
            'server context 3',
        ]);
    });

    it('uses server_time for the fallback dedupe key', () => {
        const now = Date.now();
        store.append([
            makeEntry({
                irc_id: '',
                time: now,
                server_time: 1000,
                message: 'same history text',
            }),
        ]);
        store.append([
            makeEntry({
                irc_id: '',
                time: now + 5000,
                server_time: 1000,
                message: 'same history text',
            }),
        ]);

        expect(store.stats().count).toBe(1);
    });

    it('filters by network and buffer', () => {
        store.append([
            makeEntry({ irc_id: 'a', buffer_name: '#one' }),
            makeEntry({ irc_id: 'b', buffer_name: '#two' }),
            makeEntry({ irc_id: 'c', network_id: 2, buffer_name: '#one' }),
        ]);

        expect(store.search({ query: 'hello', networkId: 1 }).rows).toHaveLength(2);
        expect(store.search({ query: 'hello', networkId: 1, bufferName: '#two' })
            .rows).toHaveLength(1);
    });

    it('retains redacted content with redaction metadata', () => {
        store.append([makeEntry({ irc_id: 'redact-me', message: 'secret text' })]);

        expect(store.search({ query: 'secret' }).rows).toHaveLength(1);
        expect(store.redact({
            networkId: 1,
            ircId: 'redact-me',
            redactedBy: 'Alice',
            redactionReason: 'Oops',
            redactedAt: 123456,
        })).toBe(1);

        const result = store.search({ query: 'secret' });
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].message).toBe('secret text');
        expect(result.rows[0].is_redacted).toBe(1);
        expect(result.rows[0].redacted_by).toBe('Alice');
        expect(result.rows[0].redaction_reason).toBe('Oops');
        expect(result.rows[0].redacted_at).toBe(123456);
        expect(store.search({}).rows).toHaveLength(1);
        expect(store.stats().count).toBe(1);
    });

    it('confirms pending outgoing messages and updates their irc_id', () => {
        store.append([makeEntry({
            irc_id: '',
            client_id: 'session:1',
            message: 'pending text',
            raw_text: 'pending text',
            is_pending: true,
        })]);

        expect(store.confirm({
            clientId: 'session:1',
            networkId: 1,
            ircId: 'server-id',
            message: 'confirmed text',
            rawText: 'confirmed text',
        })).toBe(1);

        const result = store.search({ query: 'confirmed' });
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].irc_id).toBe('server-id');
        expect(result.rows[0].message).toBe('confirmed text');
        expect(result.rows[0].is_pending).toBe(0);
        expect(store.stats().count).toBe(1);
    });

    it('avoids duplicate rows when confirmation follows history', () => {
        store.append([makeEntry({
            irc_id: 'server-id',
            message: 'history text',
        })]);
        store.append([makeEntry({
            irc_id: '',
            client_id: 'session:2',
            message: 'pending text',
            raw_text: 'pending text',
            is_pending: true,
        })]);

        expect(store.confirm({
            clientId: 'session:2',
            networkId: 1,
            ircId: 'server-id',
            message: 'pending text',
            rawText: 'pending text',
        })).toBe(1);
        expect(store.stats().count).toBe(1);
        expect(store.search({ query: 'history' }).rows).toHaveLength(1);
    });

    it('prunes old messages but keeps zero as indefinite retention', () => {
        const oldTime = Date.now() - (8 * DAY);
        store.append([
            makeEntry({ irc_id: 'old', time: oldTime, buffer_name: '#old' }),
            makeEntry({ irc_id: 'new', message: 'recent message' }),
        ]);

        expect(store.prune(0)).toBe(0);
        expect(store.stats().count).toBe(2);
        expect(store.prune(7)).toBe(1);
        expect(store.stats().count).toBe(1);
    });

    it('paginates search results', () => {
        store.append(
            Array.from({ length: 5 }, (_, index) => makeEntry({
                irc_id: `page-${index}`,
                message: `paged message ${index}`,
            }))
        );

        const first = store.search({ query: 'paged', limit: 2 });
        const second = store.search({ query: 'paged', limit: 2, offset: 2 });

        expect(first.rows).toHaveLength(2);
        expect(first.hasMore).toBe(true);
        expect(second.rows).toHaveLength(2);
    });

    it('migrates an existing database without the redaction columns', () => {
        const migrationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-chat-migrate-'));
        const filePath = databasePath(migrationDir);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const oldDb = new DatabaseSync(filePath);
        oldDb.exec(`
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                network_id INTEGER NOT NULL,
                network_name TEXT NOT NULL DEFAULT '',
                buffer_name TEXT NOT NULL,
                time INTEGER NOT NULL,
                server_time INTEGER NOT NULL DEFAULT 0,
                nick TEXT NOT NULL DEFAULT '',
                account TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                raw_text TEXT NOT NULL DEFAULT '',
                irc_id TEXT NOT NULL DEFAULT '',
                dedupe_key TEXT NOT NULL,
                is_history INTEGER NOT NULL DEFAULT 0,
                is_pending INTEGER NOT NULL DEFAULT 0,
                is_redacted INTEGER NOT NULL DEFAULT 0
            );
        `);
        oldDb.close();

        const migrated = createChatLogStore(migrationDir);
        try {
            migrated.append([makeEntry({
                irc_id: 'migrated-id',
                client_id: 'session:migrated',
                message: 'migrated text',
            })]);
            expect(migrated.redact({
                networkId: 1,
                ircId: 'migrated-id',
                redactedBy: 'Tester',
                redactionReason: 'Migration',
            })).toBe(1);

            const result = migrated.search({ query: 'migrated' });
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].message).toBe('migrated text');
            expect(result.rows[0].redacted_by).toBe('Tester');
        } finally {
            migrated.close();
            fs.rmSync(migrationDir, { recursive: true, force: true });
        }
    });

    it('normalizes invalid entries away', () => {
        expect(normalizeEntry(null)).toBe(null);
        expect(normalizeEntry({ network_id: 1, buffer_name: '' })).toBe(null);
        expect(normalizeEntry({
            network_id: 'bad',
            buffer_name: '#test',
        })).toBe(null);
    });
});

describe('Chat log recorder', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    function makeBuffer() {
        const s = state.create();
        s.settings.startupOptions = {};
        const network = s.addNetwork('TestNet', 'Nick', {
            server: 'irc.example.com',
        });
        const buffer = s.addBuffer(network.id, '#test');
        return { buffer, network };
    }

    it('builds channel entries and skips unloggable messages', () => {
        const { buffer } = makeBuffer();
        const message = {
            type: 'privmsg',
            nick: 'Alice',
            message: 'hello there',
            raw_text: 'hello there',
            time: 12345,
            server_time: 12340,
            irc_id: 'msg-1',
            user: { account: 'alice' },
        };

        expect(isLoggableMessage(buffer, message)).toBe(true);
        expect(toLogEntry(buffer, message)).toEqual({
            network_id: 1,
            network_name: 'TestNet',
            buffer_name: '#test',
            time: 12345,
            server_time: 12340,
            nick: 'Alice',
            account: 'alice',
            type: 'privmsg',
            message: 'hello there',
            raw_text: 'hello there',
            irc_id: 'msg-1',
            is_history: false,
            is_pending: false,
            client_id: expect.any(String),
        });

        expect(isLoggableMessage(buffer, { type: 'join' })).toBe(false);
        expect(isLoggableMessage(buffer, { type: 'privmsg', ignore: true })).toBe(false);
        expect(isLoggableMessage(buffer, { type: 'privmsg', is_redacted: true })).toBe(false);

        const serverBuffer = buffer.getNetwork().serverBuffer();
        expect(isLoggableMessage(serverBuffer, {})).toBe(false);
    });

    it('does not subscribe when the desktop log store is unavailable', () => {
        window.kiwiDesktop = {
            logs: {
                isAvailable: () => false,
                append: () => Promise.resolve(0),
                search: () => Promise.resolve({ rows: [], hasMore: false }),
            },
        };
        const fakeState = {
            $on: jest.fn(),
        };

        initChatLogs(fakeState);

        expect(fakeState.$on).not.toHaveBeenCalled();
    });
});

describe('desktop chat log availability', () => {
    function bridge(available) {
        return {
            logs: {
                isAvailable: () => available,
                append: () => Promise.resolve(0),
                search: () => Promise.resolve({ rows: [], hasMore: false }),
            },
        };
    }

    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('reports availability from the bridge and the main store', () => {
        window.kiwiDesktop = bridge(false);

        expect(ChatLogs.isBridgeAvailable()).toBe(true);
        expect(ChatLogs.isAvailable()).toBe(false);

        window.kiwiDesktop = bridge(true);

        expect(ChatLogs.isAvailable()).toBe(true);

        delete window.kiwiDesktop;

        expect(ChatLogs.isAvailable()).toBe(false);
    });
});
