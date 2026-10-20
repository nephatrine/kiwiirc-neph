'kiwi public';

/** @module */

import { MessageTags } from 'irc-framework';
import { addAdvertisedCaps, foldPreferredCap, preferredCap } from './CapNegotiation';

// The bouncer-networks capability, preferring the draft name over soju's
// vendor name. Exactly one is ever requested (see CapNegotiation.js).
const BOUNCER_CAPS = ['draft/bouncer-networks', 'soju.im/bouncer-networks'];

// Subcommands the server answers with a BOUNCER line of the same name.
const REQUEST_SUBCOMMANDS = ['addnetwork', 'changenetwork', 'delnetwork'];

// Attributes accepted by ADDNETWORK and CHANGENETWORK.
const NETWORK_ATTRS = [
    'name',
    'host',
    'port',
    'tls',
    'nickname',
    'username',
    'realname',
    'pass',
];

/**
 * Adds the IRCv3 bouncer-networks spec to irc-framework.
 *
 * Both the draft cap and soju's vendor copy of it are accepted, but only one
 * is ever negotiated. Everything above this middleware sees the spec's own
 * vocabulary (netid, name, state, host, port, tls, nickname, username,
 * realname, pass, error), never a dialect.
 */
export default function bouncerMiddleware(network) {
    let networks = [];
    let bindSent = false;
    const advertisedCaps = new Set();

    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
        rawEvents.use(rawMiddleware);
        parsedEvents.use(parsedMiddleware);

        // A LISTNETWORKS reply is a batch of BOUNCER NETWORK lines, and batch
        // middleware swallows and later re-dispatches the lines it collects.
        // Wait for the batch to close before flushing what was accumulated.
        client.on('kiwi.batch.end', (batch) => {
            if (BOUNCER_CAPS.indexOf(batch.type) > -1) {
                flushNetworks(client);
            }
        });
    };

    // Raw middleware, running ahead of command dispatch.
    function rawMiddleware(command, message, rawLine, client, next) {
        if (command === 'CAP' && message && message.params) {
            const subcommand = (message.params[1] || '').toUpperCase();

            if (subcommand === 'LS') {
                // A fresh CAP LS means a fresh registration, so allow a BIND.
                bindSent = false;

                addAdvertisedCaps(advertisedCaps, message);
                if (network && !network.bouncerCap()) {
                    const preferred = preferredCap(advertisedCaps, BOUNCER_CAPS);
                    if (preferred) {
                        foldPreferredCap(client, preferred, BOUNCER_CAPS);
                    }
                }
            } else if (subcommand === 'ACK' && !saslCredentials(client)) {
                // Without SASL there is no authentication step, so the CAP ACK
                // line is the last moment a BIND is still valid.
                sendBind(client);
            }
        }

        // With SASL, bind the moment authentication succeeds. irc-framework
        // writes CAP END when it handles this same line, and this middleware
        // runs first with client.raw() writing synchronously, so the BIND
        // reaches the server ahead of that CAP END.
        if (saslCredentials(client) && (command === '900' || command === '903')) {
            sendBind(client);
        }

        next();
    }

    function parsedMiddleware(command, event, client, next) {
        const effectiveCommand = (command === 'unknown command' && event.command) ?
            event.command.toUpperCase() :
            command.toUpperCase();
        const params = event.params || [];

        if (effectiveCommand === 'BOUNCER') {
            handleBouncer(client, params);
        } else if (
            effectiveCommand === 'FAIL' &&
            (params[0] || '').toUpperCase() === 'BOUNCER'
        ) {
            handleBouncerFail(client, params);
        }

        next();
    }

    function handleBouncer(client, params) {
        const subcommand = (params[0] || '').toUpperCase();

        if (subcommand === 'NETWORK') {
            networks.push(networkFromAttrs(params[1], params[2]));
            return;
        }

        // BOUNCER ADDNETWORK|CHANGENETWORK|DELNETWORK <netid>
        const key = subcommand.toLowerCase();
        if (REQUEST_SUBCOMMANDS.indexOf(key) === -1 || !params[1]) {
            return;
        }

        settleRequest(client, key, { netid: params[1] });
    }

    function handleBouncerFail(client, params) {
        // FAIL BOUNCER <CODE> <subcommand> [<param>...] :<description>
        const code = params[1] || '';
        const subcommand = (params[2] || '').toLowerCase();
        const reason = params[params.length - 1] || '';

        client.command_handler.emit('bouncer error', { code, subcommand, reason, network });

        if (subcommand) {
            settleRequest(client, subcommand, { error: code, reason }, true);
        }
    }

    function flushNetworks(client) {
        const result = networks;
        networks = [];
        client.command_handler.emit('bouncer networks', result);
    }

    // BIND is only acknowledged on failure, so it is fire and forget.
    function sendBind(client) {
        if (bindSent || !network || !network.bouncerCap()) {
            return;
        }

        const netid = network.connection.bncnetid;
        if (!netid) {
            return;
        }

        bindSent = true;
        client.raw('BOUNCER BIND ' + netid);
    }
}

// A BIND is only attempted when the session can actually authenticate.
function saslCredentials(client) {
    const account = client.options.account || {};
    return !!(account.account && account.password);
}

function networkFromAttrs(netid, attrString) {
    const tags = MessageTags.decode(attrString || '');
    const tls = tags.tls === '1';
    const port = parseInt(tags.port, 10);
    const defaultPort = tls ? 6697 : 6667;

    return {
        netid: netid || '',
        name: tags.name || '',
        state: tags.state || '',
        host: tags.host || '',
        // bouncer-networks defaults an omitted port to the IRC default for
        // the TLS setting: 6697 for TLS, 6667 otherwise.
        port: port > 0 ? port : defaultPort,
        tls: tls,
        nickname: tags.nickname || '',
        username: tags.username || '',
        realname: tags.realname || '',
        pass: tags.pass || '',
        error: tags.error || '',
    };
}

// Canonical attributes to wire tags. Empty values are left out so the server
// keeps whatever it already has.
function networkTags(attrs) {
    const tags = {};

    NETWORK_ATTRS.forEach((attr) => {
        const value = attrs[attr];
        if (typeof value === 'undefined' || value === null || value === '') {
            return;
        }
        tags[attr] = value;
    });

    if (typeof tags.tls !== 'undefined') {
        tags.tls = tags.tls ? '1' : '0';
    }

    return tags;
}

function pendingRequests(client, subcommand) {
    client.bnc.requests = client.bnc.requests || Object.create(null);
    client.bnc.requests[subcommand] = client.bnc.requests[subcommand] || [];
    return client.bnc.requests[subcommand];
}

// The wire format answers ADDNETWORK, CHANGENETWORK and DELNETWORK with their
// own subcommand, so at most one request per subcommand is ever outstanding.
function settleRequest(client, subcommand, value, isError) {
    const request = pendingRequests(client, subcommand).shift();
    if (!request) {
        return;
    }

    if (isError) {
        request.reject(value);
    } else {
        request.resolve(value);
    }
}

function requestNetwork(client, subcommand, buildLine) {
    return new Promise((resolve, reject) => {
        pendingRequests(client, subcommand).push({ resolve, reject });
        client.raw(buildLine());
    });
}

function addFunctionsToClient(client, network) {
    const bnc = client.bnc = {};

    // The bouncer announces the network this connection is bound to through
    // the BOUNCER_NETID ISUPPORT token, once a BIND has taken effect.
    bnc.netId = function netId() {
        const netid = network ? network.supports('bouncer_netid') : '';
        if (!netid || netid === true) {
            return '';
        }
        return netid.toString();
    };

    bnc.hasNetwork = function hasNetwork() {
        return !!bnc.netId();
    };

    bnc.getNetworks = function getNetworks() {
        return new Promise((resolve) => {
            client.once('bouncer networks', (bncNetworks) => {
                resolve(bncNetworks);
            });
            client.raw('BOUNCER LISTNETWORKS');
        });
    };

    bnc.addNetwork = function addNetwork(attrs) {
        return requestNetwork(client, 'addnetwork', () => (
            'BOUNCER ADDNETWORK ' + MessageTags.encode(networkTags(attrs))
        ));
    };

    bnc.saveNetwork = function saveNetwork(netid, attrs) {
        const tags = networkTags(attrs);
        if (Object.keys(tags).length === 0) {
            return Promise.resolve();
        }

        return requestNetwork(client, 'changenetwork', () => (
            'BOUNCER CHANGENETWORK ' + netid + ' ' + MessageTags.encode(tags)
        ));
    };

    bnc.removeNetwork = function removeNetwork(netid) {
        return requestNetwork(client, 'delnetwork', () => 'BOUNCER DELNETWORK ' + netid);
    };
}
