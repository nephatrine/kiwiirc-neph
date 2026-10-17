'kiwi public';

// ChanServ command data for Ergo servers, transcribed from upstream
// irc/chanserv.go. Used for the UserBox services cheatsheet and for /cs
// subcommand completion. Gated behind Ergo detection like ErgoServices.

import { serviceCapabBadge, parseServiceInput } from './ErgoServices';

// Settings shared by GET #channel <setting> and SET #channel <setting>
// <value>. Values are the exact tokens from HELP.
export const CHANSERV_SETTINGS = [
    { name: 'HISTORY', values: ['off', 'ephemeral', 'on', 'default'] },
    { name: 'QUERY-CUTOFF', values: ['none', 'registration-time', 'join-time', 'default'] },
    { name: 'STORE-EVENTS', values: ['all', 'no-joins', 'none'] },
];

// All ChanServ subcommands, for /cs subcommand completion.
export const CHANSERV_SUBCOMMANDS = [
    'AMODE',
    'CLEAR',
    'DEOP',
    'GET',
    'HOWTOBAN',
    'INFO',
    'LIST',
    'OP',
    'PURGE',
    'REGISTER',
    'SET',
    'TRANSFER',
    'UNREGISTER',
];

// Aliases accepted by the server that have no separate HELP entry.
// Offered in completion only, never as cheatsheet rows.
export const CHANSERV_COMPLETION_ALIASES = [
    'DROP',
];

// Visibility flags per ChanServ command: auth gates on a SASL login,
// capabs gate on operator privileges (see SERVICE_CAPAB_CATEGORIES).
export const CHANSERV_FLAGS = {
    OP: { auth: true },
    REGISTER: { auth: true },
    PURGE: { capabs: ['chanreg'] },
    LIST: { capabs: ['chanreg'] },
};

// Badge for a ChanServ command, or null for regular commands.
export function chanservBadge(cmd) {
    const flags = CHANSERV_FLAGS[cmd];
    return flags ? serviceCapabBadge(flags.capabs) : null;
}

// Completion list selector: visible canonical subcommands plus aliases,
// plus oper-only subcommands when oper is true. Auth-gated commands need
// an authenticated session; capab-gated commands need oper privileges.
export function chanservSubcommands({ oper = false, authenticated = false } = {}) {
    let cmds = CHANSERV_SUBCOMMANDS.concat(CHANSERV_COMPLETION_ALIASES);
    cmds = cmds.filter((cmd) => {
        const flags = CHANSERV_FLAGS[cmd];
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

// Literal syntax strings for /cs completion descriptions.
// Transcribed from upstream HELP. Rendered raw by AutoComplete.
export const CHANSERV_SYNTAX = {
    OP: 'OP #channel [nickname]',
    DEOP: 'DEOP #channel [nickname]',
    REGISTER: 'REGISTER #channel',
    UNREGISTER: 'UNREGISTER #channel [code]',
    DROP: 'DROP #channel [code]',
    AMODE: 'AMODE #channel [mode change] [account]',
    CLEAR: 'CLEAR #channel target',
    TRANSFER: 'TRANSFER [accept] #channel user [code]',
    PURGE: 'PURGE <ADD | DEL | LIST> #channel [code] [reason]',
    LIST: 'LIST [regex]',
    INFO: 'INFO #channel',
    GET: 'GET #channel <setting>',
    SET: 'SET #channel <setting> <value>',
    HOWTOBAN: 'HOWTOBAN #channel <nick>',
};

// True while the input is still in the subcommand token of a /cs (or
// /msg ChanServ) invocation, i.e. '/cs <partial-command>' with nothing
// after it. False once the subcommand is followed by a space, so argument
// words never get subcommand suggestions.
export function isChanservSubcommandPosition(input) {
    if (typeof input !== 'string') {
        return false;
    }
    return /^\/cs\s+[^\s]*$/i.test(input) ||
        /^\/msg\s+ChanServ\s+[^\s]*$/i.test(input);
}

// Syntax for multi-word command paths.
export const CHANSERV_PATH_SYNTAX = {
    'TRANSFER ACCEPT': 'TRANSFER accept #channel',
};

// Argument completion spec, keyed by space-joined upper-case command path.
// Each entry lists the ordered argument slots after the path. A slot is:
//   'settings'           -> CHANSERV_SETTINGS names
//   { valuesOf: name }   -> values of the named setting, or of the setting
//                           named by the previous argument when null
//   { subcommands: [...] } -> a second command word; with orChannels, a
//                           non-matching token instead fills the next slot
//                           as a channel name
//   { channels: scope }  -> channel names, scope one of ops, founder,
//                           known or notFounder
//   { nicksIn: i } / { accountsIn: i } -> nicks / accounts in the channel
//                           named by argument i (previous argument when null)
// Missing entries, missing slots and null slots mean no suggestions; the
// syntax ghost still shows via chanservSyntaxFor().
export const CHANSERV_ARG_SPEC = {
    'OP': [{ channels: 'ops' }, { nicksIn: 0 }],
    'DEOP': [{ channels: 'founder' }, { nicksIn: 0 }],
    'REGISTER': [{ channels: 'ops' }],
    'UNREGISTER': [{ channels: 'founder' }, null],
    'DROP': [{ channels: 'founder' }, null],
    'AMODE': [{ channels: 'ops' }, { accountsIn: 0 }],
    'CLEAR': [{ channels: 'founder' }, { subcommands: ['users', 'access'] }],
    'TRANSFER': [{ subcommands: ['ACCEPT'], orChannels: 'founder' }, { accountsIn: 0 }, null],
    'TRANSFER ACCEPT': [{ channels: 'notFounder' }],
    'PURGE': [{ subcommands: ['ADD', 'DEL', 'LIST'] }],
    'PURGE ADD': [{ channels: 'known' }, null, null],
    'PURGE DEL': [{ channels: 'known' }],
    'PURGE LIST': [],
    'LIST': [],
    'INFO': [{ channels: 'known' }],
    'GET': [{ channels: 'known' }, 'settings'],
    'SET': [{ channels: 'ops' }, 'settings', { valuesOf: null }],
    'HOWTOBAN': [{ channels: 'ops' }, { nicksIn: 0 }],
};

function chanservSettingValues(name) {
    if (!name) {
        return [];
    }
    let setting = CHANSERV_SETTINGS.find((s) => s.name === name.toUpperCase());
    return (setting && setting.values) || [];
}

// Parse a /cs (or /msg ChanServ) input line into its command path and the
// argument slot under completion. Same result shape as parseNickservInput.
export function parseChanservInput(input) {
    return parseServiceInput(input, {
        prefixes: [/^\/cs\s+/i, /^\/msg\s+ChanServ\s+/i],
        aliases: {},
        spec: CHANSERV_ARG_SPEC,
    });
}

// Argument suggestions for a parsed ChanServ input. ctx holds channels
// ({ ops, founder, known, notFounder } name lists), channelUsers and
// channelAccounts (lower-case channel name to value lists); filtering by
// the in-progress token is left to the autocomplete list.
export function chanservArgSuggestions(parsed, ctx) {
    if (!parsed || parsed.argIndex < 0) {
        return [];
    }
    let spec = CHANSERV_ARG_SPEC[parsed.path.join(' ')];
    if (!spec) {
        return [];
    }
    let slot = spec[parsed.argIndex];
    if (!slot) {
        return [];
    }
    if (typeof slot === 'string') {
        if (slot === 'settings') {
            return CHANSERV_SETTINGS.map((s) => s.name);
        }
        return [];
    }
    if (slot.subcommands) {
        let out = slot.subcommands.slice();
        if (slot.orChannels && ctx.channels && ctx.channels[slot.orChannels]) {
            out = out.concat(ctx.channels[slot.orChannels]);
        }
        return out;
    }
    if (slot.valuesOf || slot.valuesOf === null) {
        let name = slot.valuesOf;
        if (name === null) {
            name = parsed.args[parsed.argIndex - 1];
        }
        return chanservSettingValues(name);
    }
    if (slot.channels) {
        let lists = ctx.channels && ctx.channels[slot.channels];
        return lists ? lists.slice() : [];
    }
    if (slot.nicksIn !== undefined || slot.accountsIn !== undefined) {
        let idx = slot.nicksIn !== undefined ? slot.nicksIn : slot.accountsIn;
        if (idx === null || idx === undefined) {
            idx = parsed.argIndex - 1;
        }
        let channel = (parsed.args[idx] || '').toLowerCase();
        if (!channel) {
            return [];
        }
        if (slot.nicksIn !== undefined) {
            let nicks = ctx.channelUsers && ctx.channelUsers[channel];
            return nicks ? nicks.slice() : [];
        }
        let accounts = ctx.channelAccounts && ctx.channelAccounts[channel];
        return accounts ? accounts.slice() : [];
    }
    return [];
}

// Syntax ghost for a parsed command path: the longest matching path syntax,
// falling back to the first word's syntax, or '' when unknown.
export function chanservSyntaxFor(path) {
    if (!path || !path.length) {
        return '';
    }
    for (let len = path.length; len > 0; len--) {
        let key = path.slice(0, len).join(' ');
        if (CHANSERV_PATH_SYNTAX[key]) {
            return CHANSERV_PATH_SYNTAX[key];
        }
        if (len === 1 && CHANSERV_SYNTAX[key]) {
            return CHANSERV_SYNTAX[key];
        }
    }
    return '';
}
