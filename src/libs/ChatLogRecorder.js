import * as ChatLogs from '@/libs/desktop/ChatLogs';

const LOGGED_TYPES = ['privmsg', 'action', 'notice', 'message'];
const FLUSH_DELAY = 250;
const MAX_BATCH = 100;
const DEFAULT_RETENTION_DAYS = 7;
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let initialized = false;
let queue = [];
let flushTimer = null;
let flushChain = Promise.resolve();

function clientIdFor(message) {
    if (!message || typeof message.id === 'undefined') {
        return '';
    }
    return `${SESSION_ID}:${message.id}`;
}

export function isLoggableMessage(buffer, message) {
    if (!buffer || !message) {
        return false;
    }
    if (buffer.contextOnly ||
        !buffer.isChannel ||
        (!buffer.isChannel() && !buffer.isQuery())
    ) {
        return false;
    }
    if (!LOGGED_TYPES.includes(message.type) || message.ignore || message.is_redacted) {
        return false;
    }
    return !!buffer.getNetwork();
}

export function toLogEntry(buffer, message) {
    if (!isLoggableMessage(buffer, message)) {
        return null;
    }

    const network = buffer.getNetwork();
    return {
        network_id: network.id,
        network_name: network.name || '',
        buffer_name: buffer.name,
        time: message.time,
        server_time: message.server_time || 0,
        nick: message.nick || '',
        account: (message.user && message.user.account) || '',
        type: message.type || '',
        message: message.message || '',
        raw_text: message.raw_text || message.message || '',
        irc_id: message.irc_id || '',
        is_history: !!message.is_history,
        is_pending: !!message.is_pending,
        client_id: clientIdFor(message),
    };
}

function scheduleFlush() {
    if (flushTimer) {
        return;
    }
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushLogs();
    }, FLUSH_DELAY);
}

function flushLogs() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (!queue.length) {
        return flushChain;
    }

    const batches = [];
    while (queue.length) {
        batches.push(queue.splice(0, MAX_BATCH));
    }

    batches.forEach((batch) => {
        flushChain = flushChain
            .then(() => ChatLogs.append(batch))
            .catch(() => {
                // Chat logging is best-effort and must not break IRC.
            });
    });

    return flushChain;
}

function applyRedaction(event = {}) {
    const networkId = event.networkId ||
        (event.buffer && event.buffer.getNetwork() && event.buffer.getNetwork().id);
    const ircId = event.ircId || (event.message && event.message.irc_id);
    if (!networkId || !ircId) {
        return;
    }

    const redactedBy = event.redactedBy ||
        (event.message && event.message.redacted_by) ||
        '';
    const redactionReason = event.redactionReason ||
        (event.message && event.message.redaction_reason) ||
        event.reason ||
        '';
    const redactedAt = event.redactedAt ||
        (event.message && event.message.redacted_at) ||
        Date.now();

    flushLogs().then(() => ChatLogs.redact({
        networkId,
        ircId,
        redactedBy,
        redactionReason,
        redactedAt,
    })).catch(() => {});
}

function applyConfirmation(event = {}) {
    const { message, buffer } = event;
    const network = buffer && buffer.getNetwork();
    if (!message || !network || !message.irc_id) {
        return;
    }
    if (!buffer.isChannel || (!buffer.isChannel() && !buffer.isQuery())) {
        return;
    }

    flushLogs().then(() => ChatLogs.confirm({
        clientId: clientIdFor(message),
        networkId: network.id,
        ircId: message.irc_id,
        message: message.message || '',
        rawText: message.raw_text || message.message || '',
        serverTime: message.server_time || 0,
        isRedacted: !!message.is_redacted,
        redactedBy: message.redacted_by || '',
        redactionReason: message.redaction_reason || '',
        redactedAt: message.redacted_at || 0,
    })).catch(() => {});
}

export function initChatLogs(state) {
    if (initialized || !ChatLogs.isAvailable()) {
        return;
    }
    initialized = true;

    state.$on('message.new', ({ message, buffer } = {}) => {
        const entry = toLogEntry(buffer, message);
        if (!entry) {
            return;
        }

        queue.push(entry);
        if (queue.length >= MAX_BATCH) {
            flushLogs();
        } else {
            scheduleFlush();
        }
    });

    state.$on('message.redaction', (event) => {
        applyRedaction(event);
    });

    state.$on('message.confirmed', (event) => {
        applyConfirmation(event);
    });

    const prune = () => {
        const configured = Number(state.setting('chatLogRetentionDays'));
        const retentionDays = Number.isFinite(configured) ?
            configured :
            DEFAULT_RETENTION_DAYS;
        ChatLogs.prune(retentionDays).catch(() => {});
    };
    prune();
    window.setInterval(prune, 6 * 60 * 60 * 1000);
}
