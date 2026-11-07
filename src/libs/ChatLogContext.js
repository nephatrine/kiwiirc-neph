import * as ChatLogs from '@/libs/desktop/ChatLogs';

const INITIAL_BEFORE = 25;
const INITIAL_AFTER = 25;
const PAGE_SIZE = 50;

export function findContextBuffer(state, networkId, targetName) {
    const network = state.getNetwork(networkId);
    if (!network) {
        return null;
    }
    return network.buffers.find((buffer) => (
        buffer.contextOnly && network.caseCompare(buffer.contextTarget, targetName)
    )) || null;
}

function resetContextBuffer(buffer) {
    buffer.clearMessages();
    buffer.contextOlderRowId = 0;
    buffer.contextNewerRowId = 0;
    buffer.flag('context_loading', false);
    buffer.flag('context_has_older', false);
    buffer.flag('context_has_newer', false);
}

function addRows(state, buffer, rows) {
    rows.forEach((row) => {
        if (!row || buffer.contextRowIds[row.id]) {
            return;
        }
        buffer.contextRowIds[row.id] = true;

        const tags = { 'kiwi-history': true };
        if (row.irc_id) {
            tags.msgid = row.irc_id;
        }

        state.addMessage(buffer, {
            time: row.time,
            server_time: row.server_time,
            nick: row.nick || '',
            message: row.message || '',
            raw_text: row.raw_text || '',
            type: row.type || 'privmsg',
            tags,
            is_redacted: !!row.is_redacted,
            redacted_by: row.redacted_by || '',
            redaction_reason: row.redaction_reason || '',
        });
    });
}

function scrollToResult(state, buffer, result) {
    return buffer.waitForTargetMessage(result).then((target) => {
        if (!target) {
            return false;
        }
        state.$nextTick(() => {
            buffer.scrollToMessage(target.id);
        });
        return true;
    });
}

export function openContextResult(state, result) {
    if (!result || !ChatLogs.isAvailable()) {
        return Promise.resolve(false);
    }

    const network = state.getNetwork(result.network_id);
    if (!network) {
        return Promise.resolve(false);
    }

    const targetName = result.buffer_name;
    const buffer = findContextBuffer(state, network.id, targetName) ||
        state.addContextBuffer(network.id, targetName);
    if (!buffer) {
        return Promise.resolve(false);
    }

    resetContextBuffer(buffer);
    buffer.contextTarget = targetName;
    buffer.flag('context_loading', true);
    state.setActiveBuffer(network.id, buffer.name);

    return ChatLogs.context({
        networkId: network.id,
        bufferName: targetName,
        rowId: result.id,
        before: INITIAL_BEFORE,
        after: INITIAL_AFTER,
    }).then((response) => {
        const rows = response.rows || [];
        addRows(state, buffer, rows);
        if (rows.length) {
            buffer.contextOlderRowId = rows[0].id;
            buffer.contextNewerRowId = rows[rows.length - 1].id;
        }
        buffer.flag('context_has_older', !!response.hasOlder);
        buffer.flag('context_has_newer', !!response.hasNewer);
        return scrollToResult(state, buffer, result);
    }).catch(() => false).finally(() => {
        buffer.flag('context_loading', false);
    });
}

export function openGapContext(state, buffer, gap) {
    if (!buffer || !gap || buffer.contextOnly || !ChatLogs.isAvailable()) {
        return Promise.resolve(false);
    }

    const network = state.getNetwork(buffer.networkid);
    if (!network) {
        return Promise.resolve(false);
    }

    const targetName = buffer.name;
    const anchor = Number(gap.from) || Number(gap.older && gap.older.end) || 0;
    if (!targetName || !anchor) {
        return Promise.resolve(false);
    }

    return ChatLogs.context({
        networkId: network.id,
        bufferName: targetName,
        serverTime: anchor,
        time: anchor,
        before: INITIAL_BEFORE,
        after: INITIAL_AFTER,
    }).then((response) => {
        const rows = response.rows || [];
        if (!rows.length) {
            return false;
        }

        const contextBuffer = findContextBuffer(state, network.id, targetName) ||
            state.addContextBuffer(network.id, targetName);
        if (!contextBuffer) {
            return false;
        }

        resetContextBuffer(contextBuffer);
        contextBuffer.contextTarget = targetName;
        contextBuffer.flag('context_loading', false);
        state.setActiveBuffer(network.id, contextBuffer.name);
        addRows(state, contextBuffer, rows);
        contextBuffer.contextOlderRowId = rows[0].id;
        contextBuffer.contextNewerRowId = rows[rows.length - 1].id;
        contextBuffer.flag('context_has_older', !!response.hasOlder);
        contextBuffer.flag('context_has_newer', !!response.hasNewer);

        const first = rows[0];
        return scrollToResult(state, contextBuffer, {
            irc_id: first.irc_id,
            server_time: first.server_time,
            time: first.time,
            nick: first.nick,
            message: first.message,
            raw_text: first.raw_text,
        }).then((scrolled) => scrolled || true);
    }).catch(() => false);
}

export function loadMoreContext(state, buffer, direction) {
    if (!buffer || !buffer.contextOnly || buffer.flags.context_loading) {
        return Promise.resolve(false);
    }

    const older = direction === 'older';
    const rowId = older ? buffer.contextOlderRowId : buffer.contextNewerRowId;
    if (!rowId) {
        return Promise.resolve(false);
    }

    buffer.flag('context_loading', true);
    return ChatLogs.context({
        networkId: buffer.networkid,
        bufferName: buffer.contextTarget,
        rowId,
        before: older ? PAGE_SIZE : 0,
        after: older ? 0 : PAGE_SIZE,
    }).then((response) => {
        const rows = response.rows || [];
        addRows(state, buffer, rows);
        if (older) {
            if (rows.length) {
                buffer.contextOlderRowId = rows[0].id;
            }
            buffer.flag('context_has_older', !!response.hasOlder);
        } else {
            if (rows.length) {
                buffer.contextNewerRowId = rows[rows.length - 1].id;
            }
            buffer.flag('context_has_newer', !!response.hasNewer);
        }
        return true;
    }).catch(() => false).finally(() => {
        buffer.flag('context_loading', false);
    });
}
