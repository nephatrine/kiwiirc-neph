import {
    BOUNCERSERV_CHEATSHEET,
    BOUNCERSERV_COMMANDS,
    BOUNCERSERV_SUBCOMMANDS,
    BOUNCERSERV_SYNTAX,
    isBouncerservSubcommandPosition,
    parseBouncerservInput,
    bouncerservArgSuggestions,
    bouncerservSyntaxFor
} from '@/libs/SojuServices';

describe('BouncerServ command data', () => {
    test('lists the upstream top-level commands', () => {
        expect(BOUNCERSERV_SUBCOMMANDS).toEqual([
            'help',
            'network',
            'certfp',
            'sasl',
            'user',
            'channel',
            'device-certificate',
            'server',
        ]);
    });

    test('transcribes the command tree and syntax', () => {
        const paths = BOUNCERSERV_COMMANDS.map((command) => command.path);
        expect(paths).toContain('network create');
        expect(paths).toContain('certfp generate');
        expect(paths).toContain('sasl set-plain');
        expect(paths).toContain('user run');
        expect(paths).toContain('channel create');
        expect(paths).toContain('device-certificate create');
        expect(paths).toContain('server debug');
        expect(BOUNCERSERV_SYNTAX.network).toBe(
            'network <create|status|update|delete|quote>'
        );
        expect(BOUNCERSERV_SYNTAX['network create']).toContain('-addr <addr>');
        expect(BOUNCERSERV_SYNTAX['sasl set-plain']).toBe(
            'sasl set-plain [-network name] <username> <password>'
        );
    });

    test('keeps the sidebar cheatsheet focused on common commands', () => {
        expect(BOUNCERSERV_CHEATSHEET.map((command) => command.path)).toEqual([
            'network create',
            'network status',
            'network update',
            'network delete',
            'network quote',
            'sasl status',
            'sasl set-plain',
            'sasl reset',
        ]);
        BOUNCERSERV_CHEATSHEET.forEach((command) => {
            expect(command.labelKey).toMatch(/^bouncerserv_/);
            expect(BOUNCERSERV_SYNTAX[command.path]).toBeTruthy();
        });
        expect(BOUNCERSERV_COMMANDS.map((command) => command.path))
            .toContain('server debug');
    });
});

describe('BouncerServ completion', () => {
    test('only activates in the top-level command position', () => {
        expect(isBouncerservSubcommandPosition('/msg BouncerServ ')).toBe(true);
        expect(isBouncerservSubcommandPosition('/msg BouncerServ net')).toBe(true);
        expect(isBouncerservSubcommandPosition('/msg BouncerServ network ')).toBe(false);
        expect(isBouncerservSubcommandPosition('/msg BouncerServ network cr')).toBe(false);
        expect(isBouncerservSubcommandPosition('/msg OtherServ ')).toBe(false);
        expect(isBouncerservSubcommandPosition('')).toBe(false);
        expect(isBouncerservSubcommandPosition(null)).toBe(false);
    });

    test('parses lowercase command paths and argument slots', () => {
        expect(parseBouncerservInput('/msg BouncerServ ')).toBeNull();
        expect(parseBouncerservInput('/msg BouncerServ network')).toBeNull();
        expect(parseBouncerservInput('/msg BouncerServ NETWORK ')).toBeNull();
        expect(parseBouncerservInput('/msg BouncerServ network ')).toEqual({
            path: ['network'], argIndex: 0, args: [], partial: '',
        });
        expect(parseBouncerservInput('/msg BouncerServ network create ')).toEqual({
            path: ['network', 'create'], argIndex: 0, args: [], partial: '',
        });
        expect(parseBouncerservInput('/msg BouncerServ network quote MyNet ')).toEqual({
            path: ['network', 'quote'], argIndex: 1, args: ['MyNet'], partial: '',
        });
        expect(parseBouncerservInput('/msg BouncerServ help ')).toEqual({
            path: ['help'], argIndex: 0, args: [], partial: '',
        });
    });

    test('suggests child commands', () => {
        expect(bouncerservArgSuggestions(parseBouncerservInput('/msg BouncerServ network ')))
            .toEqual(['create', 'status', 'update', 'delete', 'quote']);
        expect(bouncerservArgSuggestions(parseBouncerservInput('/msg BouncerServ sasl ')))
            .toEqual(['status', 'set-plain', 'reset']);
        expect(bouncerservArgSuggestions(parseBouncerservInput('/msg BouncerServ help ')))
            .toEqual(BOUNCERSERV_SUBCOMMANDS);
        expect(bouncerservArgSuggestions(parseBouncerservInput('/msg BouncerServ network create ')))
            .toEqual([]);
        expect(bouncerservArgSuggestions(null)).toEqual([]);
    });

    test('shows syntax ghosts for command paths', () => {
        expect(bouncerservSyntaxFor(['network'])).toBe(
            'network <create|status|update|delete|quote>'
        );
        expect(bouncerservSyntaxFor(['network', 'create'])).toContain('-addr <addr>');
        expect(bouncerservSyntaxFor(['sasl', 'set-plain'])).toBe(
            'sasl set-plain [-network name] <username> <password>'
        );
        expect(bouncerservSyntaxFor(['unknown'])).toBe('');
        expect(bouncerservSyntaxFor([])).toBe('');
    });
});
