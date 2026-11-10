import { createCommandTree } from '@/helpers/CommandTree';

const commands = [
    {
        name: 'join',
        group: 'Admin',
        syntax: 'join <channel>',
        help: 'Join a channel',
    },
    {
        name: 'list',
        group: 'Config',
        syntax: 'list <group>',
        help: 'List configuration',
    },
    {
        name: 'list',
        group: 'User',
        syntax: 'list',
        help: 'List users',
    },
    {
        name: 'admin',
        group: 'Misc',
        syntax: 'admin',
        help: 'Admin information',
    },
    {
        name: 'time',
        group: 'Time',
        syntax: 'time [<timezone>]',
        help: 'Show the time',
        subcommands: [
            {
                name: 'ctime',
                syntax: 'ctime [<seconds>]',
                help: 'Show a Unix time',
            },
        ],
    },
];

function textValues(items) {
    return items.map((item) => item.text);
}

describe('CommandTree', () => {
    it('suggests groups and unambiguous shortcuts on the first token', () => {
        const tree = createCommandTree(commands);

        const items = tree.suggest([], false);

        expect(textValues(items)).toContain('admin');
        expect(textValues(items)).toContain('join');
        expect(textValues(items)).not.toContain('list');
        expect(textValues(items)).not.toContain('admin admin');
    });

    it('filters first-token suggestions by prefix', () => {
        const tree = createCommandTree(commands);

        expect(textValues(tree.suggest(['adm'], false)))
            .toEqual(['admin']);
    });

    it('limits suggestions to enabled groups', () => {
        const tree = createCommandTree(commands);

        expect(textValues(tree.suggest([], false, {
            enabledGroups: ['admin'],
        }))).toEqual(['admin', 'join']);
    });

    it('suggests group commands and subcommands', () => {
        const tree = createCommandTree(commands);

        expect(textValues(tree.suggest(['admin'], true))).toEqual(['join']);
        expect(textValues(tree.suggest(['admin', 'j'], false))).toEqual(['join']);
        expect(textValues(tree.suggest(['time', 'time'], true))).toEqual(['ctime']);
    });

    it('resolves shortcuts and fully specified paths', () => {
        const tree = createCommandTree(commands);

        expect(tree.resolve(['join']).path).toEqual(['admin', 'join']);
        expect(tree.resolve(['admin', 'join']).path).toEqual(['admin', 'join']);
        expect(tree.resolve(['config', 'list']).path).toEqual(['config', 'list']);
        expect(tree.resolve(['list'])).toBeNull();
        expect(tree.resolve(['admin'])).toBeNull();
        expect(tree.resolve(['time', 'time', 'ctime']).path)
            .toEqual(['time', 'time', 'ctime']);
    });

    it('returns the fully specified syntax', () => {
        const tree = createCommandTree(commands);

        expect(tree.syntaxFor(tree.resolve(['admin', 'join'])))
            .toBe('admin join <channel>');
        expect(tree.syntaxFor(tree.resolve(['time', 'time', 'ctime'])))
            .toBe('time ctime [<seconds>]');
        expect(tree.syntaxFor(null)).toBe('');
    });

    it('resolves delivery with a caller-supplied policy', () => {
        const tree = createCommandTree(commands, {
            delivery: {
                'admin join': 'channel',
            },
        });

        expect(tree.deliveryFor(['admin', 'join'])).toBe('channel');
        expect(tree.deliveryFor(['config', 'list'])).toBe('private');
        expect(tree.deliveryFor(null)).toBe('private');
    });

    it('can disable shortcuts', () => {
        const tree = createCommandTree(commands, {
            allowShortcuts: false,
        });

        expect(tree.resolve(['join'])).toBeNull();
        expect(tree.resolve(['admin', 'join']).path).toEqual(['admin', 'join']);
    });

    it('accepts a custom ambiguity policy', () => {
        const tree = createCommandTree(commands, {
            isShortcutAmbiguous: () => true,
        });

        expect(tree.resolve(['join'])).toBeNull();
        expect(textValues(tree.suggest([], false))).not.toContain('join');
    });
});
