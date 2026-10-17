'kiwi public';

// HostServ command data for Ergo servers, transcribed from upstream
// irc/hostserv.go. Used for the UserBox services cheatsheet and for /hs
// subcommand completion. Gated behind Ergo detection like ErgoServices.

import { serviceCapabBadge, parseServiceInput } from './ErgoServices';

// All HostServ subcommands, for /hs subcommand completion.
export const HOSTSERV_SUBCOMMANDS = [
    'DEL',
    'OFF',
    'ON',
    'SET',
    'SETCLOAKSECRET',
    'STATUS',
];

// Visibility flags per HostServ command: auth gates on a SASL login,
// capabs gate on operator privileges (see SERVICE_CAPAB_CATEGORIES).
export const HOSTSERV_FLAGS = {
    ON: { auth: true },
    OFF: { auth: true },
    SET: { capabs: ['vhosts'] },
    DEL: { capabs: ['vhosts'] },
    SETCLOAKSECRET: { capabs: ['vhosts', 'rehash'] },
};

// Badge for a HostServ command, or null for regular commands.
export function hostservBadge(cmd) {
    const flags = HOSTSERV_FLAGS[cmd];
    return flags ? serviceCapabBadge(flags.capabs) : null;
}

// Completion list selector: visible canonical subcommands. Auth-gated
// commands need an authenticated session; capab-gated commands need oper
// privileges.
export function hostservSubcommands({ oper = false, authenticated = false } = {}) {
    let cmds = HOSTSERV_SUBCOMMANDS.slice();
    cmds = cmds.filter((cmd) => {
        const flags = HOSTSERV_FLAGS[cmd];
        if (!flags) {
            return true;
        }
        if (flags.auth && !authenticated) {
            return false;
        }
        if (flags.capabs && !oper) {
            return false;
        }
        return true;
    });
    return cmds;
}

// Literal syntax strings for /hs completion descriptions.
// Transcribed from upstream HELP. Rendered raw by AutoComplete.
export const HOSTSERV_SYNTAX = {
    ON: 'ON',
    OFF: 'OFF',
    STATUS: 'STATUS [user]',
    SET: 'SET <user> <vhost>',
    DEL: 'DEL <user>',
    SETCLOAKSECRET: 'SETCLOAKSECRET <secret> [code]',
};

// True while the input is still in the subcommand token of a /hs (or
// /msg HostServ) invocation, i.e. '/hs <partial-command>' with nothing
// after it. False once the subcommand is followed by a space, so argument
// words never get subcommand suggestions.
export function isHostservSubcommandPosition(input) {
    if (typeof input !== 'string') {
        return false;
    }
    return /^\/hs\s+[^\s]*$/i.test(input) ||
        /^\/msg\s+HostServ\s+/i.test(input);
}

// Argument completion spec, keyed by space-joined upper-case command path.
// Each entry lists the ordered argument slots after the path. A slot is:
//   'selfOrKnownAccounts' -> own account for regular users, known accounts
//                           for opers
//   'knownAccounts'      -> accounts known to us
// Missing entries, missing slots and null slots mean no suggestions; the
// syntax ghost still shows via hostservSyntaxFor().
export const HOSTSERV_ARG_SPEC = {
    ON: [],
    OFF: [],
    STATUS: ['selfOrKnownAccounts'],
    SET: ['knownAccounts', null],
    DEL: ['knownAccounts'],
    SETCLOAKSECRET: [],
};

// Parse a /hs (or /msg HostServ) input line into its command path and the
// argument slot under completion. Same result shape as parseNickservInput.
export function parseHostservInput(input) {
    return parseServiceInput(input, {
        prefixes: [/^\/hs\s+/i, /^\/msg\s+HostServ\s+/i],
        aliases: {},
        spec: HOSTSERV_ARG_SPEC,
    });
}

// Argument suggestions for a parsed HostServ input. ctx holds oper,
// selfAccount and knownAccounts; filtering by the in-progress token is
// left to the autocomplete list.
export function hostservArgSuggestions(parsed, ctx) {
    if (!parsed || parsed.argIndex < 0) {
        return [];
    }
    let spec = HOSTSERV_ARG_SPEC[parsed.path.join(' ')];
    if (!spec) {
        return [];
    }
    let slot = spec[parsed.argIndex];
    if (!slot) {
        return [];
    }
    if (slot === 'knownAccounts') {
        return (ctx.knownAccounts || []).slice();
    }
    if (slot === 'selfOrKnownAccounts') {
        if (ctx.oper) {
            return (ctx.knownAccounts || []).slice();
        }
        return ctx.selfAccount ? [ctx.selfAccount] : [];
    }
    return [];
}

// Syntax ghost for a parsed command path, or '' when unknown.
export function hostservSyntaxFor(path) {
    if (!path || !path.length) {
        return '';
    }
    if (HOSTSERV_SYNTAX[path[0]]) {
        return HOSTSERV_SYNTAX[path[0]];
    }
    return '';
}
