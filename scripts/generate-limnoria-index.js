#!/usr/bin/env node

/*
 * Generate src/libs/LimnoriaCommandIndex.js from the full Limnoria command
 * table in src/libs/LimnoriaCommands.js.
 *
 * The index keeps only command paths and delivery data, so /lim execution can
 * stay in the entrypoint while the full help and syntax table is lazy-loaded.
 *
 * Usage:
 *   node scripts/generate-limnoria-index.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'src', 'libs', 'LimnoriaCommands.js');
const outputPath = path.join(__dirname, '..', 'src', 'libs', 'LimnoriaCommandIndex.js');

function quote(value) {
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function extractBlock(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }

    const end = source.indexOf(endMarker, start);
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }

    return source.slice(start, end + endMarker.length);
}

function loadTable(source) {
    const commandsBlock = extractBlock(
        source,
        'export const LIMNORIA_COMMANDS = [',
        '\n];'
    ).replace(
        'export const LIMNORIA_COMMANDS =',
        'const LIMNORIA_COMMANDS ='
    );
    const deliveryBlock = extractBlock(
        source,
        'export const LIMNORIA_COMMAND_DELIVERY = Object.freeze({',
        '\n});'
    ).replace(
        'export const LIMNORIA_COMMAND_DELIVERY =',
        'const LIMNORIA_COMMAND_DELIVERY ='
    );

    const script = [
        commandsBlock,
        deliveryBlock,
        'module.exports = { LIMNORIA_COMMANDS, LIMNORIA_COMMAND_DELIVERY };',
    ].join('\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
    };
    vm.runInNewContext(script, sandbox, { timeout: 1000 });

    return sandbox.module.exports;
}

function buildIndex(commands) {
    return commands.map((command) => ({
        name: command.name,
        plugin: command.plugin,
        subcommands: (command.subcommands || []).map((subcommand) => subcommand.name),
    }));
}

function commandConflicts(index) {
    const counts = new Map();
    index.forEach((command) => {
        const name = command.name.toLowerCase();
        counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
        .filter((entry) => entry[1] > 1)
        .map((entry) => entry[0])
        .sort();
}

function pluginCommandConflicts(index) {
    const plugins = new Set(index.map((command) => command.plugin.toLowerCase()));
    return Array.from(new Set(
        index
            .filter((command) => plugins.has(command.name.toLowerCase()))
            .map((command) => command.name)
    )).sort();
}

function render(index, delivery) {
    const conflicts = commandConflicts(index);
    const pluginConflicts = pluginCommandConflicts(index);
    const lines = [
        "'kiwi public';",
        '',
        '/*',
        ' * Generated from src/libs/LimnoriaCommands.js.',
        ' * Run `npm run generate:limnoria` after changing the command table.',
        ' */',
        '',
        'export const LIMNORIA_COMMAND_INDEX = [',
    ];

    index.forEach((command) => {
        const subcommands = command.subcommands.length ?
            `[${command.subcommands.map(quote).join(', ')}]` :
            '[]';
        lines.push(
            `    { name: ${quote(command.name)}, plugin: ${quote(command.plugin)}, ` +
            `subcommands: ${subcommands} },`
        );
    });

    lines.push('];');
    lines.push('');
    lines.push('export const LIMNORIA_COMMAND_DELIVERY = Object.freeze({');
    Object.keys(delivery).forEach((key) => {
        lines.push(`    ${quote(key)}: ${quote(delivery[key])},`);
    });
    lines.push('});');
    lines.push('');
    lines.push('export const LIMNORIA_COMMAND_CONFLICTS = Object.freeze([');
    conflicts.forEach((name) => {
        lines.push(`    ${quote(name)},`);
    });
    lines.push(']);');
    lines.push('');
    lines.push('export const LIMNORIA_PLUGIN_COMMAND_CONFLICTS = Object.freeze([');
    pluginConflicts.forEach((name) => {
        lines.push(`    ${quote(name)},`);
    });
    lines.push(']);');
    lines.push('');
    lines.push('const COMMAND_CONFLICTS = new Set(LIMNORIA_COMMAND_CONFLICTS);');
    lines.push('const PLUGIN_NAMES = new Set(');
    lines.push('    LIMNORIA_COMMAND_INDEX.map((command) => command.plugin.toLowerCase())');
    lines.push(');');
    lines.push('');
    lines.push('function isConflicting(command) {');
    lines.push('    return COMMAND_CONFLICTS.has(command.name.toLowerCase());');
    lines.push('}');
    lines.push('');
    lines.push('function isShortcutAmbiguous(command) {');
    lines.push('    return isConflicting(command) || PLUGIN_NAMES.has(command.name.toLowerCase());');
    lines.push('}');
    lines.push('');
    lines.push('function commandsForPlugin(name) {');
    lines.push('    return LIMNORIA_COMMAND_INDEX.filter(');
    lines.push('        (command) => command.plugin.toLowerCase() === name');
    lines.push('    );');
    lines.push('}');
    lines.push('');
    lines.push('function shortcutCommand(name) {');
    lines.push('    const matches = LIMNORIA_COMMAND_INDEX.filter(');
    lines.push('        (command) => command.name.toLowerCase() === name');
    lines.push('    );');
    lines.push('    if (matches.length !== 1 || isShortcutAmbiguous(matches[0])) {');
    lines.push('        return null;');
    lines.push('    }');
    lines.push('    return matches[0];');
    lines.push('}');
    lines.push('');
    lines.push('function commandPath(command, rest) {');
    lines.push('    const path = [command.plugin.toLowerCase(), command.name.toLowerCase()];');
    lines.push('    if (rest.length > 0 && command.subcommands) {');
    lines.push('        const subcommand = command.subcommands.find(');
    lines.push('            (name) => name.toLowerCase() === rest[0].toLowerCase()');
    lines.push('        );');
    lines.push('        if (subcommand) {');
    lines.push('            path.push(subcommand.toLowerCase());');
    lines.push('        }');
    lines.push('    }');
    lines.push('    return path;');
    lines.push('}');
    lines.push('');
    lines.push('// Resolve a /lim command body to a canonical <plugin> <command> [subcommand]');
    lines.push('// path. Ambiguous shortcuts and unknown commands return null.');
    lines.push('export function limnoriaCommandPath(commandText) {');
    lines.push("    if (typeof commandText !== 'string') {");
    lines.push('        return null;');
    lines.push('    }');
    lines.push('');
    lines.push('    const tokens = commandText.trim().split(/\\s+/).filter((token) => token.length > 0);');
    lines.push('    if (tokens.length === 0) {');
    lines.push('        return null;');
    lines.push('    }');
    lines.push('');
    lines.push('    const first = tokens[0].toLowerCase();');
    lines.push('    const pluginCommands = commandsForPlugin(first);');
    lines.push('    if (pluginCommands.length > 0 && tokens.length > 1) {');
    lines.push('        const command = pluginCommands.find(');
    lines.push('            (item) => item.name.toLowerCase() === tokens[1].toLowerCase()');
    lines.push('        );');
    lines.push('        return command ? commandPath(command, tokens.slice(2)) : null;');
    lines.push('    }');
    lines.push('');
    lines.push('    const command = shortcutCommand(first);');
    lines.push('    return command ? commandPath(command, tokens.slice(1)) : null;');
    lines.push('}');
    lines.push('');
    lines.push('export function limnoriaCommandDelivery(path) {');
    lines.push('    if (!Array.isArray(path) || path.length === 0) {');
    lines.push("        return 'private';");
    lines.push('    }');
    lines.push("    const key = path.map((part) => String(part).toLowerCase()).join(' ');");
    lines.push("    return LIMNORIA_COMMAND_DELIVERY[key] || 'private';");
    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

const source = fs.readFileSync(sourcePath, 'utf8');
const { LIMNORIA_COMMANDS, LIMNORIA_COMMAND_DELIVERY } = loadTable(source);
const index = buildIndex(LIMNORIA_COMMANDS);
const output = render(index, LIMNORIA_COMMAND_DELIVERY);

fs.writeFileSync(outputPath, output);
process.stdout.write(`Wrote ${outputPath}\n`);
