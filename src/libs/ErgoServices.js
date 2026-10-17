'kiwi public';

// NickServ command data for Ergo servers, transcribed from a NickServ HELP
// dump (see NephIRC_NickServ_2026-10-16.txt in the repo root, which is not
// part of the build). Used for the UserBox services cheatsheet and for /ns
// subcommand completion. ChanServ is intentionally not covered yet.

// Settings shared by GET <setting> and SET <setting> <value>. Values are the
// exact tokens from HELP; a null list means free-form (or undocumented).
export const NICKSERV_SETTINGS = [
    { name: 'ENFORCE', values: ['none', 'strict', 'default'] },
    { name: 'MULTICLIENT', values: ['on', 'off', 'default'] },
    { name: 'AUTOREPLAY-LINES', values: ['number-or-0', 'default'] },
    { name: 'REPLAY-JOINS', values: ['always', 'commands-only'] },
    { name: 'ALWAYS-ON', values: ['true', 'false', 'default'] },
    { name: 'AUTOREPLAY-MISSED', values: ['on', 'off'] },
    { name: 'DM-HISTORY', values: ['off', 'ephemeral', 'on', 'default'] },
    { name: 'AUTO-AWAY', values: ['true', 'false', 'default'] },
    { name: 'EMAIL', values: null },
];

// All NickServ subcommands, for /ns subcommand completion.
export const NICKSERV_SUBCOMMANDS = [
    'CERT',
    'CLIENTS',
    'DROP',
    'GET',
    'GHOST',
    'GROUP',
    'HELP',
    'IDENTIFY',
    'INFO',
    'PASSWD',
    'PUSH',
    'REGISTER',
    'RESETPASS',
    'SENDPASS',
    'SET',
    'UNREGISTER',
    'VERIFY',
];

// Oper-only subcommands (require oper privileges; not in regular HELP).
// Shown in /ns completion only when network.is_oper is true.
export const NICKSERV_OPER_SUBCOMMANDS = [
    'LIST',
    'SADROP',
    'SAREGISTER',
    'SAVERIFY',
    'ERASE',
    'SAGET',
    'SASET',
    'SUSPEND',
    'RENAME',
];

// Aliases accepted by the server that have no separate HELP entry.
// Offered in completion only, never as cheatsheet rows. ENFORCE is hidden
// server-side and is not a valid bare subcommand, so it is not offered.
export const NICKSERV_COMPLETION_ALIASES = [
    'PASSWORD',
];

// Oper-capability categories for completion badges. SERVER marks Server
// Administration commands, CHAT marks Chat Moderation commands.
export const SERVICE_CAPAB_CATEGORIES = {
    SERVER: ['rehash', 'accreg', 'chanreg', 'history', 'defcon', 'massmessage', 'metadata'],
    CHAT: ['kill', 'ban', 'nofakelag', 'relaymsg', 'vhosts', 'sajoin', 'samode', 'snomasks', 'roleplay'],
};

// Badge for a list of oper capabs, or null when none apply.
export function serviceCapabBadge(capabs) {
    if (!capabs) {
        return null;
    }
    if (capabs.some((c) => SERVICE_CAPAB_CATEGORIES.SERVER.includes(c))) {
        return 'SERVER';
    }
    if (capabs.some((c) => SERVICE_CAPAB_CATEGORIES.CHAT.includes(c))) {
        return 'CHAT';
    }
    return null;
}

// Visibility flags per NickServ command: auth gates on a SASL login,
// capabs gate on operator privileges (see SERVICE_CAPAB_CATEGORIES).
export const NICKSERV_FLAGS = {
    DROP: { auth: true },
    GHOST: { auth: true },
    GROUP: { auth: true },
    GET: { auth: true },
    SET: { auth: true },
    LIST: { capabs: ['accreg'] },
    SADROP: { capabs: ['accreg'] },
    SAREGISTER: { capabs: ['accreg'] },
    SAVERIFY: { capabs: ['accreg'] },
    ERASE: { capabs: ['accreg'] },
    SAGET: { capabs: ['accreg'] },
    SASET: { capabs: ['accreg'] },
    RENAME: { capabs: ['accreg'] },
    SUSPEND: { capabs: ['ban'] },
};

// Badge for a NickServ command, or null for regular commands.
export function nickservBadge(cmd) {
    const flags = NICKSERV_FLAGS[cmd];
    return flags ? serviceCapabBadge(flags.capabs) : null;
}

// Completion list selector: visible canonical subcommands plus aliases,
// plus oper-only subcommands when oper is true. Auth-gated commands need
// an authenticated session; capab-gated commands need oper privileges.
export function nickservSubcommands({ oper = false, authenticated = false } = {}) {
    let cmds = NICKSERV_SUBCOMMANDS.concat(NICKSERV_COMPLETION_ALIASES);
    cmds = cmds.filter((cmd) => {
        const flags = NICKSERV_FLAGS[cmd];
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
    if (oper) {
        cmds = cmds.concat(NICKSERV_OPER_SUBCOMMANDS);
    }
    return cmds;
}

// True while the input is still in the subcommand token of a /ns (or
// /msg NickServ) invocation, i.e. '/ns <partial-command>' with nothing
// after it. False once the subcommand is followed by a space, so argument
// words never get subcommand suggestions.
export function isNickservSubcommandPosition(input) {
    if (typeof input !== 'string') {
        return false;
    }
    return /^\/ns\s+[^\s]*$/i.test(input) ||
        /^\/msg\s+NickServ\s+[^\s]*$/i.test(input);
}

// Literal syntax strings for /ns completion descriptions.
// Transcribed from the HELP dump; oper-only entries have no public HELP
// so they use a generic placeholder. Rendered raw by AutoComplete.
export const NICKSERV_SYNTAX = {
    CERT: 'CERT <LIST | ADD | DEL> [account] [certfp]',
    DROP: 'DROP [nickname]',
    GET: 'GET <setting>',
    GHOST: 'GHOST <nickname>',
    GROUP: 'GROUP',
    HELP: 'HELP <command>',
    IDENTIFY: 'IDENTIFY <username> [password]',
    INFO: 'INFO [username]',
    PASSWD: 'PASSWD <current> <new> <new_again>',
    PUSH: 'PUSH <LIST | DELETE> [endpoint]',
    REGISTER: 'REGISTER <password> [email]',
    RESETPASS: 'RESETPASS <account> <code> <password>',
    SENDPASS: 'SENDPASS <account>',
    SET: 'SET <setting> <value>',
    UNREGISTER: 'UNREGISTER <username> [code]',
    VERIFY: 'VERIFY <username> <code>',
    CLIENTS: 'CLIENTS <LIST | LOGOUT> [nickname] [...]',
    PASSWORD: 'PASSWORD <current> <new> <new_again>',
    ENFORCE: 'ENFORCE [method]',
    SESSIONS: 'SESSIONS [nickname]',
    VERIFYEMAIL: 'VERIFYEMAIL ...',
    LIST: 'LIST [regex]',
    SADROP: 'SADROP <nickname>',
    SAREGISTER: 'SAREGISTER <username> [password]',
    SAVERIFY: 'SAVERIFY <username>',
    ERASE: 'ERASE <username> [code]',
    SAGET: 'SAGET <account> <setting>',
    SASET: 'SASET <account> <setting> <value>',
    SUSPEND: 'SUSPEND <ADD | DEL | LIST> [...]',
    RENAME: 'RENAME <account> <newname>',
};

// Syntax for multi-word command paths (subcommand + sub-subcommand).
// Transcribed from upstream HELP; oper-only paths use exact upstream
// syntax where known.
export const NICKSERV_PATH_SYNTAX = {
    'CERT LIST': 'CERT LIST [account]',
    'CERT ADD': 'CERT ADD [account] <fingerprint>',
    'CERT DEL': 'CERT DEL [account] <fingerprint>',
    'CLIENTS LIST': 'CLIENTS LIST [nickname]',
    'CLIENTS LOGOUT': 'CLIENTS LOGOUT [nickname] [client_id/all]',
    'PUSH LIST': 'PUSH LIST',
    'PUSH DELETE': 'PUSH DELETE <endpoint>',
    'SUSPEND ADD': 'SUSPEND ADD <nickname> [DURATION duration] [reason]',
    'SUSPEND DEL': 'SUSPEND DEL <nickname>',
    'SUSPEND LIST': 'SUSPEND LIST',
};

// Commands hidden server-side: never offered in top-level completion, but
// recognized when typed so they still get syntax ghosts and argument help.
export const NICKSERV_HIDDEN_SUBCOMMANDS = [
    'ENFORCE',
    'SESSIONS',
    'VERIFYEMAIL',
];

// First-word aliases mapping to their canonical command path.
const NICKSERV_PATH_ALIASES = {
    PASSWORD: 'PASSWD',
};

// Argument completion spec, keyed by space-joined upper-case command path.
// Each entry lists the ordered argument slots after the path. A slot is:
//   'settings'           -> NICKSERV_SETTINGS names
//   { valuesOf: name }   -> values of the named setting, or of the setting
//                           named by the previous argument when null
//   { subcommands: [...] } -> a second command word
//   'selfNick' / 'selfAccount' -> the user's own nick / account
//   'knownNicks' / 'knownAccounts' -> nicks / accounts known to us
//   'selfOrKnownNicks' / 'selfOrKnownAccounts' -> own value for regular
//                           users, known values for opers
// Missing entries, missing slots and null slots mean no suggestions; the
// syntax ghost still shows via nickservSyntaxFor().
export const NICKSERV_ARG_SPEC = {
    'CERT': [{ subcommands: ['LIST', 'ADD', 'DEL'] }],
    'CERT LIST': ['selfOrKnownAccounts'],
    'CERT ADD': ['selfOrKnownAccounts'],
    'CERT DEL': ['selfOrKnownAccounts'],
    'CLIENTS': [{ subcommands: ['LIST', 'LOGOUT'] }],
    'CLIENTS LIST': ['selfOrKnownNicks'],
    'CLIENTS LOGOUT': ['selfOrKnownNicks', null],
    'SESSIONS': ['selfOrKnownNicks'],
    'ENFORCE': [{ valuesOf: 'ENFORCE' }],
    'INFO': ['knownAccounts'],
    'ERASE': ['knownAccounts'],
    'SADROP': ['knownNicks'],
    'SUSPEND ADD': ['knownNicks'],
    'SUSPEND DEL': ['knownNicks'],
    'RENAME': ['knownAccounts', null],
    'UNREGISTER': ['selfOrKnownAccounts'],
    'SENDPASS': ['selfOrKnownAccounts'],
    'RESETPASS': ['selfOrKnownAccounts', null, null],
    'GET': ['settings'],
    'SAGET': ['knownAccounts', 'settings'],
    'SET': ['settings', { valuesOf: null }],
    'SASET': ['knownAccounts', 'settings', { valuesOf: null }],
    'PUSH': [{ subcommands: ['LIST', 'DELETE'] }],
    'SUSPEND': [{ subcommands: ['ADD', 'DEL', 'LIST'] }],
    'DROP': [],
    'GHOST': [],
    'GROUP': [],
    'IDENTIFY': [],
    'LIST': [],
    'REGISTER': [],
    'SAREGISTER': [],
    'SAVERIFY': [],
    'VERIFY': [],
    'PASSWD': [],
    'PUSH LIST': [],
    'PUSH DELETE': [],
    'SUSPEND LIST': [],
    'VERIFYEMAIL': [],
};

// Shared spec-driven service input parser. opts holds prefix regexes,
// first-word aliases, and the command spec table. A slot shaped
// { subcommands: [...], orChannels } consumes a matching second token into
// the path; orChannels additionally lets a non-matching token stand as a
// channel argument for the next slot.
export function parseServiceInput(input, opts) {
    if (typeof input !== 'string') {
        return null;
    }
    let m = null;
    opts.prefixes.forEach((prefix) => {
        m = m || input.match(prefix);
    });
    if (!m) {
        return null;
    }
    let rest = input.slice(m[0].length);
    let trailingSpace = /\s$/.test(input);
    let tokens = rest.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) {
        return null;
    }
    let cmd = tokens[0].toUpperCase();
    if (opts.aliases[cmd]) {
        cmd = opts.aliases[cmd];
    }
    let spec = opts.spec[cmd];
    if (!spec) {
        return null;
    }
    if (tokens.length === 1) {
        if (!trailingSpace) {
            return null;
        }
        return { path: [cmd], argIndex: 0, args: [], partial: '' };
    }
    if (spec.length > 0 && spec[0] && spec[0].subcommands) {
        let sub = tokens[1].toUpperCase();
        if (tokens.length === 2 && !trailingSpace) {
            return { path: [cmd], argIndex: 0, args: [], partial: tokens[1] };
        }
        if (spec[0].subcommands.indexOf(sub) !== -1) {
            let args = tokens.slice(2);
            if (args.length === 0) {
                return { path: [cmd, sub], argIndex: 0, args: [], partial: '' };
            }
            if (!trailingSpace) {
                return {
                    path: [cmd, sub],
                    argIndex: args.length - 1,
                    args: args,
                    partial: args[args.length - 1],
                };
            }
            return { path: [cmd, sub], argIndex: args.length, args: args, partial: '' };
        }
        if (spec[0].orChannels) {
            let args = tokens.slice(1);
            if (!trailingSpace) {
                return {
                    path: [cmd],
                    argIndex: args.length - 1,
                    args: args,
                    partial: args[args.length - 1],
                };
            }
            return { path: [cmd], argIndex: args.length, args: args, partial: '' };
        }
        return { path: [cmd], argIndex: -1, args: tokens.slice(1), partial: tokens[1] };
    }
    let args = tokens.slice(1);
    if (!trailingSpace) {
        return {
            path: [cmd],
            argIndex: args.length - 1,
            args: args,
            partial: args[args.length - 1],
        };
    }
    return { path: [cmd], argIndex: args.length, args: args, partial: '' };
}

// Parse a /ns (or /msg NickServ) input line into its command path and the
// argument slot under completion. Returns null when the input is not a
// NickServ invocation, is still in the first subcommand token, or names an
// unknown command. Otherwise returns { path, argIndex, args, partial }:
// path is the upper-case command words, argIndex the slot being completed
// (-1 when the subcommand word itself is unknown), args the raw argument
// tokens after the path, partial the in-progress token ('' after a space).
export function parseNickservInput(input) {
    return parseServiceInput(input, {
        prefixes: [/^\/ns\s+/i, /^\/msg\s+NickServ\s+/i],
        aliases: NICKSERV_PATH_ALIASES,
        spec: NICKSERV_ARG_SPEC,
    });
}

function nickservSettingValues(name) {
    if (!name) {
        return [];
    }
    let setting = NICKSERV_SETTINGS.find((s) => s.name === name.toUpperCase());
    return (setting && setting.values) || [];
}

// Argument suggestions for a parsed NickServ input. ctx holds oper,
// selfNick, selfAccount, knownNicks and knownAccounts; filtering by the
// in-progress token is left to the autocomplete list.
export function nickservArgSuggestions(parsed, ctx) {
    if (!parsed || parsed.argIndex < 0) {
        return [];
    }
    let spec = NICKSERV_ARG_SPEC[parsed.path.join(' ')];
    if (!spec) {
        return [];
    }
    let slot = spec[parsed.argIndex];
    if (!slot) {
        return [];
    }
    if (typeof slot === 'string') {
        switch (slot) {
        case 'settings':
            return NICKSERV_SETTINGS.map((s) => s.name);
        case 'knownNicks':
            return (ctx.knownNicks || []).slice();
        case 'knownAccounts':
            return (ctx.knownAccounts || []).slice();
        case 'selfNick':
            return ctx.selfNick ? [ctx.selfNick] : [];
        case 'selfAccount':
            return ctx.selfAccount ? [ctx.selfAccount] : [];
        case 'selfOrKnownNicks':
            if (ctx.oper) {
                return (ctx.knownNicks || []).slice();
            }
            return ctx.selfNick ? [ctx.selfNick] : [];
        case 'selfOrKnownAccounts':
            if (ctx.oper) {
                return (ctx.knownAccounts || []).slice();
            }
            return ctx.selfAccount ? [ctx.selfAccount] : [];
        default:
            return [];
        }
    }
    if (slot.subcommands) {
        return slot.subcommands.slice();
    }
    if (slot.valuesOf || slot.valuesOf === null) {
        let name = slot.valuesOf;
        if (name === null) {
            name = parsed.args[parsed.argIndex - 1];
        }
        return nickservSettingValues(name);
    }
    return [];
}

// Syntax ghost for a parsed command path: the longest matching path syntax,
// falling back to the first word's syntax, or '' when unknown.
export function nickservSyntaxFor(path) {
    if (!path || !path.length) {
        return '';
    }
    for (let len = path.length; len > 0; len--) {
        let key = path.slice(0, len).join(' ');
        if (NICKSERV_PATH_SYNTAX[key]) {
            return NICKSERV_PATH_SYNTAX[key];
        }
        if (len === 1 && NICKSERV_SYNTAX[key]) {
            return NICKSERV_SYNTAX[key];
        }
    }
    return '';
}

export function nickservGetFill(setting) {
    return `/msg NickServ GET ${setting}`;
}

export function nickservSetFill(setting) {
    return `/msg NickServ SET ${setting} `;
}

export function nickservPasswdFill() {
    return '/msg NickServ PASSWD ';
}

// UNREGISTER fills WITHOUT the account name so the user must type the
// confirmation (their own nick) by hand.
export function nickservUnregisterFill() {
    return '/msg NickServ UNREGISTER ';
}
