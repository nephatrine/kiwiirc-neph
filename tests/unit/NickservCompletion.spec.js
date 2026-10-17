import {
    nickservSubcommands,
    nickservBadge,
    NICKSERV_SUBCOMMANDS,
    NICKSERV_OPER_SUBCOMMANDS,
    NICKSERV_SETTINGS,
    parseNickservInput,
    nickservArgSuggestions,
    nickservSyntaxFor
} from '@/libs/ErgoServices';

const userCtx = {
    oper: false,
    selfNick: 'MyNick',
    selfAccount: 'myaccount',
    knownNicks: ['Alice', 'Bob'],
    knownAccounts: ['alice', 'bob'],
};

const operCtx = Object.assign({}, userCtx, { oper: true });

describe('nickserv completion', () => {
    it('offers non-hidden commands at top level', () => {
        const base = nickservSubcommands({ oper: false, authenticated: true });
        NICKSERV_SUBCOMMANDS.forEach((cmd) => {
            expect(base).toContain(cmd);
        });
        ['SENDPASS', 'RESETPASS', 'PASSWORD'].forEach((cmd) => {
            expect(base).toContain(cmd);
        });
        ['ENFORCE', 'SESSIONS', 'VERIFYEMAIL'].forEach((cmd) => {
            expect(base).not.toContain(cmd);
        });
    });

    it('adds oper commands for opers only', () => {
        const base = nickservSubcommands({ oper: false, authenticated: true });
        const withOper = nickservSubcommands({ oper: true, authenticated: true });
        NICKSERV_OPER_SUBCOMMANDS.forEach((cmd) => {
            expect(base).not.toContain(cmd);
            expect(withOper).toContain(cmd);
        });
    });

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

    it('suggests settings and setting values', () => {
        const names = NICKSERV_SETTINGS.map((s) => s.name);
        expect(nickservArgSuggestions(parseNickservInput('/ns GET '), userCtx))
            .toEqual(names);
        expect(nickservArgSuggestions(parseNickservInput('/ns SET ENFORCE '), userCtx))
            .toEqual(['none', 'strict', 'default']);
        expect(nickservArgSuggestions(parseNickservInput('/ns SET EMAIL '), userCtx))
            .toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns SASET bob DM-HISTORY '), userCtx))
            .toEqual(['off', 'ephemeral', 'on', 'default']);
    });

    it('completes sub-subcommands', () => {
        expect(nickservArgSuggestions(parseNickservInput('/ns CERT '), userCtx))
            .toEqual(['LIST', 'ADD', 'DEL']);
        expect(nickservArgSuggestions(parseNickservInput('/ns PUSH '), userCtx))
            .toEqual(['LIST', 'DELETE']);
        expect(nickservArgSuggestions(parseNickservInput('/ns SUSPEND '), userCtx))
            .toEqual(['ADD', 'DEL', 'LIST']);
    });

    it('gives own values to users and known values to opers', () => {
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
    });

    it('stays out of the way without suggestions', () => {
        expect(nickservArgSuggestions(parseNickservInput('/ns DROP '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns IDENTIFY '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(parseNickservInput('/ns CERT FOO '), userCtx)).toEqual([]);
        expect(nickservArgSuggestions(null, userCtx)).toEqual([]);
    });

    it('badges oper commands by category', () => {
        expect(nickservBadge('SUSPEND')).toBe('CHAT');
        expect(nickservBadge('LIST')).toBe('SERVER');
        expect(nickservBadge('SADROP')).toBe('SERVER');
        expect(nickservBadge('INFO')).toBe(null);
        expect(nickservBadge('GET')).toBe(null);
    });

    it('shows syntax ghosts for command paths', () => {
        expect(nickservSyntaxFor(['SET'])).toBe('SET <setting> <value>');
        expect(nickservSyntaxFor(['CERT', 'LIST'])).toBe('CERT LIST [account]');
        expect(nickservSyntaxFor(['SUSPEND', 'ADD']))
            .toBe('SUSPEND ADD <nickname> [DURATION duration] [reason]');
        expect(nickservSyntaxFor(['SASET'])).toBe('SASET <account> <setting> <value>');
        expect(nickservSyntaxFor(['FOO'])).toBe('');
        expect(nickservSyntaxFor([])).toBe('');
    });
});
