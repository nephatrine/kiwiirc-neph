// Throttle WHO requests and recover from RPL_TRYAGAIN (263).
//
// irc-framework's built-in WHO queue sends the next request as soon as the
// previous wholist arrives and has no handling for 263. A rate-limited WHO
// therefore leaves that queue stuck until reconnect. This queue sends at most
// one WHO per interval, deduplicates targets, and backs off after a 263.

const DEFAULT_THROTTLE_MS = 1500;
const DEFAULT_RATE_LIMIT_MS = 10000;

export default class WhoQueue {
    constructor(client, options = {}) {
        this.client = client;
        this.throttleMs = options.throttleMs || DEFAULT_THROTTLE_MS;
        this.rateLimitMs = options.rateLimitMs || DEFAULT_RATE_LIMIT_MS;
        this.queue = [];
        this.current = null;
        this.timer = null;
        this.cooldownUntil = 0;

        this.onWholist = this.onWholist.bind(this);
        this.reset = this.reset.bind(this);

        client.on('wholist', this.onWholist);
        client.on('connecting', this.reset);
        client.on('disconnected', this.reset);
        client.on('close', this.reset);
        client.who = this.who.bind(this);
    }

    who(target, onWho) {
        if (!target || typeof target !== 'string') {
            if (typeof onWho === 'function') {
                onWho({ target: target, users: [] });
            }
            return;
        }

        const key = target.toLowerCase();
        if (this.current && this.current.key === key) {
            if (typeof onWho === 'function') {
                this.current.onWho = onWho;
            }
            return;
        }

        const queued = this.queue.find((item) => item.key === key);
        if (queued) {
            if (typeof onWho === 'function') {
                queued.onWho = onWho;
            }
            return;
        }

        this.queue.push({ target: target, key: key, onWho: onWho });
        this.process();
    }

    process() {
        if (this.current || this.queue.length === 0) {
            return;
        }

        const now = Date.now();
        if (now < this.cooldownUntil) {
            this.schedule(this.cooldownUntil - now);
            return;
        }

        const item = this.queue.shift();
        this.current = item;

        try {
            const supportsWhox = this.client.network &&
                typeof this.client.network.supports === 'function' &&
                this.client.network.supports('whox');
            if (supportsWhox && this.client.whox_token &&
                typeof this.client.whox_token.next === 'function'
            ) {
                const token = this.client.whox_token.next();
                this.client.raw('WHO', item.target, `%tcuhsnfdaor,${token}`);
            } else {
                this.client.raw('WHO', item.target);
            }
        } catch {
            this.finishCurrent({ target: item.target, users: [] });
            this.cooldownUntil = Date.now() + this.rateLimitMs;
            this.process();
        }
    }

    schedule(delay) {
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            this.process();
        }, Math.max(0, delay));
    }

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    finishCurrent(result) {
        const current = this.current;
        this.current = null;
        if (current && typeof current.onWho === 'function') {
            current.onWho(result);
        }
    }

    onWholist(event) {
        if (!this.current) {
            return;
        }

        const target = event && event.target;
        if (target && this.current.target &&
            String(target).toLowerCase() !== String(this.current.target).toLowerCase()
        ) {
            return;
        }

        const current = this.current;
        this.current = null;
        this.cooldownUntil = Date.now() + this.throttleMs;
        if (typeof current.onWho === 'function') {
            current.onWho({
                target: current.target,
                users: (event && event.users) || [],
            });
        }
        this.process();
    }

    // Called when the server sends 263 / RPL_TRYAGAIN for WHO.
    handleRateLimit() {
        this.finishCurrent({
            target: this.current ? this.current.target : '',
            users: [],
        });
        this.cooldownUntil = Date.now() + this.rateLimitMs;
        this.clearTimer();
        this.schedule(this.rateLimitMs);
    }

    reset() {
        this.clearTimer();
        this.queue = [];
        this.current = null;
        this.cooldownUntil = 0;
    }
}
