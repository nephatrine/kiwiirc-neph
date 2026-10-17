'kiwi public';

// HistServ command data for Ergo servers, transcribed from upstream
// irc/histserv.go. Used for the UserBox services cheatsheet and for
// /msg HistServ subcommand completion. Gated behind Ergo detection like
// ErgoServices.

import { serviceCapabBadge, parseServiceInput } from './ErgoServices';

// All HistServ subcommands, for subcommand completion. There is no short
// alias; completion triggers on /msg HistServ.
export const HISTSERV_SUBCOMMANDS = [
    'DELETE',
    'EXPORT',
    'FORGET',
    'PLAY',
];

// Visibility flags per HistServ command: auth gates on a SASL login,
// capabs gate on operator privileges (see SERVICE_CAPAB_CATEGORIES).
export const HISTSERV_FLAGS = {
    FORGET: { capabs: ['history'] },
    EXPORT: { capabs: ['history'] },
};

// Badge for a HistServ command, or null for regular commands.
export function histservBadge(cmd) {
    const flags = HISTSERV_FLAGS[cmd];
    return flags ? serviceCapabBadge(flags.capabs) : null;
}

// Completion list selector: visible canonical subcommands. Auth-gated
// commands need an authenticated session; capab-gated commands need oper
// privileges.
export function histservSubcommands({ oper = false, authenticated = false } = {}) {
    let cmds = HISTSERV_SUBCOMMANDS.slice();
    cmds = cmds.filter((cmd) => {
        const flags = HISTSERV_FLAGS[cmd];
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

// Literal syntax strings for completion descriptions.
// Transcribed from upstream HELP. Rendered raw by AutoComplete.
export const HISTSERV_SYNTAX = {
    FORGET: 'FORGET <account>',
    DELETE: 'DELETE <target> <msgid>',
    EXPORT: 'EXPORT <account>',
    PLAY: 'PLAY <target> [limit]',
};

// True while the input is still in the subcommand token of a
// /msg HistServ invocation, i.e. '/msg HistServ <partial-command>' with
// nothing after it. False once the subcommand is followed by a space, so
// argument words never get subcommand suggestions.
export function isHistservSubcommandPosition(input) {
    if (typeof input !== 'string') {
        return false;
    }
    return /^\/msg\s+HistServ\s+[^\s]*$/i.test(input);
}

// Argument completion spec, keyed by space-joined upper-case command path.
// Each entry lists the ordered argument slots after the path. A slot is:
//   'knownAccounts' -> accounts known to us
//   'knownTargets'  -> channels and open queries known to us
// Missing entries, missing slots and null slots mean no suggestions; the
// syntax ghost still shows via histservSyntaxFor().
export const HISTSERV_ARG_SPEC = {
    FORGET: ['knownAccounts'],
    DELETE: ['knownTargets', null],
    EXPORT: ['knownAccounts'],
    PLAY: ['knownTargets', null],
};

// Parse a /msg HistServ input line into its command path and the argument
// slot under completion. Same result shape as parseNickservInput.
export function parseHistservInput(input) {
    return parseServiceInput(input, {
        prefixes: [/^\/msg\s+HistServ\s+/i],
        aliases: {},
        spec: HISTSERV_ARG_SPEC,
    });
}

// Argument suggestions for a parsed HistServ input. ctx holds knownAccounts
// and knownTargets; filtering by the in-progress token is left to the
// autocomplete list.
export function histservArgSuggestions(parsed, ctx) {
    if (!parsed || parsed.argIndex < 0) {
        return [];
    }
    let spec = HISTSERV_ARG_SPEC[parsed.path.join(' ')];
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
    if (slot === 'knownTargets') {
        return (ctx.knownTargets || []).slice();
    }
    return [];
}

// Syntax ghost for a parsed command path, or '' when unknown.
export function histservSyntaxFor(path) {
    if (!path || !path.length) {
        return '';
    }
    if (HISTSERV_SYNTAX[path[0]]) {
        return HISTSERV_SYNTAX[path[0]];
    }
    return '';
}
