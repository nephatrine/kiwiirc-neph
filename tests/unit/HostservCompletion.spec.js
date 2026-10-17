import {
    hostservSubcommands,
    hostservBadge,
    HOSTSERV_SUBCOMMANDS,
    HOSTSERV_SYNTAX,
    isHostservSubcommandPosition,
    parseHostservInput,
    hostservArgSuggestions,
    hostservSyntaxFor
} from '@/libs/ErgoHostServ';

describe('hostserv completion', () => {
    it('offers non-hidden commands at top level', () => {
        const authed = hostservSubcommands({ oper: true, authenticated: true });
        HOSTSERV_SUBCOMMANDS.forEach((cmd) => {
            expect(authed).toContain(cmd);
        });
    });

    it('hides auth-gated commands when logged out', () => {
        const loggedOut = hostservSubcommands({ oper: false, authenticated: false });
        ['ON', 'OFF'].forEach((cmd) => {
            expect(loggedOut).not.toContain(cmd);
        });
        expect(loggedOut).toContain('STATUS');
    });

    it('hides oper commands from non-opers', () => {
        const base = hostservSubcommands({ oper: false, authenticated: true });
        const withOper = hostservSubcommands({ oper: true, authenticated: true });
        ['SET', 'DEL', 'SETCLOAKSECRET'].forEach((cmd) => {
            expect(base).not.toContain(cmd);
            expect(withOper).toContain(cmd);
        });
    });

    it('badges oper commands by category', () => {
        expect(hostservBadge('SET')).toBe('CHAT');
        expect(hostservBadge('DEL')).toBe('CHAT');
        expect(hostservBadge('SETCLOAKSECRET')).toBe('SERVER');
        expect(hostservBadge('ON')).toBe(null);
        expect(hostservBadge('STATUS')).toBe(null);
    });

    it('limits subcommand completion to the subcommand token', () => {
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
    });

    it('transcribes upstream syntax', () => {
        expect(HOSTSERV_SYNTAX.ON).toBe('ON');
        expect(HOSTSERV_SYNTAX.STATUS).toBe('STATUS [user]');
        expect(HOSTSERV_SYNTAX.SET).toBe('SET <user> <vhost>');
        expect(HOSTSERV_SYNTAX.SETCLOAKSECRET).toBe('SETCLOAKSECRET <secret> [code]');
    });
});

describe('hostserv argument completion', () => {
    const ctx = {
        oper: false,
        selfAccount: 'myaccount',
        knownAccounts: ['alice', 'bob'],
    };

    const operCtx = Object.assign({}, ctx, { oper: true });

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

    it('gives own account to users and known accounts to opers', () => {
        expect(hostservArgSuggestions(parseHostservInput('/hs STATUS '), ctx))
            .toEqual(['myaccount']);
        expect(hostservArgSuggestions(parseHostservInput('/hs STATUS '), operCtx))
            .toEqual(['alice', 'bob']);
    });

    it('suggests known accounts for oper commands', () => {
        expect(hostservArgSuggestions(parseHostservInput('/hs SET '), ctx))
            .toEqual(['alice', 'bob']);
        expect(hostservArgSuggestions(parseHostservInput('/hs DEL b'), ctx))
            .toEqual(['alice', 'bob']);
        expect(hostservArgSuggestions(parseHostservInput('/hs SET alice '), ctx))
            .toEqual([]);
    });

    it('stays out of the way without suggestions', () => {
        expect(hostservArgSuggestions(parseHostservInput('/hs ON '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(parseHostservInput('/hs OFF '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(parseHostservInput('/hs SETCLOAKSECRET '), ctx)).toEqual([]);
        expect(hostservArgSuggestions(null, ctx)).toEqual([]);
    });

    it('shows syntax ghosts for commands', () => {
        expect(hostservSyntaxFor(['ON'])).toBe('ON');
        expect(hostservSyntaxFor(['STATUS'])).toBe('STATUS [user]');
        expect(hostservSyntaxFor(['SET'])).toBe('SET <user> <vhost>');
        expect(hostservSyntaxFor(['FOO'])).toBe('');
        expect(hostservSyntaxFor([])).toBe('');
    });
});
