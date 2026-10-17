import {
    CHANSERV_SYNTAX,
    CHANSERV_SETTINGS,
    isChanservSubcommandPosition,
    parseChanservInput,
    chanservArgSuggestions,
    chanservSyntaxFor
} from '@/libs/ErgoChanServ';

describe('chanserv completion', () => {
    it('limits subcommand completion to the subcommand token', () => {
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
    });

    it('transcribes upstream syntax', () => {
        expect(CHANSERV_SYNTAX.TRANSFER).toBe('TRANSFER [accept] #channel user [code]');
        expect(CHANSERV_SYNTAX.SET).toBe('SET #channel <setting> <value>');
        expect(CHANSERV_SYNTAX.PURGE).toBe('PURGE <ADD | DEL | LIST> #channel [code] [reason]');
    });
});

describe('chanserv argument completion', () => {
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

    it('suggests channels by privilege', () => {
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
    });

    it('suggests nicks and accounts from the named channel', () => {
        expect(chanservArgSuggestions(parseChanservInput('/cs OP #ops '), ctx))
            .toEqual(['Alice', 'Bob']);
        expect(chanservArgSuggestions(parseChanservInput('/cs AMODE #ops '), ctx))
            .toEqual(['alice']);
        expect(chanservArgSuggestions(parseChanservInput('/cs OP #unknown '), ctx))
            .toEqual([]);
        expect(chanservArgSuggestions(parseChanservInput('/cs HOWTOBAN #owned '), ctx))
            .toEqual(['Carol']);
    });

    it('suggests settings and setting values', () => {
        const names = CHANSERV_SETTINGS.map((s) => s.name);
        expect(chanservArgSuggestions(parseChanservInput('/cs GET #a '), ctx))
            .toEqual(names);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a HISTORY '), ctx))
            .toEqual(['off', 'ephemeral', 'on', 'default']);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a QUERY-CUTOFF '), ctx))
            .toEqual(['none', 'registration-time', 'join-time', 'default']);
        expect(chanservArgSuggestions(parseChanservInput('/cs SET #a BOGUS '), ctx))
            .toEqual([]);
    });

    it('completes subcommands and keywords', () => {
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

    it('shows syntax ghosts for command paths', () => {
        expect(chanservSyntaxFor(['SET'])).toBe('SET #channel <setting> <value>');
        expect(chanservSyntaxFor(['TRANSFER', 'ACCEPT'])).toBe('TRANSFER accept #channel');
        expect(chanservSyntaxFor(['CLEAR'])).toBe('CLEAR #channel target');
        expect(chanservSyntaxFor(['FOO'])).toBe('');
        expect(chanservSyntaxFor([])).toBe('');
    });
});
