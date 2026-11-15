const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { profileDirectory } = require('./profile-store');

const DATABASE_FILENAME = 'chat-logs.sqlite';
const MAX_BATCH = 250;
const MAX_TEXT_BYTES = 64 * 1024;
const MAX_FIELD_BYTES = 512;
const DEFAULT_RETENTION_DAYS = 7;
const CONTEXT_COLUMNS = `
    id, network_id, network_name, buffer_name, time, server_time, nick, account,
    type, message, raw_text, irc_id, is_history, is_pending, is_redacted,
    redacted_by, redaction_reason, redacted_at
`;

function databasePath(userDataDir) {
    return path.join(profileDirectory(userDataDir), DATABASE_FILENAME);
}

function textValue(value, maxBytes = MAX_TEXT_BYTES) {
    if (typeof value !== 'string') {
        return '';
    }
    let text = value;
    while (Buffer.byteLength(text, 'utf8') > maxBytes) {
        text = text.slice(0, -1);
    }
    return text;
}

function integerValue(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function booleanValue(value) {
    return value ? 1 : 0;
}

function dedupeKey(entry) {
    if (entry.irc_id) {
        return `irc:${entry.network_id}:${entry.irc_id}`;
    }

    const input = [
        entry.network_id,
        entry.buffer_name,
        entry.server_time || entry.time,
        entry.nick,
        entry.type,
        entry.raw_text || entry.message,
    ].join('\n');
    return `hash:${crypto.createHash('sha256').update(input).digest('hex')}`;
}

function normalizeEntry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const networkId = integerValue(value.network_id, -1);
    if (networkId < 0) {
        return null;
    }

    const entry = {
        network_id: networkId,
        network_name: textValue(value.network_name, MAX_FIELD_BYTES),
        buffer_name: textValue(value.buffer_name, MAX_FIELD_BYTES),
        time: integerValue(value.time, Date.now()),
        server_time: integerValue(value.server_time, 0),
        nick: textValue(value.nick, MAX_FIELD_BYTES),
        account: textValue(value.account, MAX_FIELD_BYTES),
        type: textValue(value.type, 64),
        message: textValue(value.message),
        raw_text: textValue(value.raw_text),
        irc_id: textValue(value.irc_id, MAX_FIELD_BYTES),
        is_history: booleanValue(value.is_history),
        is_pending: booleanValue(value.is_pending),
        client_id: textValue(value.client_id, MAX_FIELD_BYTES),
    };

    if (!entry.buffer_name) {
        return null;
    }

    entry.dedupe_key = dedupeKey(entry);
    return entry;
}

function buildFtsQuery(query) {
    if (typeof query !== 'string') {
        return '';
    }

    return query.trim()
        .split(/\s+/)
        .filter((token) => /[\p{L}\p{N}]/u.test(token))
        .map((token) => `"${token.replace(/"/g, '""')}"*`)
        .join(' AND ');
}

function ensureColumns(db) {
    const existing = new Set(
        db.prepare('PRAGMA table_info(messages)').all().map((column) => column.name)
    );
    const additions = [
        ['redacted_by', "TEXT NOT NULL DEFAULT ''"],
        ['redaction_reason', "TEXT NOT NULL DEFAULT ''"],
        ['redacted_at', 'INTEGER NOT NULL DEFAULT 0'],
        ['client_id', "TEXT NOT NULL DEFAULT ''"],
    ];

    additions.forEach(([name, definition]) => {
        if (!existing.has(name)) {
            db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${definition}`);
        }
    });
}

function createChatLogStore(userDataDir) {
    const directory = profileDirectory(userDataDir);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filePath = databasePath(userDataDir);
    const db = new DatabaseSync(filePath);

    try {
        fs.chmodSync(filePath, 0o600);
    } catch (err) {
        // Windows does not support POSIX file modes.
    }

    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS messages (
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
            is_redacted INTEGER NOT NULL DEFAULT 0,
            redacted_by TEXT NOT NULL DEFAULT '',
            redaction_reason TEXT NOT NULL DEFAULT '',
            redacted_at INTEGER NOT NULL DEFAULT 0,
            client_id TEXT NOT NULL DEFAULT ''
        );
        CREATE UNIQUE INDEX IF NOT EXISTS messages_dedupe
            ON messages(dedupe_key);
        CREATE INDEX IF NOT EXISTS messages_time
            ON messages(time);
        CREATE INDEX IF NOT EXISTS messages_network_buffer_time
            ON messages(network_id, buffer_name, time);
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            message,
            raw_text,
            nick,
            network_name,
            buffer_name,
            content='messages',
            content_rowid='id',
            tokenize='unicode61'
        );
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(
                rowid, message, raw_text, nick, network_name, buffer_name
            ) VALUES (
                new.id, new.message, new.raw_text, new.nick,
                new.network_name, new.buffer_name
            );
        END;
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(
                messages_fts, rowid, message, raw_text, nick, network_name, buffer_name
            ) VALUES (
                'delete', old.id, old.message, old.raw_text, old.nick,
                old.network_name, old.buffer_name
            );
        END;
        CREATE TRIGGER IF NOT EXISTS messages_au
            AFTER UPDATE OF message, raw_text, nick, network_name, buffer_name
            ON messages
        BEGIN
            INSERT INTO messages_fts(
                messages_fts, rowid, message, raw_text, nick, network_name, buffer_name
            ) VALUES (
                'delete', old.id, old.message, old.raw_text, old.nick,
                old.network_name, old.buffer_name
            );
            INSERT INTO messages_fts(
                rowid, message, raw_text, nick, network_name, buffer_name
            ) VALUES (
                new.id, new.message, new.raw_text, new.nick,
                new.network_name, new.buffer_name
            );
        END;
    `);

    ensureColumns(db);
    db.exec(`
        CREATE INDEX IF NOT EXISTS messages_client_id
            ON messages(client_id)
            WHERE client_id <> '';
    `);

    const insertStatement = db.prepare(`
        INSERT OR IGNORE INTO messages (
            network_id, network_name, buffer_name, time, server_time,
            nick, account, type, message, raw_text, irc_id, dedupe_key,
            is_history, is_pending, is_redacted, client_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
    const redactStatement = db.prepare(`
        UPDATE messages
        SET is_redacted = 1,
            redacted_by = ?,
            redaction_reason = ?,
            redacted_at = ?
        WHERE network_id = ? AND irc_id = ? AND irc_id <> ''
    `);
    const confirmPendingStatement = db.prepare(`
        SELECT id, message, raw_text, server_time, is_redacted,
            redacted_by, redaction_reason, redacted_at
        FROM messages
        WHERE client_id = ?
        LIMIT 1
    `);
    const confirmUpdateStatement = db.prepare(`
        UPDATE messages
        SET irc_id = ?, dedupe_key = ?, message = ?, raw_text = ?,
            server_time = ?, is_pending = ?, is_redacted = ?,
            redacted_by = ?, redaction_reason = ?, redacted_at = ?
        WHERE id = ?
    `);
    const findDedupeStatement = db.prepare(`
        SELECT id
        FROM messages
        WHERE dedupe_key = ? AND id <> ?
        LIMIT 1
    `);
    const applyRedactionToRowStatement = db.prepare(`
        UPDATE messages
        SET is_redacted = 1, redacted_by = ?, redaction_reason = ?,
            redacted_at = ?
        WHERE id = ?
    `);
    const pruneStatement = db.prepare('DELETE FROM messages WHERE time < ?');
    const contextTargetStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE id = ? AND network_id = ? AND buffer_name = ?
    `);
    const contextTargetByServerTimeStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ? AND server_time >= ?
        ORDER BY server_time ASC, id ASC
        LIMIT 1
    `);
    const contextTargetByTimeStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ? AND time >= ?
        ORDER BY time ASC, id ASC
        LIMIT 1
    `);
    const contextBeforeStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ?
            AND (time < ? OR (time = ? AND id < ?))
        ORDER BY time DESC, id DESC
        LIMIT ?
    `);
    const contextAfterStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ?
            AND (time > ? OR (time = ? AND id > ?))
        ORDER BY time ASC, id ASC
        LIMIT ?
    `);
    const contextBeforeByServerTimeStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ?
            AND (server_time < ? OR (server_time = ? AND id < ?))
        ORDER BY server_time DESC, id DESC
        LIMIT ?
    `);
    const contextAfterByServerTimeStatement = db.prepare(`
        SELECT ${CONTEXT_COLUMNS}
        FROM messages
        WHERE network_id = ? AND buffer_name = ?
            AND (server_time > ? OR (server_time = ? AND id > ?))
        ORDER BY server_time ASC, id ASC
        LIMIT ?
    `);

    function append(entries) {
        if (!Array.isArray(entries)) {
            throw new Error('chat log entries must be an array');
        }

        const values = entries
            .slice(0, MAX_BATCH)
            .map(normalizeEntry)
            .filter(Boolean);
        if (!values.length) {
            return 0;
        }

        let inserted = 0;
        db.exec('BEGIN IMMEDIATE');
        try {
            values.forEach((entry) => {
                const result = insertStatement.run(
                    entry.network_id,
                    entry.network_name,
                    entry.buffer_name,
                    entry.time,
                    entry.server_time,
                    entry.nick,
                    entry.account,
                    entry.type,
                    entry.message,
                    entry.raw_text,
                    entry.irc_id,
                    entry.dedupe_key,
                    entry.is_history,
                    entry.is_pending,
                    entry.client_id
                );
                inserted += result.changes || 0;
            });
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }

        return inserted;
    }

    function redact({
        networkId,
        ircId,
        redactedBy = '',
        redactionReason = '',
        redactedAt = Date.now(),
    } = {}) {
        const result = redactStatement.run(
            textValue(redactedBy, MAX_FIELD_BYTES),
            textValue(redactionReason, MAX_TEXT_BYTES),
            integerValue(redactedAt, Date.now()),
            integerValue(networkId, -1),
            textValue(ircId, MAX_FIELD_BYTES)
        );
        return result.changes || 0;
    }

    function confirm({
        clientId,
        networkId,
        ircId,
        message,
        rawText,
        serverTime,
        isRedacted,
        redactedBy,
        redactionReason,
        redactedAt,
    } = {}) {
        const id = textValue(clientId, MAX_FIELD_BYTES);
        const network = integerValue(networkId, -1);
        if (!id || network < 0) {
            return 0;
        }

        const pending = confirmPendingStatement.get(id);
        if (!pending) {
            return 0;
        }

        const newIrcId = textValue(ircId, MAX_FIELD_BYTES);
        const body = typeof message === 'string' ?
            textValue(message) :
            pending.message;
        const rawBody = typeof rawText === 'string' ?
            textValue(rawText) :
            pending.raw_text;
        const confirmedAt = integerValue(serverTime, 0) || pending.server_time;
        const redacted = isRedacted || pending.is_redacted ? 1 : 0;
        const finalRedactedBy = textValue(
            redactedBy || pending.redacted_by,
            MAX_FIELD_BYTES
        );
        const finalReason = textValue(
            redactionReason || pending.redaction_reason,
            MAX_TEXT_BYTES
        );
        const finalRedactedAt = integerValue(redactedAt, 0) || pending.redacted_at;

        db.exec('BEGIN IMMEDIATE');
        try {
            if (newIrcId) {
                const newKey = `irc:${network}:${newIrcId}`;
                const existing = findDedupeStatement.get(newKey, pending.id);
                if (existing) {
                    if (redacted) {
                        applyRedactionToRowStatement.run(
                            finalRedactedBy,
                            finalReason,
                            finalRedactedAt || Date.now(),
                            existing.id
                        );
                    }
                    db.prepare('DELETE FROM messages WHERE id = ?').run(pending.id);
                    db.exec('COMMIT');
                    return 1;
                }

                confirmUpdateStatement.run(
                    newIrcId,
                    newKey,
                    body,
                    rawBody,
                    confirmedAt,
                    0,
                    redacted,
                    finalRedactedBy,
                    finalReason,
                    finalRedactedAt,
                    pending.id
                );
            } else {
                db.prepare(`
                    UPDATE messages
                    SET message = ?, raw_text = ?, server_time = ?,
                        is_pending = 0
                    WHERE id = ?
                `).run(body, rawBody, confirmedAt, pending.id);
            }
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }

        return 1;
    }

    function context({
        networkId,
        bufferName,
        rowId,
        serverTime,
        time,
        before = 25,
        after = 25,
    } = {}) {
        const network = integerValue(networkId, -1);
        const name = textValue(bufferName, MAX_FIELD_BYTES);
        const beforeLimit = Math.min(Math.max(integerValue(before, 25), 0), 100);
        const afterLimit = Math.min(Math.max(integerValue(after, 25), 0), 100);
        if (network < 0 || !name) {
            return { rows: [], hasOlder: false, hasNewer: false };
        }

        let target = null;
        if (rowId) {
            target = contextTargetStatement.get(
                integerValue(rowId, -1),
                network,
                name
            );
        }
        const serverAnchor = Number(serverTime) || 0;
        if (!target && serverAnchor) {
            target = contextTargetByServerTimeStatement.get(
                network,
                name,
                serverAnchor
            );
        }
        if (!target && Number(time)) {
            target = contextTargetByTimeStatement.get(network, name, Number(time));
        }
        if (!target) {
            return { rows: [], hasOlder: false, hasNewer: false };
        }

        const useServerTime = !rowId && target.server_time > 0;
        const older = useServerTime ?
            contextBeforeByServerTimeStatement.all(
                network,
                name,
                target.server_time,
                target.server_time,
                target.id,
                beforeLimit + 1
            ) :
            contextBeforeStatement.all(
                network,
                name,
                target.time,
                target.time,
                target.id,
                beforeLimit + 1
            );
        const newer = useServerTime ?
            contextAfterByServerTimeStatement.all(
                network,
                name,
                target.server_time,
                target.server_time,
                target.id,
                afterLimit + 1
            ) :
            contextAfterStatement.all(
                network,
                name,
                target.time,
                target.time,
                target.id,
                afterLimit + 1
            );

        const hasOlder = older.length > beforeLimit;
        const hasNewer = newer.length > afterLimit;
        const rows = older
            .slice(0, beforeLimit)
            .reverse()
            .concat([target], newer.slice(0, afterLimit));

        return { rows, hasOlder, hasNewer };
    }

    function search(options = {}) {
        const limit = Math.min(Math.max(integerValue(options.limit, 50), 1), 100);
        const offset = Math.max(integerValue(options.offset, 0), 0);
        const clauses = [];
        const params = [];

        if (integerValue(options.networkId, 0) > 0) {
            clauses.push('m.network_id = ?');
            params.push(integerValue(options.networkId));
        }
        if (typeof options.bufferName === 'string' && options.bufferName) {
            clauses.push('m.buffer_name = ?');
            params.push(textValue(options.bufferName, MAX_FIELD_BYTES));
        }

        const where = clauses.length ? clauses.join(' AND ') : '1 = 1';
        let rows;
        const ftsQuery = buildFtsQuery(options.query);
        if (ftsQuery) {
            params.unshift(ftsQuery);
            rows = db.prepare(`
                SELECT m.id, m.network_id, m.network_name, m.buffer_name,
                    m.time, m.server_time, m.nick, m.account, m.type, m.message,
                    m.raw_text, m.irc_id, m.is_history, m.is_pending,
                    m.is_redacted, m.redacted_by, m.redaction_reason, m.redacted_at
                FROM messages_fts
                JOIN messages m ON m.id = messages_fts.rowid
                WHERE messages_fts MATCH ? AND ${where}
                ORDER BY m.time DESC
                LIMIT ? OFFSET ?
            `).all(...params, limit + 1, offset);
        } else {
            rows = db.prepare(`
                SELECT id, network_id, network_name, buffer_name, time,
                    server_time, nick, account, type, message, raw_text, irc_id,
                    is_history, is_pending, is_redacted, redacted_by,
                    redaction_reason, redacted_at
                FROM messages m
                WHERE ${where}
                ORDER BY time DESC
                LIMIT ? OFFSET ?
            `).all(...params, limit + 1, offset);
        }

        const hasMore = rows.length > limit;
        if (hasMore) {
            rows = rows.slice(0, limit);
        }

        return { rows, hasMore };
    }

    function prune(retentionDays = DEFAULT_RETENTION_DAYS) {
        const days = Number(retentionDays);
        if (!Number.isFinite(days) || days <= 0) {
            return 0;
        }
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return pruneStatement.run(cutoff).changes || 0;
    }

    function clear() {
        db.exec('DELETE FROM messages;');
    }

    function stats() {
        const result = db.prepare(`
            SELECT COUNT(*) AS count, MIN(time) AS oldest, MAX(time) AS newest
            FROM messages
        `).get() || { count: 0, oldest: 0, newest: 0 };
        try {
            result.size = fs.statSync(filePath).size;
        } catch (err) {
            result.size = 0;
        }
        return result;
    }

    function close() {
        db.close();
    }

    return {
        append,
        clear,
        close,
        confirm,
        context,
        filePath: () => filePath,
        prune,
        redact,
        search,
        searchMode: () => 'fts5',
        stats,
    };
}

module.exports = {
    DATABASE_FILENAME,
    DEFAULT_RETENTION_DAYS,
    createChatLogStore,
    databasePath,
    normalizeEntry,
};
