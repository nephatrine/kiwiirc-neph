'kiwi public';

/**
 * @module CapNegotiation
 *
 * Helpers for negotiating a single capability out of a group of equivalent
 * names, such as a `draft/...` name and a vendor-prefixed `soju.im/...` copy
 * of the same specification. More than one name from a group must never
 * appear in the same CAP REQ.
 */

// Collect the cap names advertised by a CAP LS line. The cap list is the
// final parameter and may be split over several lines during CAP 302
// negotiation, so callers keep one Set across every line.
export function addAdvertisedCaps(advertised, event) {
    if (!event || !event.params) {
        return advertised;
    }

    const capList = event.params[event.params.length - 1] || '';
    capList.split(' ').forEach((entry) => {
        const name = entry.split('=')[0].toLowerCase();
        if (name) {
            advertised.add(name);
        }
    });

    return advertised;
}

// The first name from `names`, in preference order, that the server
// advertised. Returns an empty string when none were.
export function preferredCap(advertised, names) {
    return names.find((cap) => advertised.has(cap)) || '';
}

// Fold `preferred` into irc-framework's batched CAP REQ, removing every other
// name in `names` from both extra-caps lists and from the pending request
// list, so exactly one capability from the group is requested.
//
// Raw middleware runs before command dispatch, but irc-framework intersects
// each LS line with its own command-handler copy of `request_extra_caps`
// (synced only once at connect time) and accumulates the match into
// `network.cap.requested`, sending a single REQ on the final line. Waiting
// for the final line is too late when the caps were advertised on an earlier
// one, and mutating only `client.request_extra_caps` never reaches the
// negotiation at all. A separate REQ here would produce a second ACK, and
// irc-framework treats an ACK without `sasl` while SASL credentials exist as
// a fatal `capability_missing` failure that drops the connection.
export function foldPreferredCap(client, preferred, names) {
    const others = names.filter((cap) => cap !== preferred);

    client.request_extra_caps = client.request_extra_caps || [];
    if (!client.request_extra_caps.includes(preferred)) {
        client.request_extra_caps = client.request_extra_caps.filter(
            (cap) => !names.includes(cap)
        );
        client.request_extra_caps.push(preferred);
    }

    if (client.command_handler && client.command_handler.request_extra_caps) {
        client.command_handler.request_extra_caps = client
            .command_handler.request_extra_caps.filter((cap) => !others.includes(cap));
        if (!client.command_handler.request_extra_caps.includes(preferred)) {
            client.command_handler.request_extra_caps.push(preferred);
        }
    }

    if (client.network && client.network.cap && client.network.cap.requested) {
        others.forEach((cap) => {
            const idx = client.network.cap.requested.indexOf(cap);
            if (idx !== -1) {
                client.network.cap.requested.splice(idx, 1);
            }
        });
    }
}

// Drop a cap from the request entirely. Like foldPreferredCap this has to touch
// every copy of the request list, because irc-framework negotiates from its
// command handler's copy rather than from the one on the client.
export function dropCap(client, name) {
    if (client.request_extra_caps) {
        client.request_extra_caps = client.request_extra_caps.filter(
            (cap) => cap !== name
        );
    }

    if (client.command_handler && client.command_handler.request_extra_caps) {
        client.command_handler.request_extra_caps = client
            .command_handler.request_extra_caps.filter((cap) => cap !== name);
    }

    if (client.network && client.network.cap && client.network.cap.requested) {
        const idx = client.network.cap.requested.indexOf(name);
        if (idx !== -1) {
            client.network.cap.requested.splice(idx, 1);
        }
    }
}
