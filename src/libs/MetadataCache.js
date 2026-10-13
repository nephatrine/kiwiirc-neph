import Vue from 'vue';
import * as Misc from '@/helpers/Misc';

const STORAGE_KEY = 'kiwi-metadata-cache';
const MAX_USERS = 100;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY = 1000;

let storage = null;
let data = { networks: {} };
let saveTimer = null;
let generation = 0;
let writeChain = Promise.resolve();

function enqueue(task) {
    writeChain = writeChain.then(task, task);
    return writeChain;
}

function networkCacheKey(network) {
    if (!network || !network.connection) {
        return '';
    }

    let server = network.connection.server;
    if (!server || typeof server !== 'string') {
        return '';
    }

    let identity = network.connection.account
        || network.connection.nick
        || network.nick
        || '';
    if (typeof identity !== 'string') {
        identity = '';
    }

    return server.toLowerCase() + '\n' + identity.toLowerCase();
}

function readBucket(network) {
    let key = networkCacheKey(network);
    if (!key || !data.networks[key]) {
        return null;
    }
    return data.networks[key];
}

function bucket(network) {
    let key = networkCacheKey(network);
    if (!key) {
        return null;
    }

    if (!data.networks[key] || typeof data.networks[key] !== 'object') {
        Vue.set(data.networks, key, { channels: {}, users: {} });
    }

    let net = data.networks[key];
    if (!net.channels || typeof net.channels !== 'object') {
        net.channels = {};
    }
    if (!net.users || typeof net.users !== 'object') {
        net.users = {};
    }
    return net;
}

function cleanName(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().substring(0, 100);
}

function cleanAvatar(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return Misc.sanitizeUrl(value);
}

function nickKey(nick) {
    if (!nick || typeof nick !== 'string') {
        return '';
    }
    return 'n:' + nick.toUpperCase();
}

function accountKey(account) {
    if (!account || typeof account !== 'string' || account === '*') {
        return '';
    }
    return 'a:' + account.toLowerCase();
}

function isFresh(entry) {
    return !!(
        entry
        && typeof entry === 'object'
        && typeof entry.seen === 'number'
        && Date.now() - entry.seen <= MAX_AGE
    );
}

function isQuota(err) {
    if (!err) {
        return false;
    }
    return err.name === 'QuotaExceededError'
        || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || err.code === 22
        || err.code === 1014;
}

function capUsers(net) {
    let keys = Object.keys(net.users);
    if (keys.length <= MAX_USERS) {
        return;
    }

    keys.sort((a, b) => (net.users[a].seen || 0) - (net.users[b].seen || 0));
    let extra = keys.length - MAX_USERS;
    for (let i = 0; i < extra; i++) {
        delete net.users[keys[i]];
    }
}

function dropOldestHalfUsers() {
    Object.keys(data.networks).forEach((key) => {
        let net = data.networks[key];
        if (!net || !net.users || typeof net.users !== 'object') {
            return;
        }

        let keys = Object.keys(net.users);
        keys.sort((a, b) => (net.users[a].seen || 0) - (net.users[b].seen || 0));
        let drop = Math.ceil(keys.length / 2);
        for (let i = 0; i < drop; i++) {
            delete net.users[keys[i]];
        }
    });
}

function scheduleSave() {
    if (saveTimer || !storage) {
        return;
    }

    let gen = generation;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        persistNow(gen);
    }, SAVE_DELAY);
}

function persistNow(gen) {
    if (!storage || gen !== generation) {
        return writeChain;
    }

    let payload = JSON.stringify(data);
    return enqueue(() => writePayload(gen, payload));
}

async function writePayload(gen, payload) {
    if (!storage || gen !== generation) {
        return;
    }

    try {
        await storage.set(STORAGE_KEY, payload);
    } catch (err) {
        if (!storage || gen !== generation || !isQuota(err)) {
            return;
        }

        dropOldestHalfUsers();
        if (gen !== generation) {
            return;
        }

        try {
            await storage.set(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // Never touch kiwi-state to make room.
        }
    }
}

function ensureMeta(target) {
    if (!target.metadata || typeof target.metadata !== 'object') {
        Vue.set(target, 'metadata', {});
    }
}

function migrateUserKey(net, user) {
    let ak = accountKey(user.account);
    let nk = nickKey(user.nick);
    if (!ak || !nk || !net.users[nk]) {
        return ak;
    }

    if (!net.users[ak]) {
        net.users[ak] = net.users[nk];
    }
    delete net.users[nk];
    return ak;
}

export async function load(storageImpl) {
    generation += 1;
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    storage = storageImpl || null;
    data = { networks: {} };
    if (!storage) {
        return;
    }

    let raw;
    try {
        raw = await storage.get(STORAGE_KEY);
    } catch (e) {
        return;
    }

    if (!raw || typeof raw !== 'string') {
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return;
    }

    if (
        !parsed
        || typeof parsed !== 'object'
        || !parsed.networks
        || typeof parsed.networks !== 'object'
        || Array.isArray(parsed.networks)
    ) {
        return;
    }

    data = { networks: parsed.networks };
}

export async function clear() {
    generation += 1;
    let gen = generation;
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    data = { networks: {} };
    if (!storage) {
        return;
    }

    await enqueue(async() => {
        if (!storage || gen !== generation) {
            return;
        }
        try {
            await storage.set(STORAGE_KEY, null);
        } catch (e) {
            // ignore
        }
    });
}

export function flush() {
    let gen = generation;
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    return persistNow(gen);
}

export function rememberChannel(network, target, displayName) {
    if (typeof target !== 'string' || !target) {
        return;
    }

    let key = target.toLowerCase();
    let name = cleanName(displayName);
    if (!name) {
        let existing = readBucket(network);
        if (existing && existing.channels && existing.channels[key]) {
            delete existing.channels[key];
            scheduleSave();
        }
        return;
    }

    let net = bucket(network);
    if (!net) {
        return;
    }

    net.channels[key] = {
        name,
        seen: Date.now(),
    };
    scheduleSave();
}

export function rememberUser(network, user) {
    if (!user || !user.nick) {
        return;
    }

    let meta = user.metadata || {};
    let name = cleanName(meta['display-name']);
    let avatar = cleanAvatar(meta.avatar);
    let nk = nickKey(user.nick);
    let ak = accountKey(user.account);

    if (!name && !avatar) {
        let existing = readBucket(network);
        if (!existing || !existing.users) {
            return;
        }
        let changed = false;
        if (nk && existing.users[nk]) {
            delete existing.users[nk];
            changed = true;
        }
        if (ak && existing.users[ak]) {
            delete existing.users[ak];
            changed = true;
        }
        if (changed) {
            scheduleSave();
        }
        return;
    }

    let net = bucket(network);
    if (!net) {
        return;
    }

    if (ak && nk && net.users[nk]) {
        delete net.users[nk];
    }

    let key = ak || nk;
    if (!key) {
        return;
    }

    net.users[key] = {
        name,
        avatar,
        seen: Date.now(),
    };
    capUsers(net);
    scheduleSave();
}

export function paintBuffer(network, buffer) {
    if (!buffer || !buffer.name || !network || !network.isChannelName) {
        return;
    }
    if (!network.isChannelName(buffer.name)) {
        return;
    }

    let net = readBucket(network);
    if (!net || !net.channels) {
        return;
    }

    let key = String(buffer.name).toLowerCase();
    let entry = net.channels[key];
    if (!entry) {
        return;
    }
    if (!isFresh(entry)) {
        delete net.channels[key];
        scheduleSave();
        return;
    }

    ensureMeta(buffer);
    let name = cleanName(entry.name);
    if (name && !buffer.metadata['display-name']) {
        Vue.set(buffer.metadata, 'display-name', name);
    }

    entry.seen = Date.now();
    scheduleSave();
}

export function paintUser(network, user) {
    if (!user || !user.nick || !network) {
        return;
    }

    let net = readBucket(network);
    if (!net || !net.users || typeof net.users !== 'object') {
        return;
    }

    migrateUserKey(net, user);
    let ak = accountKey(user.account);
    let nk = nickKey(user.nick);
    let key = (ak && net.users[ak]) ? ak : nk;
    let entry = key && net.users[key];
    if (!entry) {
        return;
    }
    if (!isFresh(entry)) {
        delete net.users[key];
        scheduleSave();
        return;
    }

    ensureMeta(user);
    let name = cleanName(entry.name);
    let avatar = cleanAvatar(entry.avatar);
    if (name && !user.metadata['display-name']) {
        Vue.set(user.metadata, 'display-name', name);
    }
    if (avatar && !user.metadata.avatar) {
        Vue.set(user.metadata, 'avatar', avatar);
    }

    entry.seen = Date.now();
    scheduleSave();
}

export function paintNetwork(network) {
    if (!network) {
        return;
    }

    (network.buffers || []).forEach((buffer) => {
        paintBuffer(network, buffer);
    });

    let users = network.users || {};
    Object.keys(users).forEach((key) => {
        paintUser(network, users[key]);
    });
}
