import {
    LIMNORIA_COMMAND_CONFLICTS,
    LIMNORIA_COMMAND_DELIVERY,
    LIMNORIA_COMMAND_INDEX,
    LIMNORIA_PLUGIN_COMMAND_CONFLICTS,
    limnoriaCommandDelivery,
    limnoriaCommandPath
} from '@/libs/LimnoriaCommandIndex';
import {
    LIMNORIA_COMMAND_CONFLICTS as FULL_COMMAND_CONFLICTS,
    LIMNORIA_COMMAND_DELIVERY as FULL_COMMAND_DELIVERY,
    LIMNORIA_COMMANDS,
    LIMNORIA_PLUGIN_COMMAND_CONFLICTS as FULL_PLUGIN_COMMAND_CONFLICTS,
    limnoriaCommandDelivery as fullLimnoriaCommandDelivery,
    limnoriaCommandPath as fullLimnoriaCommandPath
} from '@/libs/LimnoriaCommands';

function indexPaths() {
    const paths = [];

    LIMNORIA_COMMAND_INDEX.forEach((command) => {
        const base = [command.plugin, command.name].join(' ').toLowerCase();
        paths.push(base);
        command.subcommands.forEach((subcommand) => {
            paths.push(base + ' ' + subcommand.toLowerCase());
        });
    });

    return paths.sort();
}

function fullPaths() {
    const paths = [];

    LIMNORIA_COMMANDS.forEach((command) => {
        const base = [command.plugin, command.name].join(' ').toLowerCase();
        paths.push(base);
        (command.subcommands || []).forEach((subcommand) => {
            paths.push(base + ' ' + subcommand.name.toLowerCase());
        });
    });

    return paths.sort();
}

describe('Limnoria command index', () => {
    test('contains every full command path', () => {
        expect(indexPaths()).toEqual(fullPaths());
    });

    test('keeps delivery and conflict data in sync', () => {
        expect(LIMNORIA_COMMAND_DELIVERY).toEqual(FULL_COMMAND_DELIVERY);
        expect(LIMNORIA_COMMAND_CONFLICTS).toEqual(FULL_COMMAND_CONFLICTS);
        expect(LIMNORIA_PLUGIN_COMMAND_CONFLICTS)
            .toEqual(FULL_PLUGIN_COMMAND_CONFLICTS);
    });

    test('resolves paths the same way as the full table', () => {
        fullPaths().forEach((path) => {
            expect(limnoriaCommandPath(path))
                .toEqual(fullLimnoriaCommandPath(path));
        });
    });

    test('keeps delivery decisions in sync', () => {
        fullPaths().forEach((path) => {
            const parsed = fullLimnoriaCommandPath(path);
            expect(limnoriaCommandDelivery(parsed))
                .toBe(fullLimnoriaCommandDelivery(parsed));
        });
    });

    test('resolves shortcuts and ambiguity the same way', () => {
        [
            'config config',
            'config list',
            'reset channel',
            'more',
            'misc last',
            'list',
            'help',
            'channel mode',
            'games dice',
            'quote random',
            'unknown',
            'admin capability add Nick op',
            '',
            null,
        ].forEach((input) => {
            const path = limnoriaCommandPath(input);
            expect(path).toEqual(fullLimnoriaCommandPath(input));
            expect(limnoriaCommandDelivery(path))
                .toBe(fullLimnoriaCommandDelivery(path));
        });
    });
});
