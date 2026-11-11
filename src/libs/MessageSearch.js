'kiwi public';

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import * as ChatLogContext from '@/libs/ChatLogContext';
import { toTimestamp } from '@/helpers/Utils';

export const SOURCE_LOCAL = 'local';
export const SOURCE_SERVER = 'server';

export function serverSearchAvailable(network) {
    if (!network || network.state !== 'connected' || !network.ircClient) {
        return false;
    }
    const search = network.ircClient.search;
    return !!(search && typeof search.isSupported === 'function' && search.isSupported());
}

export function serverSearchNetworks(state) {
    return (state.networks || []).filter((network) => serverSearchAvailable(network));
}

export function hasAnySearchSource(state) {
    return ChatLogs.isAvailable() || serverSearchNetworks(state).length > 0;
}

export function defaultSource(state) {
    if (ChatLogs.isAvailable()) {
        return SOURCE_LOCAL;
    }
    if (serverSearchNetworks(state).length > 0) {
        return SOURCE_SERVER;
    }
    return SOURCE_LOCAL;
}

function resultBufferName(network, command) {
    const target = (command.params && command.params[0]) || '';
    if (!target) {
        return '';
    }
    if (network.isChannelName(target)) {
        return target;
    }
    if (network.caseCompare(target, network.nick)) {
        return command.nick || target;
    }
    return target;
}

function normalizeServerCommand(network, command, index) {
    const tags = command.tags || {};
    const serverTime = toTimestamp(tags.time);
    const msgid = tags.msgid || tags['draft/msgid'] || '';
    const rawText = (command.params && command.params[command.params.length - 1]) || '';
    let message = rawText;
    let type = command.command === 'NOTICE' ? 'notice' : 'privmsg';

    if (message.indexOf('\x01ACTION ') === 0) {
        type = 'action';
        message = message.slice(8);
        if (message.endsWith('\x01')) {
            message = message.slice(0, -1);
        }
    }

    return {
        id: `server:${network.id}:${msgid || serverTime}:${index}`,
        source: SOURCE_SERVER,
        network_id: network.id,
        network_name: network.name,
        buffer_name: resultBufferName(network, command),
        nick: command.nick || '',
        account: tags.account || '',
        type,
        message,
        raw_text: rawText,
        irc_id: msgid,
        server_time: serverTime,
        time: serverTime ? network.timeToLocal(serverTime) : serverTime,
        is_redacted: false,
    };
}

export function normalizeServerCommands(network, commands) {
    return (commands || []).map((command, index) => (
        normalizeServerCommand(network, command, index)
    ));
}

export function searchLocal(options) {
    return ChatLogs.search(options).then((result) => ({
        rows: (result.rows || []).map((row) => ({
            ...row,
            source: SOURCE_LOCAL,
        })),
        hasMore: !!result.hasMore,
        source: SOURCE_LOCAL,
    }));
}

export function searchServer(options) {
    const network = options.state.getNetwork(options.networkId);
    if (!serverSearchAvailable(network)) {
        return Promise.reject(new Error('Server history search is unavailable'));
    }

    const limit = options.limit || 50;
    return network.ircClient.search.run({
        in: options.bufferName,
        from: options.from,
        after: options.after,
        before: options.before,
        text: options.query,
        limit,
    }).then((response) => {
        if (response && response.error) {
            throw new Error(response.reason || response.error);
        }

        const rows = normalizeServerCommands(network, response && response.commands);
        rows.sort((a, b) => (
            (b.server_time || 0) - (a.server_time || 0) ||
            b.id.localeCompare(a.id)
        ));

        return {
            rows,
            hasMore: rows.length >= limit,
            source: SOURCE_SERVER,
        };
    });
}

export function openLocalResult(state, result) {
    if (!result) {
        return Promise.resolve(false);
    }

    const network = state.getNetwork(result.network_id);
    const buffer = state.getBufferByName(result.network_id, result.buffer_name);
    const loaded = buffer && buffer.findLogResultMessage(result);

    if (loaded) {
        state.setActiveBuffer(result.network_id, result.buffer_name);
        return new Promise((resolve) => {
            state.$nextTick(() => {
                buffer.scrollToMessage(loaded.id).then(resolve);
            });
        });
    }

    const openContext = () => ChatLogContext.openContextResult(state, result);

    const canUseServerHistory = !!(
        buffer &&
        !buffer.contextOnly &&
        network &&
        network.state === 'connected' &&
        (buffer.joined || buffer.isQuery())
    );
    if (!canUseServerHistory) {
        return openContext();
    }

    state.setActiveBuffer(result.network_id, buffer.name);
    return buffer.jumpToMessage(result).then((jumped) => (
        jumped ? true : openContext()
    ));
}

export function loadServerResult(state, result) {
    if (!result) {
        return Promise.resolve(false);
    }

    const network = state.getNetwork(result.network_id);
    if (!network || network.state !== 'connected' || !result.buffer_name) {
        return Promise.resolve(false);
    }

    let buffer = state.getBufferByName(network.id, result.buffer_name);
    let createdContext = false;
    if (!buffer) {
        buffer = state.addServerContextBuffer(network.id, result.buffer_name);
        createdContext = true;
    }
    if (!buffer) {
        return Promise.resolve(false);
    }

    // Loading context is only the first step. Leave the active buffer and
    // viewport alone until the user clicks the result again to jump to it.
    if (buffer.findLogResultMessage(result)) {
        return Promise.resolve(true);
    }

    if (!network.ircClient.chathistory ||
        !network.ircClient.chathistory.isSupported()
    ) {
        if (createdContext) {
            state.removeBuffer(buffer);
        }
        return Promise.resolve(false);
    }

    return buffer.loadMessageContext(result).then((loaded) => {
        if (!loaded && createdContext) {
            state.removeBuffer(buffer);
        }
        return loaded;
    });
}

export function loadResultContext(state, result) {
    return loadServerResult(state, result).then((loaded) => {
        if (loaded) {
            return 'loaded';
        }
        if (result && result.source === SOURCE_LOCAL && ChatLogs.isAvailable()) {
            return 'local';
        }
        return 'failed';
    });
}

export function openLocalContext(state, result) {
    if (!result) {
        return Promise.resolve(false);
    }
    return ChatLogContext.openContextResult(state, result);
}

export function openServerResult(state, result) {
    if (!result) {
        return Promise.resolve(false);
    }

    const network = state.getNetwork(result.network_id);
    if (!network || network.state !== 'connected' || !result.buffer_name) {
        return Promise.resolve(false);
    }

    let buffer = state.getBufferByName(network.id, result.buffer_name);
    let createdContext = false;
    if (!buffer) {
        buffer = state.addServerContextBuffer(network.id, result.buffer_name);
        createdContext = true;
    }
    if (!buffer) {
        return Promise.resolve(false);
    }

    const loaded = buffer.findLogResultMessage(result);
    state.setActiveBuffer(network.id, buffer.name);

    if (loaded) {
        return new Promise((resolve) => {
            state.$nextTick(() => {
                buffer.scrollToMessage(loaded.id).then(resolve);
            });
        });
    }

    if (!network.ircClient.chathistory ||
        !network.ircClient.chathistory.isSupported()
    ) {
        if (createdContext) {
            state.removeBuffer(buffer);
        }
        return Promise.resolve(false);
    }

    return buffer.jumpToMessage(result).then((jumped) => {
        if (!jumped && createdContext) {
            state.removeBuffer(buffer);
        }
        return jumped;
    });
}

export function openResult(state, result) {
    if (!result) {
        return Promise.resolve(false);
    }
    return result.source === SOURCE_SERVER ?
        openServerResult(state, result) :
        openLocalResult(state, result);
}
