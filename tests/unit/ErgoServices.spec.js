import {
    serviceCapabBadge,
    parseServiceInput,
    nickservSubcommands,
    nickservBadge,
    NICKSERV_SUBCOMMANDS,
    NICKSERV_OPER_SUBCOMMANDS,
    NICKSERV_COMPLETION_ALIASES,
    NICKSERV_HIDDEN_SUBCOMMANDS,
    NICKSERV_FLAGS
} from '@/libs/ErgoServices';
import {
    chanservSubcommands,
    chanservBadge,
    CHANSERV_SUBCOMMANDS,
    CHANSERV_COMPLETION_ALIASES,
    CHANSERV_FLAGS
} from '@/libs/ErgoChanServ';
import {
    hostservSubcommands,
    hostservBadge,
    HOSTSERV_SUBCOMMANDS,
    HOSTSERV_FLAGS
} from '@/libs/ErgoHostServ';
import {
    histservSubcommands,
    histservBadge,
    HISTSERV_SUBCOMMANDS,
    HISTSERV_FLAGS
} from '@/libs/ErgoHistServ';

// Shared engine + per-service descriptor table. The generic assertions that
// every service shares live here; each service keeps its own argument
// completion and syntax tests in its own *_Completion.spec.js file.
describe('serviceCapabBadge', () => {
    test('badges server-administration capabs', () => {
        expect(serviceCapabBadge(['rehash'])).toBe('SERVER');
        expect(serviceCapabBadge(['massmessage'])).toBe('SERVER');
    });

    test('badges chat-moderation capabs', () => {
        expect(serviceCapabBadge(['kill'])).toBe('CHAT');
        expect(serviceCapabBadge(['ban'])).toBe('CHAT');
    });

    test('prefers the server badge when both categories apply', () => {
        expect(serviceCapabBadge(['vhosts', 'rehash'])).toBe('SERVER');
    });

    test('returns null without an applicable capab', () => {
        expect(serviceCapabBadge([])).toBeNull();
        expect(serviceCapabBadge(['unknown'])).toBeNull();
        expect(serviceCapabBadge(null)).toBeNull();
        expect(serviceCapabBadge(undefined)).toBeNull();
    });
});

describe('parseServiceInput', () => {
    const OPTS = {
        prefixes: [/^\/svc\s+/i],
        aliases: { PASSWORD: 'PASSWD' },
        spec: {
            PASSWD: ['knownAccounts'],
            CERT: [{ subcommands: ['LIST', 'ADD', 'DEL'] }],
            TRANSFER: [{ subcommands: ['ACCEPT'], orChannels: 'founder' }],
            DROP: [],
        },
    };

    test('returns null outside a recognised invocation', () => {
        expect(parseServiceInput(null, OPTS)).toBeNull();
        expect(parseServiceInput(undefined, OPTS)).toBeNull();
        expect(parseServiceInput('hello', OPTS)).toBeNull();
        expect(parseServiceInput('/other PASSWD ', OPTS)).toBeNull();
        expect(parseServiceInput('/svc ', OPTS)).toBeNull();
        expect(parseServiceInput('/svc NOPE ', OPTS)).toBeNull();
        expect(parseServiceInput('/svc PASSWD', OPTS)).toBeNull();
    });

    test('returns a bare command once a trailing space follows it', () => {
        expect(parseServiceInput('/svc PASSWD ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: [], partial: '',
        });
    });

    test('resolves first-word aliases', () => {
        expect(parseServiceInput('/svc PASSWORD ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: [], partial: '',
        });
    });

    test('tracks the argument slot under completion', () => {
        expect(parseServiceInput('/svc PASSWD bob', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: ['bob'], partial: 'bob',
        });
        expect(parseServiceInput('/svc PASSWD bob ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 1, args: ['bob'], partial: '',
        });
        expect(parseServiceInput('/svc DROP a b', OPTS)).toEqual({
            path: ['DROP'], argIndex: 1, args: ['a', 'b'], partial: 'b',
        });
    });

    test('consumes a recognised second-word subcommand into the path', () => {
        expect(parseServiceInput('/svc CERT ADD ', OPTS)).toEqual({
            path: ['CERT', 'ADD'], argIndex: 0, args: [], partial: '',
        });
        expect(parseServiceInput('/svc CERT ADD fp ', OPTS)).toEqual({
            path: ['CERT', 'ADD'], argIndex: 1, args: ['fp'], partial: '',
        });
    });

    test('marks an unrecognised second word as a bad argument', () => {
        expect(parseServiceInput('/svc CERT zzz ', OPTS)).toEqual({
            path: ['CERT'], argIndex: -1, args: ['zzz'], partial: 'zzz',
        });
    });

    test('orChannels lets a non-subcommand token stand as an argument', () => {
        expect(parseServiceInput('/svc TRANSFER ACCEPT ', OPTS)).toEqual({
            path: ['TRANSFER', 'ACCEPT'], argIndex: 0, args: [], partial: '',
        });
        expect(parseServiceInput('/svc TRANSFER #chan extra', OPTS)).toEqual({
            path: ['TRANSFER'], argIndex: 1, args: ['#chan', 'extra'], partial: 'extra',
        });
    });
});

const SERVICES = [
    {
        name: 'NickServ',
        subcommands: nickservSubcommands,
        badge: nickservBadge,
        list: NICKSERV_SUBCOMMANDS,
        aliases: NICKSERV_COMPLETION_ALIASES,
        operOnly: NICKSERV_OPER_SUBCOMMANDS,
        hidden: NICKSERV_HIDDEN_SUBCOMMANDS,
        flags: NICKSERV_FLAGS,
    },
    {
        name: 'ChanServ',
        subcommands: chanservSubcommands,
        badge: chanservBadge,
        list: CHANSERV_SUBCOMMANDS,
        aliases: CHANSERV_COMPLETION_ALIASES,
        operOnly: [],
        hidden: [],
        flags: CHANSERV_FLAGS,
    },
    {
        name: 'HostServ',
        subcommands: hostservSubcommands,
        badge: hostservBadge,
        list: HOSTSERV_SUBCOMMANDS,
        aliases: [],
        operOnly: [],
        hidden: [],
        flags: HOSTSERV_FLAGS,
    },
    {
        name: 'HistServ',
        subcommands: histservSubcommands,
        badge: histservBadge,
        list: HISTSERV_SUBCOMMANDS,
        aliases: [],
        operOnly: [],
        hidden: [],
        flags: HISTSERV_FLAGS,
    },
];

SERVICES.forEach((svc) => {
    describe(`${svc.name} completion contract`, () => {
        test('offers every non-hidden command to an authenticated oper', () => {
            const offered = svc.subcommands({ oper: true, authenticated: true });
            svc.list.concat(svc.aliases, svc.operOnly).forEach((cmd) => {
                expect(offered).toContain(cmd);
            });
            svc.hidden.forEach((cmd) => {
                expect(offered).not.toContain(cmd);
            });
        });

        test('hides capab-gated commands from non-opers', () => {
            const offered = svc.subcommands({ oper: false, authenticated: true });
            Object.keys(svc.flags).forEach((cmd) => {
                if (svc.flags[cmd].capabs) {
                    expect(offered).not.toContain(cmd);
                }
            });
            // Ungated commands stay available
            svc.list.filter((cmd) => !svc.flags[cmd]).forEach((cmd) => {
                expect(offered).toContain(cmd);
            });
        });

        test('hides auth-gated commands when not authenticated', () => {
            const offered = svc.subcommands({ oper: true, authenticated: false });
            Object.keys(svc.flags).forEach((cmd) => {
                if (svc.flags[cmd].auth) {
                    expect(offered).not.toContain(cmd);
                }
            });
        });

        test('badges commands from their capabs', () => {
            Object.keys(svc.flags).forEach((cmd) => {
                expect(svc.badge(cmd)).toBe(serviceCapabBadge(svc.flags[cmd].capabs));
            });
            expect(svc.badge('NOT_A_COMMAND')).toBeNull();
        });
    });
});
