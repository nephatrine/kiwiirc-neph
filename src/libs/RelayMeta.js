import Vue from 'vue';
import { sanitizeUrl } from '@/helpers/Misc';
import * as MetadataCache from '@/libs/MetadataCache';

export const RESPONSE_TIMEOUT = 30000;
export const MAX_ATTEMPTS = 2;
export const PUMP_MS = 5000;
const MAX_QUEUE = 200;
const META_KEYS = ['avatar', 'display-name'];

const nets = new Map();

function botKey(nick) {
    return String(nick || '').toUpperCase();
}

function pairKey(bot, target) {
    return botKey(bot) + '\n' + botKey(target);
}

function recordFor(networkid) {
    let rec = nets.get(networkid);
    if (!rec) {
        rec = {
            id: networkid,
            deps: null,
            probes: new Map(),
            done: new Set(),
            attempts: new Map(),
            queue: [],
            timer: null,
            pending: null,
        };
        nets.set(networkid, rec);
    }
    return rec;
}

function botKnown(rec, bot) {
    return !!rec.deps && !!rec.deps.userByNick(bot);
}

function isProbeQueued(rec, bk) {
    return rec.queue.some((item) => item.kind === 'probe' && botKey(item.bot) === bk);
}

function isGetQueued(rec, key) {
    return rec.queue.some((item) => item.kind === 'get' && item.key === key);
}

function isProbePending(rec, bk) {
    return !!rec.pending &&
        rec.pending.job.kind === 'probe' &&
        botKey(rec.pending.job.bot) === bk;
}

function isGetPending(rec, key) {
    return !!rec.pending && rec.pending.job.kind === 'get' && rec.pending.job.key === key;
}

function dropBotJobs(rec, bot) {
    let bk = botKey(bot);
    rec.queue = rec.queue.filter((job) => botKey(job.bot) !== bk);
    if (rec.pending && botKey(rec.pending.job.bot) === bk) {
        clearTimeout(rec.pending.timer);
        rec.pending = null;
    }
}

function pump(networkid) {
    let rec = nets.get(networkid);
    if (!rec || rec.pending) {
        return;
    }
    let idx = rec.queue.findIndex((job) => {
        if (!botKnown(rec, job.bot)) {
            return false;
        }
        if (job.kind === 'probe') {
            return rec.probes.get(botKey(job.bot)) === 'unknown';
        }
        return rec.probes.get(botKey(job.bot)) === 'yes';
    });
    if (idx === -1) {
        return;
    }
    let job = rec.queue.splice(idx, 1)[0];
    if (job.kind === 'probe') {
        rec.probes.set(botKey(job.bot), 'pending');
        rec.deps.ctcpRequest(job.bot, 'CLIENTINFO');
    } else {
        rec.deps.ctcpRequest(job.bot, 'RELAYMETA', 'GET', job.target, ...META_KEYS);
    }
    let timer = setTimeout(() => onTimeout(networkid, job), RESPONSE_TIMEOUT);
    rec.pending = { job, timer };
}

function onTimeout(networkid, job) {
    let rec = nets.get(networkid);
    if (!rec || !rec.pending || rec.pending.job !== job) {
        return;
    }
    rec.pending = null;
    if (!botKnown(rec, job.bot)) {
        rec.queue.unshift(job);
        return;
    }
    let akey = job.kind === 'probe' ?
        'probe ' + botKey(job.bot) :
        'get ' + job.key;
    let attempt = (rec.attempts.get(akey) || 0) + 1;
    rec.attempts.set(akey, attempt);
    if (attempt >= MAX_ATTEMPTS) {
        if (job.kind === 'probe') {
            rec.probes.set(botKey(job.bot), 'no');
            dropBotJobs(rec, job.bot);
        } else {
            rec.done.add(job.key);
        }
        return;
    }
    if (job.kind === 'probe') {
        rec.probes.set(botKey(job.bot), 'unknown');
    }
    rec.queue.unshift(job);
}

function ensurePump(rec) {
    if (rec.timer || (!rec.queue.length && !rec.pending)) {
        return;
    }
    rec.timer = setInterval(() => {
        pump(rec.id);
        if (!rec.queue.length && !rec.pending) {
            clearInterval(rec.timer);
            rec.timer = null;
        }
    }, PUMP_MS);
}

function unescapeValue(value) {
    let out = '';
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '\\' && i + 1 < value.length) {
            let next = value[i + 1];
            if (next === 's') {
                out += ' ';
            } else if (next === ':') {
                out += ';';
            } else if (next === 'r') {
                out += '\r';
            } else if (next === 'n') {
                out += '\n';
            } else {
                out += next;
            }
            i += 1;
        } else {
            out += value[i];
        }
    }
    return out;
}

function parsePairs(text) {
    let pairs = [];
    String(text || '').split(' ').forEach((token) => {
        if (!token) {
            return;
        }
        let eq = token.indexOf('=');
        if (eq === -1) {
            pairs.pop();
            return;
        }
        pairs.push({
            name: token.slice(0, eq).toLowerCase(),
            value: unescapeValue(token.slice(eq + 1)),
        });
    });
    return pairs;
}

function applyData(rec, target, rest) {
    let user = rec.deps.userByNick(target);
    if (!user) {
        return;
    }
    if (!user.metadata) {
        user.metadata = {};
    }
    let touched = false;
    parsePairs(rest).forEach((pair) => {
        if (pair.name === 'display-name' && pair.value) {
            Vue.set(user.metadata, 'display-name', pair.value);
            touched = true;
        } else if (pair.name === 'avatar' && pair.value) {
            let avatar = sanitizeUrl(pair.value);
            if (avatar) {
                Vue.set(user.metadata, 'avatar', avatar);
                touched = true;
            }
        }
    });
    if (touched) {
        MetadataCache.rememberUser(rec.deps.raw, user);
    }
}

function handleClientInfo(rec, event) {
    let bk = botKey(event.nick);
    if (rec.probes.get(bk) !== 'pending') {
        return false;
    }
    if (isProbePending(rec, bk)) {
        clearTimeout(rec.pending.timer);
        rec.pending = null;
    }
    let tokens = String(event.message || '').toUpperCase().split(/\s+/);
    if (tokens.includes('RELAYMETA')) {
        rec.probes.set(bk, 'yes');
    } else {
        rec.probes.set(bk, 'no');
        dropBotJobs(rec, event.nick);
    }
    return true;
}

function handleRelayMeta(rec, event) {
    let parts = String(event.message || '').split(' ');
    let verb = (parts[0] || '').toUpperCase();
    let target = parts[1] || '';
    if ((verb !== 'DATA' && verb !== 'ERR') || !target) {
        return false;
    }
    if (rec.pending && rec.pending.job.kind === 'get' &&
        botKey(rec.pending.job.bot) === botKey(event.nick) &&
        botKey(rec.pending.job.target) === botKey(target)) {
        clearTimeout(rec.pending.timer);
        rec.pending = null;
    }
    if (verb === 'DATA') {
        applyData(rec, target, parts.slice(2).join(' '));
    }
    rec.done.add(pairKey(event.nick, target));
    return true;
}

export function noteRelay(deps, networkid, bot, target) {
    if (!deps || !bot || !target) {
        return;
    }
    let rec = recordFor(networkid);
    rec.deps = deps;
    let key = pairKey(bot, target);
    if (rec.done.has(key)) {
        return;
    }
    let bk = botKey(bot);
    let probe = rec.probes.get(bk);
    if (probe === 'no') {
        return;
    }
    if (!probe) {
        rec.probes.set(bk, 'unknown');
        probe = 'unknown';
    }
    if (probe === 'unknown' && !isProbeQueued(rec, bk) && !isProbePending(rec, bk)) {
        rec.queue.push({ kind: 'probe', bot });
    }
    if (!isGetQueued(rec, key) && !isGetPending(rec, key)) {
        rec.queue.push({ kind: 'get', bot, target, key });
    }
    while (rec.queue.length > MAX_QUEUE) {
        let idx = rec.queue.findIndex((item) => item.kind === 'get');
        rec.queue.splice(idx === -1 ? 0 : idx, 1);
    }
    ensurePump(rec);
}

export function noteBotOnline(deps, networkid, nick) {
    if (!deps || !nick) {
        return;
    }
    let rec = nets.get(networkid);
    if (!rec) {
        return;
    }
    rec.deps = deps;
    pump(networkid);
}

export function isOwnMachineCtcp(ownNick, event) {
    if (!ownNick || !event || botKey(event.nick) !== botKey(ownNick)) {
        return false;
    }
    let type = String(event.type || '').toUpperCase();
    return type === 'CLIENTINFO' || type === 'RELAYMETA';
}

export function handleCtcp(deps, networkid, event) {
    if (!event) {
        return false;
    }
    let type = String(event.type || '').toUpperCase();
    if (type !== 'CLIENTINFO' && type !== 'RELAYMETA') {
        return false;
    }
    let rec = nets.get(networkid);
    if (!rec) {
        return false;
    }
    rec.deps = deps;
    if (type === 'CLIENTINFO') {
        return handleClientInfo(rec, event);
    }
    return handleRelayMeta(rec, event);
}
