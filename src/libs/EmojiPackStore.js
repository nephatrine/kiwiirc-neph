'kiwi public';

import Vue from 'vue';
import getState from '@/libs/state';
import { desktopFetch } from '@/libs/desktop/Http';
import { customEmojiTokens, customEmojiUrl } from '@/libs/CustomEmoji';
import { getLocalEmojiPacks } from '@/libs/LocalEmojiPacks';

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT = 10000;
const TOKEN_RE = /:([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+)(?:\/([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+))?:/gu;
const SHORTCODE_RE = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+$/u;
const PACK_ID_RE = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+$/u;

export const emojiPackState = Vue.observable({
    server: {},
    channels: {},
    prompt: null,
});

const documentCache = new Map();
const serverPromises = new Map();
const channelPromises = new Map();
const metadataRequests = new Set();
const promptedChannels = new Set();
const promptQueue = [];
let initialized = false;

function remoteEnabled() {
    const value = getState().setting('remoteEmojiPacks');
    return typeof value === 'undefined' ? true : !!value;
}

export function networkPackPolicy(network) {
    if (!network) {
        return 'default';
    }
    return network.setting('emojiNetworkPolicy') || 'default';
}

export function networkPackEnabled(network) {
    const policy = networkPackPolicy(network);
    if (policy === 'never') {
        return false;
    }
    if (policy === 'always') {
        return true;
    }
    return remoteEnabled();
}

export function channelPackEnabled(network, channelName) {
    const policy = channelPolicy(network, channelName);
    if (policy === 'never') {
        return false;
    }
    if (policy === 'always') {
        return true;
    }
    return remoteEnabled();
}

function packPreference() {
    return getState().setting('emojiPackPreference') === 'remote' ?
        'remote' :
        'local';
}

function sameChannel(network, left, right) {
    if (!left || !right) {
        return false;
    }
    if (network && network.ircClient && typeof network.ircClient.caseCompare === 'function') {
        return network.ircClient.caseCompare(left, right);
    }
    return String(left).toLowerCase() === String(right).toLowerCase();
}

function channelKey(network, name) {
    if (network && network.ircClient && typeof network.ircClient.caseLower === 'function') {
        return network.ircClient.caseLower(name);
    }
    return String(name).toLowerCase();
}

function normalizeHttpUrl(value, base) {
    if (typeof value !== 'string' || !value) {
        return '';
    }

    try {
        const url = new URL(value, base || window.location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        if (url.username || url.password) {
            return '';
        }
        return url.href;
    } catch (err) {
        return '';
    }
}

function packFingerprint(supported, emoji) {
    const tokens = Object.keys(emoji).sort();
    return JSON.stringify([
        supported,
        tokens.map((token) => [token, emoji[token].url, emoji[token].alt]),
    ]);
}

function validatePackDocument(document, documentUrl) {
    if (!Array.isArray(document)) {
        throw new Error('invalid emoji pack document');
    }

    const packs = [];

    document.forEach((pack) => {
        if (!pack || typeof pack !== 'object') {
            return;
        }
        if (typeof pack.id !== 'string' || !PACK_ID_RE.test(pack.id)) {
            return;
        }
        if (typeof pack.name !== 'string' || !pack.name) {
            return;
        }
        if (!pack.emoji || typeof pack.emoji !== 'object' || Array.isArray(pack.emoji)) {
            return;
        }

        let supported = true;
        if (typeof pack.required !== 'undefined') {
            if (!Array.isArray(pack.required)) {
                return;
            }
            supported = pack.required.length === 0;
        }

        const emoji = {};
        Object.keys(pack.emoji).forEach((shortcode) => {
            if (!SHORTCODE_RE.test(shortcode)) {
                return;
            }

            const entry = pack.emoji[shortcode];
            if (!entry || typeof entry !== 'object') {
                return;
            }

            const url = normalizeHttpUrl(entry.url, documentUrl);
            if (!url) {
                return;
            }

            emoji[shortcode] = {
                url,
                alt: typeof entry.alt === 'string' ? entry.alt : '',
            };
        });

        if (Object.keys(emoji).length === 0) {
            return;
        }

        packs.push({
            id: pack.id,
            documentUrl,
            fingerprint: packFingerprint(supported, emoji),
            name: pack.name,
            description: typeof pack.description === 'string' ? pack.description : '',
            authors: Array.isArray(pack.authors) ?
                pack.authors.filter((author) => typeof author === 'string') :
                [],
            homepage: normalizeHttpUrl(pack.homepage, documentUrl),
            supported,
            emoji,
        });
    });

    const lastPackIndex = new Map();
    packs.forEach((pack, index) => {
        lastPackIndex.set(pack.id, index);
    });

    return packs.filter((pack, index) => lastPackIndex.get(pack.id) === index);
}

async function fetchPackDocument(url) {
    const controller = typeof AbortController !== 'undefined' ?
        new AbortController() :
        null;
    const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT) : null;

    try {
        const response = await desktopFetch(url, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            cache: 'no-cache',
            signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) {
            throw new Error(`emoji pack request failed (${response.status})`);
        }

        const text = await response.text();
        if (text.length > MAX_DOCUMENT_BYTES) {
            throw new Error('emoji pack document is too large');
        }

        let document = null;
        try {
            document = JSON.parse(text);
        } catch (err) {
            throw new Error('emoji pack document is not valid JSON');
        }

        return validatePackDocument(document, response.url || url);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

function loadPackDocument(url, force) {
    const cached = documentCache.get(url);
    if (!force && cached) {
        return cached.promise;
    }

    const entry = {
        promise: null,
    };
    entry.promise = fetchPackDocument(url).catch((err) => {
        if (documentCache.get(url) === entry) {
            documentCache.delete(url);
        }
        throw err;
    });
    documentCache.set(url, entry);
    return entry.promise;
}

function serverEntry(network) {
    return emojiPackState.server[network.id] || null;
}

function setServerEntry(network, entry) {
    Vue.set(emojiPackState.server, network.id, entry);
}

function ensureChannelContainer(network) {
    if (!emojiPackState.channels[network.id]) {
        Vue.set(emojiPackState.channels, network.id, {});
    }
    return emojiPackState.channels[network.id];
}

function channelEntryByName(network, channelName) {
    const channels = emojiPackState.channels[network.id];
    return channels ? (channels[channelKey(network, channelName)] || null) : null;
}

function channelEntry(network, buffer) {
    return buffer ? channelEntryByName(network, buffer.name) : null;
}

function setChannelEntryByName(network, channelName, entry) {
    const channels = ensureChannelContainer(network);
    Vue.set(channels, channelKey(network, channelName), entry);
}

function selectedPackIdsByName(network, channelName) {
    const selections = network.setting('emojiPackSelections') || {};
    const selected = selections[channelKey(network, channelName)];
    return Array.isArray(selected) ? selected : [];
}

function selectedPackIds(network, buffer) {
    return selectedPackIdsByName(network, buffer.name);
}

function clearSelectedPackIds(network, channelName) {
    const key = channelKey(network, channelName);
    const selections = network.setting('emojiPackSelections') || {};
    if (!selections[key]) {
        return;
    }

    const next = Object.assign({}, selections);
    delete next[key];
    network.setting('emojiPackSelections', next);
}

function selectAllChannelPacks(network, channelName, packs) {
    if (channelPolicy(network, channelName) !== 'always') {
        return;
    }

    const key = channelKey(network, channelName);
    const selections = network.setting('emojiPackSelections') || {};
    const next = Object.assign({}, selections);
    next[key] = packs.filter((pack) => pack.supported).map((pack) => pack.id);
    network.setting('emojiPackSelections', next);
}

function migrateChannelPolicies(network) {
    const existing = network.setting('emojiChannelPolicies');
    const migratedFlag = network.setting('emojiChannelPoliciesMigrated');
    if (migratedFlag) {
        return existing && typeof existing === 'object' ? existing : {};
    }

    const selections = network.setting('emojiPackSelections') || {};
    const selectionKeys = Object.keys(selections);

    if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
        network.setting('emojiChannelPoliciesMigrated', true);
        return existing;
    }

    const migrated = {};
    selectionKeys.forEach((key) => {
        if (!Array.isArray(selections[key]) || selections[key].length === 0) {
            return;
        }
        const buffer = network.bufferByName(key);
        migrated[key] = {
            name: buffer ? buffer.name : key,
            policy: 'always',
        };
    });

    if (selectionKeys.length > 0) {
        network.setting('emojiPackSelections', {});
    }
    network.setting('emojiChannelPoliciesMigrated', true);
    network.setting('emojiChannelPolicies', migrated);
    return migrated;
}

export function channelPolicy(network, channelName) {
    if (!network || !channelName) {
        return 'prompt';
    }

    const policies = migrateChannelPolicies(network);
    const entry = policies[channelKey(network, channelName)];
    if (entry && (entry.policy === 'always' || entry.policy === 'never')) {
        return entry.policy;
    }
    return 'prompt';
}

export function getChannelPolicyEntries(network) {
    const policies = migrateChannelPolicies(network);
    return Object.keys(policies).map((key) => policies[key]).filter((entry) => (
        entry && entry.name && (entry.policy === 'always' || entry.policy === 'never')
    ));
}

export function setChannelPolicy(network, channelName, policy) {
    const key = channelKey(network, channelName);
    const policies = migrateChannelPolicies(network);
    const next = Object.assign({}, policies);

    if (policy === 'prompt') {
        delete next[key];
    } else if (policy === 'always' || policy === 'never') {
        next[key] = {
            name: channelName,
            policy,
        };
    } else {
        return;
    }

    network.setting('emojiChannelPolicies', next);
    clearSelectedPackIds(network, channelName);
    promptedChannels.delete(promptKey(network, channelName));
    removePromptForChannel(network, channelName);

    if (policy === 'prompt') {
        if (!remoteEnabled() || !network.bufferByName(channelName)) {
            const channels = emojiPackState.channels[network.id];
            if (channels) {
                Vue.delete(channels, key);
            }
        }
    } else if (policy === 'always') {
        const entry = channelEntryByName(network, channelName);
        if (entry && entry.status === 'loaded') {
            selectAllChannelPacks(network, channelName, entry.packs);
        } else {
            ensureChannelMetadata(network, channelName);
        }
    } else if (policy === 'never') {
        const channels = emojiPackState.channels[network.id];
        if (channels) {
            Vue.delete(channels, key);
        }
    }

    invalidateMessages(network.id, null);
}

function selectedChannelPacks(network, excludeBuffer) {
    const result = [];
    const channels = emojiPackState.channels[network.id] || {};
    const keys = Object.keys(channels).sort();

    keys.forEach((key) => {
        const entry = channels[key];
        if (!entry || entry.status !== 'loaded') {
            return;
        }

        if (excludeBuffer && sameChannel(network, entry.bufferName, excludeBuffer.name)) {
            return;
        }

        const selected = selectedPackIdsByName(network, entry.bufferName);
        entry.packs.forEach((pack) => {
            if (pack.supported && selected.indexOf(pack.id) !== -1) {
                result.push({
                    pack,
                    buffer: network.bufferByName(entry.bufferName) || null,
                    channelName: entry.bufferName,
                    sourceType: 'channel',
                });
            }
        });
    });

    return result;
}

function packKey(pack) {
    return pack.id + '\n' + (pack.fingerprint || pack.documentUrl || '');
}

function findPackEntry(packs, token, selected) {
    let found = null;

    packs.forEach((pack) => {
        if (!pack.supported) {
            return;
        }
        if (selected && selected.indexOf(pack.id) === -1) {
            return;
        }

        const entry = pack.emoji[token];
        if (entry) {
            found = { pack, entry };
        }
    });

    return found;
}

function lastPackById(packs, packId) {
    let found = null;

    packs.forEach((pack) => {
        if (pack.id === packId) {
            found = pack;
        }
    });

    return found;
}

function packResult(token, found, sourceType, channelName) {
    return {
        url: found.entry.url,
        alt: found.entry.alt,
        token,
        packId: found.pack.id,
        packKey: packKey(found.pack),
        packName: found.pack.name,
        sourceType,
        channelName: channelName || '',
        source: sourceType,
    };
}

function knownChannelNames(network) {
    const names = new Set();

    network.buffers.forEach((buffer) => {
        if (buffer.isChannel()) {
            names.add(buffer.name);
        }
    });

    const channels = emojiPackState.channels[network.id] || {};
    Object.keys(channels).forEach((key) => {
        if (channels[key] && channels[key].bufferName) {
            names.add(channels[key].bufferName);
        }
    });

    const policies = migrateChannelPolicies(network);
    Object.keys(policies).forEach((key) => {
        if (policies[key] && policies[key].name) {
            names.add(policies[key].name);
        }
    });

    return Array.from(names);
}

function channelForPackId(network, packId) {
    let match = null;
    const lowerPackId = channelKey(network, packId);

    knownChannelNames(network).forEach((channelName) => {
        const lowerName = channelKey(network, channelName);
        if (sameChannel(network, channelName, packId) ||
            lowerPackId.startsWith(lowerName + '/')
        ) {
            if (!match || channelName.length > match.length) {
                match = channelName;
            }
        }
    });

    return match;
}

function candidateChannelName(network, packId) {
    if (!packId || !network.isChannelName(packId)) {
        return '';
    }

    const known = channelForPackId(network, packId);
    if (known) {
        return known;
    }

    const slash = packId.indexOf('/');
    return slash > 0 ? packId.substr(0, slash) : packId;
}

function addPackEntries(entries, match, group) {
    Object.keys(match.pack.emoji).forEach((token) => {
        entries.set(token, {
            pack: match.pack,
            entry: match.pack.emoji[token],
            token,
            channelName: match.channelName,
            sourceType: match.sourceType,
            group,
        });
    });
}

function invalidateMessages(networkId, bufferName) {
    const state = getState();
    const network = state.getNetwork(networkId);
    if (!network) {
        return;
    }

    network.buffers.forEach((buffer) => {
        if (bufferName && !sameChannel(network, buffer.name, bufferName)) {
            return;
        }
        buffer.getMessages().forEach((message) => {
            if (message && typeof message.invalidateRender === 'function') {
                message.invalidateRender();
            }
        });
    });
}

export function invalidateEmojiPackRenders() {
    const state = getState();
    state.networks.forEach((network) => {
        invalidateMessages(network.id, null);
    });
}

function promptKey(network, channelName) {
    return network.id + '\n' + channelKey(network, channelName);
}

function showNextPrompt() {
    if (emojiPackState.prompt) {
        return;
    }

    while (promptQueue.length > 0) {
        const next = promptQueue.shift();
        const network = getState().getNetwork(next.networkId);
        if (!network) {
            promptedChannels.delete(promptKey(next, next.channelName));
            continue;
        }
        if (channelPolicy(network, next.channelName) !== 'prompt') {
            promptedChannels.delete(promptKey(network, next.channelName));
            continue;
        }

        emojiPackState.prompt = next;
        return;
    }
}

function removePromptForChannel(network, channelName) {
    const key = promptKey(network, channelName);
    promptedChannels.delete(key);

    for (let i = promptQueue.length - 1; i >= 0; i -= 1) {
        if (promptQueue[i].networkId === network.id &&
            sameChannel(network, promptQueue[i].channelName, channelName)
        ) {
            promptQueue.splice(i, 1);
        }
    }

    if (emojiPackState.prompt &&
        emojiPackState.prompt.networkId === network.id &&
        sameChannel(network, emojiPackState.prompt.channelName, channelName)
    ) {
        emojiPackState.prompt = null;
        showNextPrompt();
    }
}

function queuePackPrompt(network, channelName, packId, token) {
    if (channelPolicy(network, channelName) !== 'prompt' || !remoteEnabled()) {
        return;
    }

    const key = promptKey(network, channelName);
    if (promptedChannels.has(key)) {
        return;
    }
    promptedChannels.add(key);

    const prompt = {
        networkId: network.id,
        channelName,
        packId,
        shortcode: token,
    };

    if (emojiPackState.prompt) {
        promptQueue.push(prompt);
    } else {
        emojiPackState.prompt = prompt;
    }
}

export function answerEmojiPackPrompt(load) {
    const prompt = emojiPackState.prompt;
    if (!prompt) {
        return;
    }

    emojiPackState.prompt = null;
    promptedChannels.delete(promptKey(
        { id: prompt.networkId },
        prompt.channelName
    ));

    const network = getState().getNetwork(prompt.networkId);
    if (network) {
        setChannelPolicy(network, prompt.channelName, load ? 'always' : 'never');
        if (load) {
            ensureChannelMetadata(network, prompt.channelName);
        }
        invalidateMessages(network.id, prompt.channelName);
    }

    showNextPrompt();
}

function clearNetworkPrompts(network) {
    const prefix = network.id + '\n';
    Array.from(promptedChannels).forEach((key) => {
        if (key.startsWith(prefix)) {
            promptedChannels.delete(key);
        }
    });

    for (let i = promptQueue.length - 1; i >= 0; i -= 1) {
        if (promptQueue[i].networkId === network.id) {
            promptQueue.splice(i, 1);
        }
    }

    if (emojiPackState.prompt && emojiPackState.prompt.networkId === network.id) {
        emojiPackState.prompt = null;
        showNextPrompt();
    }
}

export function setNetworkPackPolicy(network, policy) {
    if (!network) {
        return;
    }
    network.setting('emojiNetworkPolicy', policy);
    if (!networkPackEnabled(network)) {
        Vue.delete(emojiPackState.server, network.id);
        return;
    }
    ensureServerPack(network, true);
}

export function serverPackState(network) {
    return serverEntry(network);
}

export function channelPackState(network, buffer) {
    return channelEntry(network, buffer);
}

export function channelPackStateByName(network, channelName) {
    return channelEntryByName(network, channelName);
}

export function selectedChannelPackIds(network, buffer) {
    return selectedPackIds(network, buffer);
}

export function ensureServerPack(network, force = false) {
    if (!networkPackEnabled(network)) {
        Vue.delete(emojiPackState.server, network.id);
        return Promise.resolve();
    }

    const url = normalizeHttpUrl(network.supports('draft/EMOJI'));
    if (!url) {
        Vue.delete(emojiPackState.server, network.id);
        return Promise.resolve();
    }

    const current = serverEntry(network);
    if (!force && current && current.url === url) {
        if (current.status === 'loaded' || current.status === 'loading') {
            return serverPromises.get(network.id) || Promise.resolve();
        }
    }

    const entry = {
        url,
        status: 'loading',
        error: '',
        packs: current && current.url === url ? current.packs : [],
    };
    setServerEntry(network, entry);

    const promise = loadPackDocument(url, force)
        .then((packs) => {
            entry.status = 'loaded';
            entry.error = '';
            entry.packs = packs;
            invalidateMessages(network.id, null);
            return packs;
        })
        .catch((err) => {
            entry.status = 'error';
            entry.error = err.message || 'emoji pack request failed';
            return [];
        })
        .finally(() => {
            if (serverPromises.get(network.id) === promise) {
                serverPromises.delete(network.id);
            }
        });

    serverPromises.set(network.id, promise);
    return promise;
}

function channelUrl(network, channelName) {
    const buffer = network.bufferByName(channelName);
    if (buffer && buffer.metadata && buffer.metadata['draft/emoji']) {
        return normalizeHttpUrl(buffer.metadata['draft/emoji']);
    }

    const entry = channelEntryByName(network, channelName);
    return entry ? entry.url : '';
}

export function noteChannelMetadata(network, channelName, value) {
    if (!network || !channelName || !channelPackEnabled(network, channelName)) {
        return;
    }

    const key = network.id + '\n' + channelKey(network, channelName);
    metadataRequests.delete(key);

    const url = normalizeHttpUrl(value);
    const current = channelEntryByName(network, channelName);
    if (!url) {
        const buffer = network.bufferByName(channelName);
        if (buffer) {
            if (current) {
                const channels = ensureChannelContainer(network);
                Vue.delete(channels, channelKey(network, channelName));
            }
        } else if (channelPolicy(network, channelName) === 'always') {
            setChannelEntryByName(network, channelName, {
                bufferName: channelName,
                url: '',
                status: 'error',
                error: 'draft/emoji is not available for this channel',
                packs: current ? current.packs : [],
            });
        }
        return;
    }

    if (!current || current.url !== url) {
        setChannelEntryByName(network, channelName, {
            bufferName: channelName,
            url,
            status: 'detected',
            error: '',
            packs: [],
        });
    }

    if (channelPolicy(network, channelName) === 'always') {
        ensureChannelPackByName(network, channelName);
    }
}

export function noteChannelPack(network, buffer) {
    if (!buffer || !buffer.isChannel || !buffer.isChannel()) {
        return;
    }

    noteChannelMetadata(
        network,
        buffer.name,
        buffer.metadata && buffer.metadata['draft/emoji']
    );
}

export function ensureChannelMetadata(network, channelName) {
    if (!network || !channelName) {
        return Promise.resolve();
    }
    if (channelPolicy(network, channelName) !== 'always') {
        return Promise.resolve();
    }
    if (!channelPackEnabled(network, channelName)) {
        return Promise.resolve();
    }

    const url = channelUrl(network, channelName);
    if (url) {
        return ensureChannelPackByName(network, channelName);
    }

    if (!network.metadataCap || !network.metadataCap()) {
        return Promise.resolve();
    }

    const key = network.id + '\n' + channelKey(network, channelName);
    if (metadataRequests.has(key)) {
        return Promise.resolve();
    }

    metadataRequests.add(key);
    network.getMetadata(channelName, ['draft/emoji']);
    setTimeout(() => {
        metadataRequests.delete(key);
    }, 15000);

    return Promise.resolve();
}

export function ensureChannelPackByName(network, channelName, force = false) {
    if (!network || !channelName || !channelPackEnabled(network, channelName)) {
        return Promise.resolve();
    }

    const url = channelUrl(network, channelName);
    if (!url) {
        ensureChannelMetadata(network, channelName);
        return Promise.resolve();
    }

    const key = network.id + '\n' + channelKey(network, channelName);
    const current = channelEntryByName(network, channelName);
    if (!force && current && current.url === url) {
        if (current.status === 'loaded') {
            selectAllChannelPacks(network, channelName, current.packs);
            return Promise.resolve(current.packs);
        }
        if (current.status === 'loading') {
            return channelPromises.get(key) || Promise.resolve();
        }
    }

    const entry = {
        bufferName: channelName,
        url,
        status: 'loading',
        error: '',
        packs: current && current.url === url ? current.packs : [],
    };
    setChannelEntryByName(network, channelName, entry);

    const promise = loadPackDocument(url, force)
        .then((packs) => {
            entry.status = 'loaded';
            entry.error = '';
            entry.packs = packs;
            selectAllChannelPacks(network, channelName, packs);
            invalidateMessages(network.id, null);
            return packs;
        })
        .catch((err) => {
            entry.status = 'error';
            entry.error = err.message || 'emoji pack request failed';
            return [];
        })
        .finally(() => {
            if (channelPromises.get(key) === promise) {
                channelPromises.delete(key);
            }
        });

    channelPromises.set(key, promise);
    return promise;
}

export function ensureChannelPack(network, buffer, force = false) {
    if (!buffer || !buffer.name) {
        return Promise.resolve();
    }
    return ensureChannelPackByName(network, buffer.name, force);
}

export function toggleChannelPack(network, buffer, packId, enabled) {
    const key = channelKey(network, buffer.name);
    const selections = network.setting('emojiPackSelections') || {};
    const next = Object.assign({}, selections);
    const selected = Array.isArray(next[key]) ? next[key].slice() : [];
    const idx = selected.indexOf(packId);

    if (enabled && idx === -1) {
        selected.push(packId);
    } else if (!enabled && idx !== -1) {
        selected.splice(idx, 1);
    }

    next[key] = selected;
    network.setting('emojiPackSelections', next);
    invalidateMessages(network.id, null);
}

function findPackById(network, buffer, packId, token) {
    const channel = channelForPackId(network, packId);
    if (channel) {
        const entry = channelEntryByName(network, channel);
        if (!entry || entry.status !== 'loaded') {
            return null;
        }
        if (selectedPackIdsByName(network, channel).indexOf(packId) === -1) {
            return null;
        }

        const pack = lastPackById(entry.packs, packId);
        if (!pack || !pack.supported || !pack.emoji[token]) {
            return null;
        }
        return {
            pack,
            entry: pack.emoji[token],
            channelName: channel,
            sourceType: 'channel',
        };
    }

    if (buffer && buffer.isChannel && buffer.isChannel()) {
        const current = channelEntry(network, buffer);
        if (current && current.status === 'loaded' &&
            selectedPackIds(network, buffer).indexOf(packId) !== -1
        ) {
            const pack = lastPackById(current.packs, packId);
            if (pack && pack.supported && pack.emoji[token]) {
                return {
                    pack,
                    entry: pack.emoji[token],
                    channelName: buffer.name,
                    sourceType: 'channel',
                };
            }
        }
    }

    const server = serverEntry(network);
    if (server && server.status === 'loaded') {
        const pack = lastPackById(server.packs, packId);
        if (pack && pack.supported && pack.emoji[token]) {
            return {
                pack,
                entry: pack.emoji[token],
                channelName: '',
                sourceType: 'server',
            };
        }
    }

    const matches = [];
    selectedChannelPacks(network, buffer).forEach((match) => {
        if (match.pack.id === packId) {
            matches.push(match);
        }
    });

    const unique = new Map();
    matches.forEach((match) => {
        unique.set(packKey(match.pack), match);
    });

    if (unique.size !== 1) {
        return null;
    }

    const match = Array.from(unique.values())[0];
    if (!match.pack.emoji[token]) {
        return null;
    }

    return {
        pack: match.pack,
        entry: match.pack.emoji[token],
        channelName: match.channelName,
        sourceType: match.sourceType,
    };
}

function maybeHandleUnknownPack(network, buffer, packId, token) {
    const channelName = candidateChannelName(network, packId);
    if (!channelName) {
        return;
    }

    const policy = channelPolicy(network, channelName);
    if (policy === 'always') {
        ensureChannelMetadata(network, channelName);
        return;
    }
    if (policy === 'never') {
        return;
    }

    const server = serverEntry(network);
    if (server && server.status === 'loading') {
        return;
    }

    if (!network.metadataCap() && !channelUrl(network, channelName)) {
        return;
    }

    queuePackPrompt(network, channelName, packId, token);
}

function localCustomResult(token) {
    return {
        url: customEmojiUrl(token),
        alt: '',
        token,
        packId: '',
        packKey: '',
        packName: '',
        sourceType: 'local',
        channelName: '',
        source: 'local',
    };
}

function localPackResult(token, found) {
    return {
        url: found.entry.url,
        alt: found.entry.alt,
        token,
        packId: found.pack.id,
        packKey: packKey(found.pack),
        packName: found.pack.name,
        sourceType: 'local',
        channelName: '',
        source: 'local',
    };
}

function findLocalPackEntry(token, packId) {
    let found = null;

    getLocalEmojiPacks().forEach((pack) => {
        if (!pack.supported) {
            return;
        }
        if (packId && pack.id !== packId) {
            return;
        }

        const entry = pack.emoji[token];
        if (entry) {
            found = { pack, entry };
        }
    });

    return found;
}

function resolveRemoteCustomEmoji(token, buffer, packId) {
    if (!remoteEnabled() || !buffer) {
        return null;
    }

    const network = buffer.getNetwork();
    if (!network) {
        return null;
    }

    if (packId) {
        const found = findPackById(network, buffer, packId, token);
        if (!found) {
            maybeHandleUnknownPack(network, buffer, packId, token);
            return null;
        }
        return packResult(
            token,
            { pack: found.pack, entry: found.entry },
            found.sourceType,
            found.channelName
        );
    }

    if (buffer.isChannel && buffer.isChannel()) {
        const current = channelEntry(network, buffer);
        if (current && current.status === 'loaded') {
            const selected = selectedPackIds(network, buffer);
            const found = findPackEntry(current.packs, token, selected);
            if (found) {
                return packResult(token, found, 'channel', buffer.name);
            }
        }
    }

    const server = serverEntry(network);
    if (server && server.status === 'loaded') {
        const found = findPackEntry(server.packs, token, null);
        if (found) {
            return packResult(token, found, 'server', '');
        }
    }

    let other = null;
    selectedChannelPacks(network, buffer).forEach(({ pack, channelName, sourceType }) => {
        const entry = pack.emoji[token];
        if (entry) {
            other = { pack, entry, channelName, sourceType };
        }
    });

    if (other) {
        return packResult(token, other, other.sourceType, other.channelName);
    }

    return null;
}

export function resolveCustomEmoji(token, buffer, packId) {
    if (!token) {
        return null;
    }

    const preference = packPreference();
    const canUseRemote = remoteEnabled() && !!buffer;
    const localCustom = !packId ? customEmojiUrl(token) : '';
    const localPack = findLocalPackEntry(token, packId);

    if (packId) {
        if (preference === 'remote' && canUseRemote) {
            const remote = resolveRemoteCustomEmoji(token, buffer, packId);
            if (remote) {
                return remote;
            }
        }

        if (localPack) {
            return localPackResult(token, localPack);
        }

        if (preference === 'local' && canUseRemote) {
            return resolveRemoteCustomEmoji(token, buffer, packId);
        }

        return null;
    }

    if (preference === 'remote') {
        if (canUseRemote) {
            const remote = resolveRemoteCustomEmoji(token, buffer, '');
            if (remote) {
                return remote;
            }
        }
        if (localPack) {
            return localPackResult(token, localPack);
        }
        if (localCustom) {
            return localCustomResult(token);
        }
        return null;
    }

    if (localCustom) {
        return localCustomResult(token);
    }
    if (localPack) {
        return localPackResult(token, localPack);
    }
    if (canUseRemote) {
        return resolveRemoteCustomEmoji(token, buffer, '');
    }

    return null;
}

export function parseEmojiValues(word) {
    const source = String(word || '');
    const tokens = [];
    let match;

    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(source)) !== null) {
        tokens.push({
            index: match.index,
            match: match[0],
            shortcode: match[1],
            packId: match[2] || '',
        });
    }

    return tokens;
}

function clearDisabledChannelEntries(network) {
    const channels = emojiPackState.channels[network.id];
    if (!channels) {
        return;
    }

    Object.keys(channels).forEach((key) => {
        const entry = channels[key];
        if (!entry || !entry.bufferName) {
            return;
        }
        if (!channelPackEnabled(network, entry.bufferName)) {
            Vue.delete(channels, key);
            clearSelectedPackIds(network, entry.bufferName);
        }
    });
}

function refreshAll() {
    const state = getState();
    state.networks.forEach((network) => {
        ensureServerPack(network);
        clearDisabledChannelEntries(network);
        network.buffers.forEach((buffer) => {
            if (buffer.isChannel()) {
                noteChannelPack(network, buffer);
            }
        });

        const policies = migrateChannelPolicies(network);
        Object.keys(policies).forEach((key) => {
            const entry = policies[key];
            if (entry && entry.policy === 'always' && entry.name) {
                ensureChannelMetadata(network, entry.name);
            }
        });
    });
}

export function initEmojiPacks(state) {
    if (initialized) {
        return;
    }
    initialized = true;

    state.$on('emoji.server-pack', ({ network }) => {
        ensureServerPack(network);
    });
    state.$on('emoji.channel-pack', ({ network, buffer }) => {
        noteChannelPack(network, buffer);
    });
    state.$on('emoji.channel-metadata', ({ network, channel, url }) => {
        noteChannelMetadata(network, channel, url);
    });
    state.$on('network.removed', ({ network }) => {
        clearNetworkPrompts(network);
    });
    state.$on('emoji.local-packs', () => {
        invalidateEmojiPackRenders();
    });
    state.$watch('user_settings.remoteEmojiPacks', () => {
        invalidateEmojiPackRenders();
        if (!remoteEnabled()) {
            emojiPackState.prompt = null;
            promptQueue.length = 0;
            promptedChannels.clear();
        }
        refreshAll();
    });
    state.$watch('user_settings.emojiPackPreference', () => {
        invalidateEmojiPackRenders();
    });
    state.$watch(
        () => state.networks.map((network) => network.id + ':' + network.state).join('|'),
        () => {
            refreshAll();
        }
    );

    refreshAll();
}

export function getCustomEmojiPickerItems(buffer) {
    const items = [];
    const preference = packPreference();
    const canUseRemote = !!buffer && remoteEnabled();
    const localPacks = getLocalEmojiPacks().filter((pack) => pack.supported);
    const customTokens = customEmojiTokens().filter((token) => customEmojiUrl(token));

    const customItems = customTokens.map((token) => ({
        kind: 'custom',
        shortcode: token,
        token,
        url: customEmojiUrl(token),
        alt: '',
        packId: '',
        packKey: '',
        packName: '',
        sourceType: 'local',
        channelName: '',
    }));

    const localItems = [];
    localPacks.forEach((pack) => {
        Object.keys(pack.emoji).forEach((token) => {
            const entry = pack.emoji[token];
            localItems.push({
                kind: 'local-pack',
                shortcode: token,
                token,
                url: entry.url,
                alt: entry.alt,
                packId: pack.id,
                packKey: packKey(pack),
                packName: pack.name,
                sourceType: 'local',
                channelName: '',
            });
        });
    });

    const remoteItems = [];
    const network = canUseRemote ? buffer.getNetwork() : null;
    if (network) {
        const groups = new Map();
        const groupFor = (packId) => {
            if (!groups.has(packId)) {
                groups.set(packId, {
                    current: [],
                    server: [],
                    other: [],
                });
            }
            return groups.get(packId);
        };
        const addToGroup = (match, group) => {
            if (!match.pack.supported) {
                return;
            }
            groupFor(match.pack.id)[group].push(match);
        };

        selectedChannelPacks(network, buffer).forEach((match) => {
            addToGroup(match, 'other');
        });

        const server = serverEntry(network);
        if (server && server.status === 'loaded') {
            server.packs.forEach((pack) => {
                addToGroup({
                    pack,
                    channelName: '',
                    sourceType: 'server',
                }, 'server');
            });
        }

        if (buffer.isChannel && buffer.isChannel()) {
            const current = channelEntry(network, buffer);
            if (current && current.status === 'loaded') {
                const selected = selectedPackIds(network, buffer);
                current.packs.forEach((pack) => {
                    if (selected.indexOf(pack.id) !== -1) {
                        addToGroup({
                            pack,
                            channelName: buffer.name,
                            sourceType: 'channel',
                        }, 'current');
                    }
                });
            }
        }

        groups.forEach((group, packId) => {
            const entries = new Map();
            const otherKeys = new Set(group.other.map((match) => packKey(match.pack)));

            group.other.forEach((match) => {
                addPackEntries(entries, match, 'other');
            });
            group.server.forEach((match) => {
                addPackEntries(entries, match, 'server');
            });
            group.current.forEach((match) => {
                addPackEntries(entries, match, 'current');
            });

            entries.forEach(({
                pack,
                entry,
                token,
                channelName,
                sourceType,
                group: sourceGroup,
            }) => {
                if (sourceGroup === 'other' && otherKeys.size > 1) {
                    return;
                }

                remoteItems.push({
                    kind: 'remote',
                    shortcode: token,
                    token,
                    url: entry.url,
                    alt: entry.alt,
                    packId,
                    packKey: packKey(pack),
                    packName: pack.name,
                    sourceType,
                    channelName,
                });
            });
        });
    }

    const defaultKeys = new Map();
    const remoteDefaults = new Map();

    remoteItems.forEach((item) => {
        const isCurrent = item.sourceType === 'channel' &&
            buffer.isChannel && buffer.isChannel() &&
            sameChannel(network, item.channelName, buffer.name);
        let rank = 0;
        if (item.sourceType === 'server') {
            rank = 1;
        } else if (isCurrent) {
            rank = 2;
        }
        const previous = remoteDefaults.get(item.token);
        if (!previous || rank >= previous.rank) {
            remoteDefaults.set(item.token, {
                rank,
                key: item.packKey,
            });
        }
    });

    if (preference === 'remote') {
        customTokens.forEach((token) => defaultKeys.set(token, 'custom'));
        localPacks.forEach((pack) => {
            Object.keys(pack.emoji).forEach((token) => {
                defaultKeys.set(token, packKey(pack));
            });
        });
        remoteDefaults.forEach((value, token) => defaultKeys.set(token, value.key));
    } else {
        remoteDefaults.forEach((value, token) => defaultKeys.set(token, value.key));
        localPacks.forEach((pack) => {
            Object.keys(pack.emoji).forEach((token) => {
                defaultKeys.set(token, packKey(pack));
            });
        });
        customTokens.forEach((token) => defaultKeys.set(token, 'custom'));
    }

    customItems.forEach((item) => {
        if (defaultKeys.get(item.token) !== 'custom') {
            return;
        }
        items.push({
            shortcode: item.shortcode,
            name: item.shortcode,
            aliases: [],
            char: '',
            url: item.url,
            alt: item.alt,
            packId: '',
            packKey: '',
            packName: '',
            sourceType: 'local',
            channelName: '',
            source: 'local',
            label: ':' + item.shortcode + ':',
            insertText: ':' + item.shortcode + ':',
        });
    });

    localItems.forEach((item) => {
        const isDefault = defaultKeys.get(item.token) === item.packKey;
        const label = ':' + item.token + '/' + item.packId + ':';
        items.push({
            shortcode: item.shortcode,
            name: item.shortcode,
            aliases: [item.packId],
            char: '',
            url: item.url,
            alt: item.alt,
            packId: item.packId,
            packKey: item.packKey,
            packName: item.packName,
            sourceType: 'local',
            channelName: '',
            source: 'local',
            label,
            insertText: isDefault ? ':' + item.token + ':' : label,
        });
    });

    remoteItems.forEach((item) => {
        const isCurrentChannel = item.sourceType === 'channel' &&
            buffer.isChannel && buffer.isChannel() &&
            sameChannel(network, item.channelName, buffer.name);
        const otherChannel = item.sourceType === 'channel' && !isCurrentChannel;
        const requiresPackId = otherChannel ||
            defaultKeys.get(item.token) !== item.packKey;
        const label = ':' + item.token + '/' + item.packId + ':';
        items.push({
            shortcode: item.shortcode,
            name: item.shortcode,
            aliases: [item.packId],
            char: '',
            url: item.url,
            alt: item.alt,
            packId: item.packId,
            packKey: item.packKey,
            packName: item.packName,
            sourceType: item.sourceType,
            channelName: item.channelName,
            source: item.sourceType,
            label,
            insertText: requiresPackId ? label : ':' + item.token + ':',
        });
    });

    return items.sort((left, right) => (
        left.shortcode.localeCompare(right.shortcode) ||
        left.packName.localeCompare(right.packName) ||
        left.packId.localeCompare(right.packId)
    ));
}
