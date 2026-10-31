'kiwi public';

// BouncerServ command data for Soju, transcribed from upstream service.go.
// Soju command names are lowercase and case-sensitive. Used for the UserBox
// cheatsheet and /msg BouncerServ completion.

import { parseServiceInput } from './ErgoServices';

export const BOUNCERSERV_SUBCOMMANDS = [
    'help',
    'network',
    'certfp',
    'sasl',
    'user',
    'channel',
    'device-certificate',
    'server',
];

// Leaf commands shown in the cheatsheet, in upstream order.
export const BOUNCERSERV_COMMANDS = [
    { path: 'help', syntax: 'help [command]' },
    { path: 'network create', syntax: 'network create -addr <addr> [-name name] [-username username] [-pass pass] [-realname realname] [-certfp fingerprint] [-nick nick] [-auto-away auto-away] [-enabled enabled] [-ignore-limit ignore-limit] [-connect-command command]...' },
    { path: 'network status', syntax: 'network status' },
    { path: 'network update', syntax: 'network update [name] [-addr addr] [-name name] [-username username] [-pass pass] [-realname realname] [-certfp fingerprint] [-nick nick] [-auto-away auto-away] [-enabled enabled] [-ignore-limit ignore-limit] [-connect-command command]...' },
    { path: 'network delete', syntax: 'network delete [name]' },
    { path: 'network quote', syntax: 'network quote [name] <command>' },
    { path: 'certfp generate', syntax: 'certfp generate [-key-type rsa|ecdsa|ed25519] [-bits N] [-network name]' },
    { path: 'certfp fingerprint', syntax: 'certfp fingerprint [-network name]' },
    { path: 'sasl status', syntax: 'sasl status [-network name]' },
    { path: 'sasl set-plain', syntax: 'sasl set-plain [-network name] <username> <password>' },
    { path: 'sasl reset', syntax: 'sasl reset [-network name]' },
    { path: 'user status', syntax: 'user status [username]' },
    { path: 'user create', syntax: 'user create -username <username> -password <password> [-disable-password] [-admin true|false] [-nick <nick>] [-realname <realname>] [-enabled true|false] [-max-networks <max-networks>]' },
    { path: 'user update', syntax: 'user update [username] [-password <password>] [-disable-password] [-admin true|false] [-nick <nick>] [-realname <realname>] [-enabled true|false] [-max-networks <max-networks>]' },
    { path: 'user delete', syntax: 'user delete <username> [confirmation token]' },
    { path: 'user run', syntax: 'user run <username> <command>' },
    { path: 'channel status', syntax: 'channel status [-network name]' },
    { path: 'channel create', syntax: 'channel create <name> [-detached true|false] [-relay-detached default|none|highlight|message] [-reattach-on default|none|highlight|message] [-detach-after <duration>] [-detach-on default|none|highlight|message]' },
    { path: 'channel update', syntax: 'channel update <name> [-detached true|false] [-relay-detached default|none|highlight|message] [-reattach-on default|none|highlight|message] [-detach-after <duration>] [-detach-on default|none|highlight|message]' },
    { path: 'channel delete', syntax: 'channel delete <name>' },
    { path: 'device-certificate status', syntax: 'device-certificate status' },
    { path: 'device-certificate create', syntax: 'device-certificate create -fingerprint <fingerprint> -label <label>' },
    { path: 'device-certificate delete', syntax: 'device-certificate delete <fingerprint>' },
    { path: 'server status', syntax: 'server status' },
    { path: 'server notice', syntax: 'server notice <notice>' },
    { path: 'server debug', syntax: 'server debug true|false' },
];

// Common commands shown in the UserBox cheatsheet. Autocomplete still uses
// the full command set above.
export const BOUNCERSERV_CHEATSHEET = [
    { path: 'network create', labelKey: 'bouncerserv_network_create' },
    { path: 'network status', labelKey: 'bouncerserv_network_status' },
    { path: 'network update', labelKey: 'bouncerserv_network_update' },
    { path: 'network delete', labelKey: 'bouncerserv_network_delete' },
    { path: 'network quote', labelKey: 'bouncerserv_network_quote' },
    { path: 'sasl status', labelKey: 'bouncerserv_sasl_status' },
    { path: 'sasl set-plain', labelKey: 'bouncerserv_sasl_set_plain' },
    { path: 'sasl reset', labelKey: 'bouncerserv_sasl_reset' },
];

export const BOUNCERSERV_SYNTAX = {
    'help': 'help [command]',
    'network': 'network <create|status|update|delete|quote>',
    'certfp': 'certfp <generate|fingerprint>',
    'sasl': 'sasl <status|set-plain|reset>',
    'user': 'user <status|create|update|delete|run>',
    'channel': 'channel <status|create|update|delete>',
    'device-certificate': 'device-certificate <status|create|delete>',
    'server': 'server <status|notice|debug>',
};
BOUNCERSERV_COMMANDS.forEach((command) => {
    BOUNCERSERV_SYNTAX[command.path] = command.syntax;
});

export const BOUNCERSERV_ARG_SPEC = {
    'help': [{ subcommands: BOUNCERSERV_SUBCOMMANDS }],
    'network': [{ subcommands: ['create', 'status', 'update', 'delete', 'quote'] }],
    'certfp': [{ subcommands: ['generate', 'fingerprint'] }],
    'sasl': [{ subcommands: ['status', 'set-plain', 'reset'] }],
    'user': [{ subcommands: ['status', 'create', 'update', 'delete', 'run'] }],
    'channel': [{ subcommands: ['status', 'create', 'update', 'delete'] }],
    'device-certificate': [{ subcommands: ['status', 'create', 'delete'] }],
    'server': [{ subcommands: ['status', 'notice', 'debug'] }],
};

// True while the input is still in the top-level command token of a
// /msg BouncerServ invocation.
export function isBouncerservSubcommandPosition(input) {
    if (typeof input !== 'string') {
        return false;
    }
    return /^\/msg\s+BouncerServ\s+[^\s]*$/i.test(input);
}

export function parseBouncerservInput(input) {
    return parseServiceInput(input, {
        prefixes: [/^\/msg\s+BouncerServ\s+/i],
        aliases: {},
        spec: BOUNCERSERV_ARG_SPEC,
        preserveCase: true,
    });
}

export function bouncerservArgSuggestions(parsed) {
    if (!parsed || parsed.argIndex < 0) {
        return [];
    }
    let spec = BOUNCERSERV_ARG_SPEC[parsed.path.join(' ')];
    if (!spec) {
        return [];
    }
    let slot = spec[parsed.argIndex];
    if (!slot || !slot.subcommands) {
        return [];
    }
    return slot.subcommands.slice();
}

export function bouncerservSyntaxFor(path) {
    if (!path || !path.length) {
        return '';
    }
    for (let len = path.length; len > 0; len--) {
        let key = path.slice(0, len).join(' ');
        if (BOUNCERSERV_SYNTAX[key]) {
            return BOUNCERSERV_SYNTAX[key];
        }
    }
    return '';
}
