import {
    histservSubcommands,
    histservBadge,
    HISTSERV_SUBCOMMANDS,
    HISTSERV_SYNTAX,
    isHistservSubcommandPosition,
    parseHistservInput,
    histservArgSuggestions,
    histservSyntaxFor
} from '@/libs/ErgoHistServ';

describe('histserv completion', () => {
    it('offers non-hidden commands at top level', () => {
        const authed = histservSubcommands({ oper: true, authenticated: true });
        HISTSERV_SUBCOMMANDS.forEach((cmd) => {
            expect(authed).toContain(cmd);
        });
    });

    it('hides oper commands from non-opers', () => {
        const base = histservSubcommands({ oper: false, authenticated: true });
        const withOper = histservSubcommands({ oper: true, authenticated: true });
        ['FORGET', 'EXPORT'].forEach((cmd) => {
            expect(base).not.toContain(cmd);
            expect(withOper).toContain(cmd);
        });
        ['PLAY', 'DELETE'].forEach((cmd) => {
            expect(base).toContain(cmd);
        });
    });

    it('badges oper commands as Server Administration', () => {
        expect(histservBadge('FORGET')).toBe('SERVER');
        expect(histservBadge('EXPORT')).toBe('SERVER');
        expect(histservBadge('PLAY')).toBe(null);
        expect(histservBadge('DELETE')).toBe(null);
    });

    it('limits subcommand completion to the subcommand token', () => {
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
    });

    it('transcribes upstream syntax', () => {
        expect(HISTSERV_SYNTAX.PLAY).toBe('PLAY <target> [limit]');
        expect(HISTSERV_SYNTAX.DELETE).toBe('DELETE <target> <msgid>');
        expect(HISTSERV_SYNTAX.FORGET).toBe('FORGET <account>');
        expect(HISTSERV_SYNTAX.EXPORT).toBe('EXPORT <account>');
    });
});

describe('histserv argument completion', () => {
    const ctx = {
        knownAccounts: ['alice', 'bob'],
        knownTargets: ['#chan', 'SomeNick'],
    };

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

    it('suggests accounts and targets', () => {
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ FORGET '), ctx))
            .toEqual(['alice', 'bob']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ EXPORT b'), ctx))
            .toEqual(['alice', 'bob']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ PLAY '), ctx))
            .toEqual(['#chan', 'SomeNick']);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ DELETE '), ctx))
            .toEqual(['#chan', 'SomeNick']);
    });

    it('stays out of the way without suggestions', () => {
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ PLAY #chan '), ctx)).toEqual([]);
        expect(histservArgSuggestions(parseHistservInput('/msg HistServ DELETE #chan id '), ctx)).toEqual([]);
        expect(histservArgSuggestions(null, ctx)).toEqual([]);
    });

    it('shows syntax ghosts for commands', () => {
        expect(histservSyntaxFor(['PLAY'])).toBe('PLAY <target> [limit]');
        expect(histservSyntaxFor(['DELETE'])).toBe('DELETE <target> <msgid>');
        expect(histservSyntaxFor(['FORGET'])).toBe('FORGET <account>');
        expect(histservSyntaxFor(['FOO'])).toBe('');
        expect(histservSyntaxFor([])).toBe('');
    });
});
