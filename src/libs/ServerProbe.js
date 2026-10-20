import Irc from 'irc-framework';
import WsTransport from 'irc-framework/src/transports/websocket';
import * as ServerConnection from './ServerConnection';

// Pre-login information gathering for single-network deployments. Opens a
// throwaway connection, reads CAP LS (and ISUPPORT when the server offers
// draft/extended-isupport), then closes without ever sending NICK/USER.
// Only spec-sanctioned pre-registration commands are used: if the server
// does not advertise draft/extended-isupport, no ISUPPORT is attempted.

const PROBE_TIMEOUT = 8000;
const LS_RETRY_INTERVAL = 750;
const ISUPPORT_SETTLE = 1000;
const CACHE_TTL = 10 * 60 * 1000;

const EXTENDED_ISUPPORT = 'draft/extended-isupport';

// Matches a single ISUPPORT token such as NETWORK=Foo or CHANTYPES=#.
// The human-readable trailing text of a 005 line never matches: it either
// contains no '=' at all or is split into words that fail this pattern.
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_./-]*(=.*)?$/;

// Build the same transport a real login would use, without an irc-framework
// Client around it so no registration (NICK/USER) is ever sent.
export function createProbeTransport({ direct, kiwiServer, sessionId, host, port, tls, path }) {
    if (direct) {
        return new WsTransport({
            host: host,
            port: port,
            tls: tls,
            path: path,
        });
    }

    const channelConstructor = ServerConnection.createChannelConstructor(
        kiwiServer,
        sessionId || ''
    );
    return channelConstructor({
        host: host,
        port: port,
        tls: tls,
    });
}

function cacheKey({ direct, host, port }) {
    return `kiwi-serverprobe:${direct ? 'direct' : 'gateway'}:${host}:${port}`;
}

function readCache(key) {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return null;
        }
        const raw = window.sessionStorage.getItem(key);
        if (!raw) {
            return null;
        }
        const entry = JSON.parse(raw);
        if (!entry || (Date.now() - entry.when) > CACHE_TTL) {
            return null;
        }
        return entry.info;
    } catch (err) {
        return null;
    }
}

function writeCache(key, info) {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return;
        }
        window.sessionStorage.setItem(key, JSON.stringify({
            when: Date.now(),
            info: info,
        }));
    } catch (err) {
        // Storage full or unavailable; the probe simply runs again next time.
    }
}

function splitCapEntry(entry) {
    const pos = entry.indexOf('=');
    if (pos === -1) {
        return [entry.toLowerCase(), ''];
    }
    return [entry.substr(0, pos).toLowerCase(), entry.substr(pos + 1)];
}

export function probeServerCaps({ createTransport, transportOptions, timeout } = {}) {
    const key = cacheKey(transportOptions || {});
    const cached = readCache(key);
    if (cached) {
        return Promise.resolve(cached);
    }

    return new Promise((resolve) => {
        const caps = Object.create(null);
        const isupport = Object.create(null);
        let lsComplete = false;
        let isupportRequested = false;
        let settled = false;
        let retryTimer = null;
        let settleTimer = null;
        let timeoutTimer = null;

        let transport = null;
        try {
            transport = createTransport(transportOptions);
        } catch (err) {
            resolve({
                caps: {},
                isupport: {},
                extendedIsupport: false,
                capsComplete: false,
            });
            return;
        }

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            if (retryTimer) {
                clearInterval(retryTimer);
            }
            if (settleTimer) {
                clearTimeout(settleTimer);
            }
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
            }
            try {
                transport.close();
            } catch (err) {
                // Already closed; nothing left to do.
            }
            const info = {
                caps: { ...caps },
                isupport: { ...isupport },
                extendedIsupport: isupportRequested,
                capsComplete: lsComplete,
            };
            // A truncated CAP LS is not a statement about the server, so let
            // the next page load ask again instead of caching the failure.
            if (lsComplete) {
                writeCache(key, info);
            }
            resolve(info);
        };

        const sendLs = () => {
            if (lsComplete || settled) {
                return;
            }
            try {
                transport.writeLine('CAP LS 302');
            } catch (err) {
                // Transport not ready yet; the retry interval tries again.
            }
        };

        const handleCapLine = (params) => {
            const sub = (params[1] || '').toUpperCase();
            const data = params[params.length - 1] || '';
            if (sub === 'LS') {
                data.split(' ').forEach((entry) => {
                    if (!entry) {
                        return;
                    }
                    const [name, value] = splitCapEntry(entry);
                    caps[name] = value;
                });
                // A '*' in the middle position means more LS lines follow.
                if (params.length < 4 || params[2] !== '*') {
                    lsComplete = true;
                    if (retryTimer) {
                        clearInterval(retryTimer);
                        retryTimer = null;
                    }
                    if (!isupportRequested && caps[EXTENDED_ISUPPORT] !== undefined) {
                        isupportRequested = true;
                        try {
                            transport.writeLine('CAP REQ :' + EXTENDED_ISUPPORT);
                        } catch (err) {
                            finish();
                        }
                    } else if (!isupportRequested) {
                        // No extended-isupport: CAP LS is all we may gather.
                        finish();
                    }
                }
            } else if (sub === 'ACK') {
                const acked = data.toLowerCase().split(' ');
                if (isupportRequested && acked.includes(EXTENDED_ISUPPORT)) {
                    try {
                        transport.writeLine('ISUPPORT');
                    } catch (err) {
                        finish();
                    }
                } else if (isupportRequested) {
                    finish();
                }
            } else if (sub === 'NAK') {
                // Our only REQ was extended-isupport; without it there is
                // nothing more to learn.
                if (isupportRequested) {
                    finish();
                }
            }
        };

        const handleIsupportLine = (params) => {
            params.slice(1).forEach((param) => {
                // The trailing human-readable text arrives as one param
                // containing spaces; only '=' pieces could be tokens.
                const pieces = param.indexOf(' ') > -1 ?
                    param.split(' ').filter((piece) => piece.indexOf('=') > -1) :
                    [param];
                pieces.forEach((piece) => {
                    if (!piece || !TOKEN_RE.test(piece)) {
                        return;
                    }
                    const pos = piece.indexOf('=');
                    if (pos === -1) {
                        isupport[piece.toUpperCase()] = '';
                    } else {
                        isupport[piece.substr(0, pos).toUpperCase()] = piece.substr(pos + 1);
                    }
                });
            });

            // Settle briefly so batched or multi-line 005s all land.
            if (settleTimer) {
                clearTimeout(settleTimer);
            }
            settleTimer = setTimeout(finish, ISUPPORT_SETTLE);
        };

        transport.on('open', sendLs);
        transport.on('line', (line) => {
            if (settled) {
                return;
            }
            let message = null;
            try {
                message = Irc.ircLineParser(line);
            } catch (err) {
                return;
            }
            if (!message) {
                return;
            }
            const command = (message.command || '').toUpperCase();
            if (command === 'CAP') {
                handleCapLine(message.params || []);
            } else if (command === '005') {
                handleIsupportLine(message.params || []);
            }
        });
        transport.on('close', finish);

        retryTimer = setInterval(sendLs, LS_RETRY_INTERVAL);
        timeoutTimer = setTimeout(finish, timeout || PROBE_TIMEOUT);

        try {
            transport.connect();
        } catch (err) {
            finish();
        }
    });
}
