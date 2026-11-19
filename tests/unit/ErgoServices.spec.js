import {
    serviceCapabBadge,
    parseServiceInput,
    nickservSubcommands,
    nickservBadge,
    NICKSERV_SUBCOMMANDS,
    NICKSERV_OPER_SUBCOMMANDS,
    NICKSERV_COMPLETION_ALIASES,
    NICKSERV_HIDDEN_SUBCOMMANDS,
    NICKSERV_FLAGS,
    NICKSERV_SETTINGS,
    parseNickservInput,
    nickservArgSuggestions,
    nickservSyntaxFor
} from '@/libs/ErgoServices';
import {
    chanservSubcommands,
    chanservBadge,
    CHANSERV_SUBCOMMANDS,
    CHANSERV_COMPLETION_ALIASES,
    CHANSERV_FLAGS,
    CHANSERV_SYNTAX,
    CHANSERV_SETTINGS,
    isChanservSubcommandPosition,
    parseChanservInput,
    chanservArgSuggestions,
    chanservSyntaxFor
} from '@/libs/ErgoChanServ';
import {
    hostservSubcommands,
    hostservBadge,
    HOSTSERV_SUBCOMMANDS,
    HOSTSERV_FLAGS,
    HOSTSERV_SYNTAX,
    isHostservSubcommandPosition,
    parseHostservInput,
    hostservArgSuggestions,
    hostservSyntaxFor
} from '@/libs/ErgoHostServ';
import {
    histservSubcommands,
    histservBadge,
    HISTSERV_SUBCOMMANDS,
    HISTSERV_FLAGS,
    HISTSERV_SYNTAX,
    isHistservSubcommandPosition,
    parseHistservInput,
    histservArgSuggestions,
    histservSyntaxFor
} from '@/libs/ErgoHistServ';

// Shared engine + per-service descriptor table. The generic assertions that
// every service shares live here; each service keeps its own argument
// completion and syntax tests in its own *_Completion.spec.js file.
describe('serviceCapabBadge', () => {
    test('badges server, chat, mixed, and unknown capabs', () => {
        expect(serviceCapabBadge(['rehash'])).toBe('SERVER');
        expect(serviceCapabBadge(['massmessage'])).toBe('SERVER');
        expect(serviceCapabBadge(['kill'])).toBe('CHAT');
        expect(serviceCapabBadge(['ban'])).toBe('CHAT');
        expect(serviceCapabBadge(['vhosts', 'rehash'])).toBe('SERVER');
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

    test('resolves bare commands and aliases', () => {
        expect(parseServiceInput('/svc PASSWD ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: [], partial: '',
        });
        expect(parseServiceInput('/svc PASSWORD ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: [], partial: '',
        });
    });

    test('tracks arguments and path subcommands', () => {
        expect(parseServiceInput('/svc PASSWD bob', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 0, args: ['bob'], partial: 'bob',
        });
        expect(parseServiceInput('/svc PASSWD bob ', OPTS)).toEqual({
            path: ['PASSWD'], argIndex: 1, args: ['bob'], partial: '',
        });
        expect(parseServiceInput('/svc DROP a b', OPTS)).toEqual({
            path: ['DROP'], argIndex: 1, args: ['a', 'b'], partial: 'b',
        });
        expect(parseServiceInput('/svc CERT ADD ', OPTS)).toEqual({
            path: ['CERT', 'ADD'], argIndex: 0, args: [], partial: '',
        });
        expect(parseServiceInput('/svc CERT ADD fp ', OPTS)).toEqual({
            path: ['CERT', 'ADD'], argIndex: 1, args: ['fp'], partial: '',
        });
        expect(parseServiceInput('/svc CERT zzz ', OPTS)).toEqual({
            path: ['CERT'], argIndex: -1, args: ['zzz'], partial: 'zzz',
        });
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
        test('applies visibility and badge rules', () => {
            const offered = svc.subcommands({ oper: true, authenticated: true });
            svc.list.concat(svc.aliases, svc.operOnly).forEach((cmd) => {
                expect(offered).toContain(cmd);
            });
            svc.hidden.forEach((cmd) => {
                expect(offered).not.toContain(cmd);
            });

            const nonOper = svc.subcommands({ oper: false, authenticated: true });
            Object.keys(svc.flags).forEach((cmd) => {
                if (svc.flags[cmd].capabs) {
                    expect(nonOper).not.toContain(cmd);
                }
            });
            svc.list.filter((cmd) => !svc.flags[cmd]).forEach((cmd) => {
                expect(nonOper).toContain(cmd);
            });

            const loggedOut = svc.subcommands({ oper: true, authenticated: false });
            Object.keys(svc.flags).forEach((cmd) => {
                if (svc.flags[cmd].auth) {
                    expect(loggedOut).not.toContain(cmd);
                }
            });

            Object.keys(svc.flags).forEach((cmd) => {
                expect(svc.badge(cmd)).toBe(serviceCapabBadge(svc.flags[cmd].capabs));
            });
            expect(svc.badge('NOT_A_COMMAND')).toBeNull();
        });
    });
});

describe('chanserv completion', () => {
    const ctx = {
        channels: {
            ops: ['#ops'],
            founder: ['#owned'],
            known: ['#ops', '#owned', '#public'],
            notFounder: ['#ops', '#public'],
        },
        channelUsers: {
            '#ops': ['Alice', 'Bob'],
            '#owned': ['Carol'],
        },
        channelAccounts: {
            '#ops': ['alice'],
            '#owned': [],
        },
    };

    it('limits subcommand completion, transcribes syntax, and shows ghosts', () => {
        expect(isChanservSubcommandPosition('/cs ')).toBe(true);
        expect(isChanservSubcommandPosition('/cs R')).toBe(true);
        expect(isChanservSubcommandPosition('/CS reg')).toBe(true);
        expect(isChanservSubcommandPosition('/msg ChanServ ')).toBe(true);
        expect(isChanservSubcommandPosition('/msg ChanServ INFO')).toBe(true);
        expect(isChanservSubcommandPosition('/cs INFO ')).toBe(false);
        expect(isChanservSubcommandPosition('/cs INFO #chan')).toBe(false);
        expect(isChanservSubcommandPosition('/cs')).toBe(false);
        expect(isChanservSubcommandPosition('/msg ChanServ')).toBe(false);
        expect(isChanservSubcommandPosition('/ns INFO ')).toBe(false);
        expect(isChanservSubcommandPosition('')).toBe(false);
        expect(isChanservSubcommandPosition(null)).toBe(false);

        expect(CHANSERV_SYNTAX.TRANSFER).toBe('TRANSFER [accept] #channel user [code]');
        expect(CHANSERV_SYNTAX.SET).toBe('SET #channel <setting> <value>');
        expect(CHANSERV_SYNTAX.PURGE).toBe('PURGE <ADD | DEL | LIST> #channel [code] [reason]');

        expect(chanservSyntaxFor(['SET'])).toBe('SET #channel <setting> <value>');
        expect(chanservSyntaxFor(['TRANSFER', 'ACCEPT'])).toBe('TRANSFER accept #channel');
        expect(chanservSyntaxFor(['CLEAR'])).toBe('CLEAR #channel target');
        expect(chanservSyntaxFor(['FOO'])).toBe('');
        expect(chanservSyntaxFor([])).toBe('');
    });

    it('parses command paths and argument slots', () => {
        expect(parseChanservInput('/cs ')).toBe(null);
        expect(parseChanservInput('/cs OP')).toBe(null);
        expect(parseChanservInput('/cs FOO ')).toBe(null);
        expect(parseChanservInput('/ns OP ')).toBe(null);
        expect(parseChanservInput('/cs OP ')).toEqual({
            path: ['OP'], argIndex: 0, args: [], partial: '',
        });
        expect(parseChanservInput('/cs OP #o')).toEqual({
            path: ['OP'], argIndex: 0, args: ['#o'], partial: '#o',
        });
        expect(parseChanservInput('/cs OP #ops ')).toEqual({
            path: ['OP'], argIndex: 1, args: ['#ops'], partial: '',
        });
        expect(parseChanservInput('/cs OP #ops Al')).toEqual({
            path: ['OP'], argIndex: 1, args: ['#ops', 'Al'], partial: 'Al',
        });
        expect(parseChanservInput('/msg ChanServ SET #a HISTORY ')).toEqual({
            path: ['SET'], argIndex: 2, args: ['#a', 'HISTORY'], partial: '',
        });
        expect(parseChanservInput('/CS transfer accept ')).toEqual({
            path: ['TRANSFER', 'ACCEPT'], argIndex: 0, args: [], partial: '',
        });
        expect(parseChanservInput('/cs TRANSFER #owned ')).toEqual({
            path: ['TRANSFER'], argIndex: 1, args: ['#owned'], partial: '',
        });
        expect(parseChanservInput('/cs TRANSFER ACC')).toEqual({
            path: ['TRANSFER'], argIndex: 0, args: [], partial: 'ACC',
        });
        expect(parseChanservInput('/cs CLEAR users ')).toEqual({
            path: ['CLEAR'], argIndex: 1, args: ['users'], partial: '',
        });
        expect(parseChanservInput('/cs PURGE ADD ')).toEqual({
            path: ['PURGE', 'ADD'], argIndex: 0, args: [], partial: '',
        });
        expect(parseChanservInput('/cs PURGE FOO ')).toEqual({
            path: ['PURGE'], argIndex: -1, args: ['FOO'], partial: 'FOO',
        });
    });

    it('suggests channels by privilege, then nicks and accounts', () => {
        expect(chanservArgSuggestions(parseChanservInput('/cs OP '), ctx))
            .toEqual(['#ops']);
        expect(chanservArgSuggestions(parseChanservInput('/cs DEOP '), ctx))
            .toEqual(['#owned']);
        expect(chanservArgSuggestions(parseChanservInput('/cs REGISTER '), ctx))
            .toEqual(['#ops']);
        expect(chanservArgSuggestions(parseChanservInput('/cs INFO '), ctx))
            .toEqual(['#ops', '#owned', '#public']);
        expect(chanservArgSuggestions(parseChanservInput('/cs TRANSFER ACCEPT '), ctx))
            .toEqual(['#ops', '#public']);

        expect(chanservArgSuggestions(parseChanservInput('/cs OP #ops '), ctx))
            .toEqual(['Alice', 'Bob']);
        expect(chanservArgSuggestions(parseChanservInput('/cs AMODE #ops '), ctx))
            .toEqual(['alice']);
        expect(chanservArgSuggestions(parseChanservInput('/cs OP #unknown '), ctx))
            .toEqual([]);
        expect(chanservArgSuggestions(parseChanservInput('/cs HOWTOBAN #owned '), ctx))
            .toEqual(['Carol']);
    });

    it('suggests settings, values, subcommands, and keywords', () => {
        const names = CHANSERV_SETTINGS.map((s) => s.name);
        expect(chanservArgSuggestions(parseChanservInput('/cs GET #a '), ctx))
            .toEqual(names);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a HISTORY '), ctx))
            .toEqual(['off', 'ephemeral', 'on', 'default']);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a QUERY-CUTOFF '), ctx))
            .toEqual(['none', 'registration-time', 'join-time', 'default']);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a BOGUS '), ctx))
            .toEqual([]);

        expect(chanservArgSuggestions(parseChanservInput('/cs PURGE '), ctx))
            .toEqual(['ADD', 'DEL', 'LIST']);
        expect(chanservArgSuggestions(parseChanservInput('/cs CLEAR '), ctx))
            .toEqual(['#owned']);
        expect(chanservArgSuggestions(parseChanservInput('/cs CLEAR #owned '), ctx))
            .toEqual(['users', 'access']);
        expect(chanservArgSuggestions(parseChanservInput('/cs TRANSFER '), ctx))
            .toEqual(['ACCEPT', '#owned']);
        expect(chanservArgSuggestions(parseChanservInput('/cs LIST '), ctx)).toEqual([]);
        expect(chanservArgSuggestions(parseChanservInput('/cs PURGE FOO '), ctx)).toEqual([]);
        expect(chanservArgSuggestions(null, ctx)).toEqual([]);
    });
});

describe('hostserv completion', () => {
    const ctx = {
        oper: false,
        selfAccount: 'myaccount',
        knownAccounts: ['alice', 'bob'],
    };

    const operCtx = Object.assign({}, ctx, { oper: true });

    it('limits subcommand completion, transcribes syntax, and shows ghosts', () => {
        expect(isHostservSubcommandPosition('/hs ')).toBe(true);
        expect(isHostservSubcommandPosition('/hs S')).toBe(true);
        expect(isHostservSubcommandPosition('/HS sta')).toBe(true);
        expect(isHostservSubcommandPosition('/msg HostServ ')).toBe(true);
        expect(isHostservSubcommandPosition('/msg HostServ STATUS')).toBe(true);
        expect(isHostservSubcommandPosition('/hs STATUS ')).toBe(false);
        expect(isHostservSubcommandPosition('/hs ON x')).toBe(false);
        expect(isHostservSubcommandPosition('/hs')).toBe(false);
        expect(isHostservSubcommandPosition('/msg HostServ')).toBe(false);
        expect(isHostservSubcommandPosition('/ns STATUS ')).toBe(false);
        expect(isHostservSubcommandPosition('')).toBe(false);
        expect(isHostservSubcommandPosition(null)).toBe(false);

        expect(HOSTSERV_SYNTAX.ON).toBe('ON');
        expect(HOSTSERV_SYNTAX.STATUS).toBe('STATUS [user]');
        expect(HOSTSERV_SYNTAX.SET).toBe('SET <user> <vhost>');
        expect(HOSTSERV_SYNTAX.SETCLOAKSECRET).toBe('SETCLOAKSECRET <secret> [code]');

        expect(hostservSyntaxFor(['ON'])).toBe('ON');
        expect(hostservSyntaxFor(['STATUS'])).toBe('STATUS [user]');
        expect(hostservSyntaxFor(['SET'])).toBe('SET <user> <vhost>');
        expect(hostservSyntaxFor(['FOO'])).toBe('');
        expect(hostservSyntaxFor([])).toBe('');
    });

    it('parses command paths and argument slots', () => {
        expect(parseHostservInput('/hs ')).toBe(null);
        expect(parseHostservInput('/hs ON')).toBe(null);
        expect(parseHostservInput('/hs FOO ')).toBe(null);
        expect(parseHostservInput('/ns ON ')).toBe(null);
        expect(parseHostservInput('/hs ON ')).toEqual({
            path: ['ON'], argIndex: 0, args: [], partial: '',
        });
        expect(parseHostservInput('/hs STATUS ')).toEqual({
            path: ['STATUS'], argIndex: 0, args: [], partial: '',
        });
        expect(parseHostservInput('/hs SET alice ')).toEqual({
            path: ['SET'], argIndex: 1, args: ['alice'], partial: '',
        });
        expect(parseHostservInput('/msg HostServ DEL Bo')).toEqual({
            path: ['DEL'], argIndex: 0, args: ['Bo'], partial: 'Bo',
        });
        expect(parseHostservInput('/HS status ')).toEqual({
            path: ['STATUS'], argIndex: 0, args: [], partial: '',
        });
    });

    it('suggests accounts by role and stays quiet otherwise', () => {
        expect(hostservArgSuggestions(parseHostservInput('/hs STATUS '), ctx))
            .toEqual(['myaccount']);
        expect(hostservArgSuggestions(parseHostservInput('/hs STATUS '), operCtx))
            .toEqual(['alice', 'bob']);

        expect(hostservArgSuggestions(parseHostservInput('/hs SET '), ctx))
            .toEqual(['alice', 'bob']);
        expect(hostservArgSuggestions(parseHostservInput('/hs DEL b'), ctx))
            .toEqual(['alice', 'bob']);
        expect(hostservArgSuggestions(parseHostservInput('/hs SET alice '), ctx))
            .toEqual([]);

        expect(hostservArgSuggestions(parseHostservInput('/hs ON '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(parseHostservInput('/hs OFF '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(parseHostservInput('/hs SETCLOAKSECRET '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(null, ctx)).toEqual([]);
    });
});

describe('nickserv completion', () => {
    const userCtx = {
        oper: false,
        selfNick: 'MyNick',
        selfAccount: 'myaccount',
        knownNicks: ['Alice', 'Bob'],
        knownAccounts: ['alice', 'bob'],
    };

    const operCtx = Object.assign({}, userCtx, { oper: true });

    it('parses command paths and argument slots', () => {
        expect(parseNickservInput('/ns ')).toBe(null);
        expect(parseNickservInput('/ns CERT')).toBe(null);
        expect(parseNickservInput('/ns FOO ')).toBe(null);
        expect(parseNickservInput('/query hi')).toBe(null);
        expect(parseNickservInput('/ns CERT ')).toEqual({
            path: ['CERT'], argIndex: 0, args: [], partial: '',
        });
        expect(parseNickservInput('/ns CERT LI')).toEqual({
            path: ['CERT'], argIndex: 0, args: [], partial: 'LI',
        });
        expect(parseNickservInput('/ns CERT LIST ')).toEqual({
            path: ['CERT', 'LIST'], argIndex: 0, args: [], partial: '',
        });
        expect(parseNickservInput('/ns CERT FOO ')).toEqual({
            path: ['CERT'], argIndex: -1, args: ['FOO'], partial: 'FOO',
        });
        expect(parseNickservInput('/ns SET EMAIL t')).toEqual({
            path: ['SET'], argIndex: 1, args: ['EMAIL', 't'], partial: 't',
        });
        expect(parseNickservInput('/ns SASET bob EMAIL ')).toEqual({
            path: ['SASET'], argIndex: 2, args: ['bob', 'EMAIL'], partial: '',
        });
        expect(parseNickservInput('/msg NickServ GET ')).toEqual({
            path: ['GET'], argIndex: 0, args: [], partial: '',
        });
        expect(parseNickservInput('/NS set email ')).toEqual({
            path: ['SET'], argIndex: 1, args: ['email'], partial: '',
        });
        expect(parseNickservInput('/ns PASSWORD ')).toEqual({
            path: ['PASSWD'], argIndex: 0, args: [], partial: '',
        });
    });

    it('suggests settings, sub-subcommands, and syntax ghosts', () => {
        const names = NICKSERV_SETTINGS.map((s) => s.name);
        expect(nickservArgSuggestions(parseNickservInput('/ns GET '), userCtx))
            .toEqual(names);
        expect(nickservArgSuggestions(parseNickservInput('/ns SET ENFORCE '), userCtx))
            .toEqual(['none', 'strict', 'default']);
        expect(nickservArgSuggestions(parseNickservInput('/ns SET EMAIL '), userCtx))
            .toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns SASET bob DM-HISTORY '), userCtx))
            .toEqual(['off', 'ephemeral', 'on', 'default']);

        expect(nickservArgSuggestions(parseNickservInput('/ns CERT '), userCtx))
            .toEqual(['LIST', 'ADD', 'DEL']);
        expect(nickservArgSuggestions(parseNickservInput('/ns PUSH '), userCtx))
            .toEqual(['LIST', 'DELETE']);
        expect(nickservArgSuggestions(parseNickservInput('/ns SUSPEND '), userCtx))
            .toEqual(['ADD', 'DEL', 'LIST']);

        expect(nickservSyntaxFor(['SET'])).toBe('SET <setting> <value>');
        expect(nickservSyntaxFor(['CERT', 'LIST'])).toBe('CERT LIST [account]');
        expect(nickservSyntaxFor(['SUSPEND', 'ADD']))
            .toBe('SUSPEND ADD <nickname> [DURATION duration] [reason]');
        expect(nickservSyntaxFor(['SASET'])).toBe('SASET <account> <setting> <value>');
        expect(nickservSyntaxFor(['FOO'])).toBe('');
        expect(nickservSyntaxFor([])).toBe('');
    });

    it('gives own values to users, known values to opers, and stays quiet', () => {
        expect(nickservArgSuggestions(parseNickservInput('/ns CLIENTS LIST '), userCtx))
            .toEqual(['MyNick']);
        expect(nickservArgSuggestions(parseNickservInput('/ns CLIENTS LIST '), operCtx))
            .toEqual(['Alice', 'Bob']);
        expect(nickservArgSuggestions(parseNickservInput('/ns UNREGISTER '), userCtx))
            .toEqual(['myaccount']);
        expect(nickservArgSuggestions(parseNickservInput('/ns UNREGISTER '), operCtx))
            .toEqual(['alice', 'bob']);
        expect(nickservArgSuggestions(parseNickservInput('/ns INFO '), userCtx))
            .toEqual(['alice', 'bob']);
        expect(nickservArgSuggestions(parseNickservInput('/ns SADROP '), operCtx))
            .toEqual(['Alice', 'Bob']);
        expect(nickservArgSuggestions(parseNickservInput('/ns RENAME alice '), operCtx))
            .toEqual([]);

        expect(nickservArgSuggestions(parseNickservInput('/ns DROP '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns IDENTIFY '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns CERT FOO '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(null, userCtx)).toEqual([]);
    });
});

describe('histserv completion', () => {
    const ctx = {
        knownAccounts: ['alice', 'bob'],
        knownTargets: ['#chan', 'SomeNick'],
    };

    it('limits subcommand completion, transcribes syntax, and shows ghosts', () => {
        expect(isHistservSubcommandPosition('/msg HistServ ')).toBe(true);
        expect(isHistservSubcommandPosition('/msg HistServ P')).toBe(true);
        expect(isHistservSubcommandPosition('/msg histserv pla')).toBe(true);
        expect(isHistservSubcommandPosition('/msg HistServ PLAY ')).toBe(false);
        expect(isHistservSubcommandPosition('/msg HistServ PLAY #chan')).toBe(false);
        expect(isHistservSubcommandPosition('/msg HistServ')).toBe(false);
        expect(isHistservSubcommandPosition('/hs PLAY ')).toBe(false);
        expect(isHistservSubcommandPosition('/ns PLAY ')).toBe(false);
        expect(isHistservSubcommandPosition('')).toBe(false);
        expect(isHistservSubcommandPosition(null)).toBe(false);

        expect(HISTSERV_SYNTAX.PLAY).toBe('PLAY <target> [limit]');
        expect(HISTSERV_SYNTAX.DELETE).toBe('DELETE <target> <msgid>');
        expect(HISTSERV_SYNTAX.FORGET).toBe('FORGET <account>');
        expect(HISTSERV_SYNTAX.EXPORT).toBe('EXPORT <account>');

        expect(histservSyntaxFor(['PLAY'])).toBe('PLAY <target> [limit]');
        expect(histservSyntaxFor(['DELETE'])).toBe('DELETE <target> <msgid>');
        expect(histservSyntaxFor(['FORGET'])).toBe('FORGET <account>');
        expect(histservSyntaxFor(['FOO'])).toBe('');
        expect(histservSyntaxFor([])).toBe('');
    });

    it('parses command paths and argument slots', () => {
        expect(parseHistservInput('/msg HistServ ')).toBe(null);
        expect(parseHistservInput('/msg HistServ PLAY')).toBe(null);
        expect(parseHistservInput('/msg HistServ FOO ')).toBe(null);
        expect(parseHistservInput('/hs PLAY ')).toBe(null);
        expect(parseHistservInput('/msg HistServ PLAY ')).toEqual({
            path: ['PLAY'], argIndex: 0, args: [], partial: '',
        });
        expect(parseHistservInput('/msg HistServ PLAY #chan ')).toEqual({
            path: ['PLAY'], argIndex: 1, args: ['#chan'], partial: '',
        });
        expect(parseHistservInput('/msg HistServ PLAY #ch')).toEqual({
            path: ['PLAY'], argIndex: 0, args: ['#ch'], partial: '#ch',
        });
        expect(parseHistservInput('/msg HistServ DELETE #chan abc-123')).toEqual({
            path: ['DELETE'], argIndex: 1, args: ['#chan', 'abc-123'], partial: 'abc-123',
        });
        expect(parseHistservInput('/MSG HISTSERV FORGET alice ')).toEqual({
            path: ['FORGET'], argIndex: 1, args: ['alice'], partial: '',
        });
    });

    it('suggests accounts and targets, and stays quiet otherwise', () => {
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ FORGET '), ctx))
            .toEqual(['alice', 'bob']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ EXPORT b'), ctx))
            .toEqual(['alice', 'bob']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ PLAY '), ctx))
            .toEqual(['#chan', 'SomeNick']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ DELETE '), ctx))
            .toEqual(['#chan', 'SomeNick']);

        expect(histservArgSuggestions(parseHistservInput('/msg HistServ PLAY #chan '), ctx)).toEqual([]);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ DELETE #chan id '), ctx)).toEqual([]);
        expect(histservArgSuggestions(null, ctx)).toEqual([]);
    });
});
