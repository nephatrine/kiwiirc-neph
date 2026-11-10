'kiwi public';

/** @module */

function compareNames(left, right) {
    const a = String(left).toLowerCase();
    const b = String(right).toLowerCase();
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

function compareCommands(left, right) {
    return compareNames(left.name, right.name);
}

function groupName(command, groupKey) {
    return String(command[groupKey] || '');
}

function fullSyntax(command, syntax, groupKey) {
    return groupName(command, groupKey).toLowerCase() + ' ' + syntax;
}

/**
 * Create a generic command-tree helper.
 *
 * Commands use this shape:
 * {
 *   name: 'join',
 *   group: 'Admin',
 *   syntax: 'join <channel> [<key>]',
 *   help: '...',
 *   subcommands: [{ name: 'add', syntax: '...', help: '...' }],
 * }
 *
 * @param {Array} commands Command descriptors
 * @param {Object} options Tree options
 * @returns {Object} Suggestion, resolution, syntax, and delivery helpers
 */
export function createCommandTree(commands, options = {}) {
    const list = Array.isArray(commands) ? commands : [];
    const groupKey = options.groupKey || 'group';
    const deliveryMap = options.delivery || {};
    const defaultDelivery = options.defaultDelivery || 'private';
    const allowShortcuts = options.allowShortcuts !== false;
    const groupNames = new Set(
        list.map((command) => groupName(command, groupKey).toLowerCase())
    );
    const commandCounts = new Map();
    list.forEach((command) => {
        const name = String(command.name).toLowerCase();
        commandCounts.set(name, (commandCounts.get(name) || 0) + 1);
    });

    function isConflicting(command) {
        return commandCounts.get(String(command.name).toLowerCase()) > 1;
    }

    function isShortcutAmbiguous(command) {
        if (typeof options.isShortcutAmbiguous === 'function') {
            return options.isShortcutAmbiguous(command, {
                commandCounts,
                groupNames,
            });
        }
        return isConflicting(command) ||
            groupNames.has(String(command.name).toLowerCase());
    }

    function normalizeGroups(groups) {
        if (!groups) {
            return null;
        }
        return new Set(
            Array.from(groups).map((group) => String(group).toLowerCase())
        );
    }

    function isCommandEnabled(command, enabled) {
        return !enabled || enabled.has(groupName(command, groupKey).toLowerCase());
    }

    function commandsForGroup(name, enabled) {
        return list
            .filter((command) => (
                groupName(command, groupKey).toLowerCase() === name &&
                isCommandEnabled(command, enabled)
            ))
            .sort(compareCommands);
    }

    function shortcutCommand(name, enabled) {
        if (!allowShortcuts) {
            return null;
        }
        const matches = list.filter((command) => (
            String(command.name).toLowerCase() === name &&
            isCommandEnabled(command, enabled)
        ));
        if (matches.length !== 1 || isShortcutAmbiguous(matches[0])) {
            return null;
        }
        return matches[0];
    }

    function groupItem(group) {
        return {
            kind: 'group',
            group,
            text: String(group).toLowerCase(),
        };
    }

    function commandItem(command) {
        const syntax = fullSyntax(command, command.syntax, groupKey);
        return {
            kind: 'command',
            group: groupName(command, groupKey),
            command: command.name,
            text: command.name,
            description: syntax,
            help: command.help || '',
            syntax: command.syntax,
            fullSyntax: syntax,
        };
    }

    function subcommandItem(command, subcommand, fullySpecified) {
        const syntax = fullySpecified ?
            fullSyntax(command, subcommand.syntax, groupKey) :
            subcommand.syntax;
        return {
            kind: 'subcommand',
            group: groupName(command, groupKey),
            command: command.name,
            subcommand: subcommand.name,
            text: subcommand.name,
            description: syntax,
            help: subcommand.help || '',
            syntax: subcommand.syntax,
            fullSyntax: fullSyntax(command, subcommand.syntax, groupKey),
        };
    }

    function subcommandItems(command, fullySpecified) {
        return (command.subcommands || [])
            .slice()
            .sort(compareCommands)
            .map((subcommand) => subcommandItem(
                command,
                subcommand,
                fullySpecified
            ));
    }

    function firstTokenItems(enabled) {
        const items = [];
        const seen = new Set();
        list.forEach((command) => {
            if (!isCommandEnabled(command, enabled)) {
                return;
            }

            const group = groupName(command, groupKey);
            const groupText = group.toLowerCase();
            if (!seen.has(groupText)) {
                seen.add(groupText);
                items.push(groupItem(group));
            }

            if (!isShortcutAmbiguous(command)) {
                const commandText = String(command.name).toLowerCase();
                if (!seen.has(commandText)) {
                    seen.add(commandText);
                    items.push(commandItem(command));
                }
            }
        });
        return items.sort((left, right) => compareNames(left.text, right.text));
    }

    function pathFor(command, rest) {
        const path = [
            groupName(command, groupKey).toLowerCase(),
            String(command.name).toLowerCase(),
        ];
        let subcommand = null;
        if (rest.length > 0 && command.subcommands) {
            subcommand = command.subcommands.find(
                (item) => item.name.toLowerCase() === rest[0].toLowerCase()
            );
            if (subcommand) {
                path.push(subcommand.name.toLowerCase());
            }
        }
        return {
            group: groupName(command, groupKey),
            command,
            subcommand,
            path,
        };
    }

    function resolveTokens(tokens, callOptions = {}) {
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return null;
        }

        const enabled = normalizeGroups(callOptions.enabledGroups);
        const first = String(tokens[0]).toLowerCase();
        const commandsInGroup = commandsForGroup(first, enabled);
        if (commandsInGroup.length > 0 && tokens.length > 1) {
            const command = commandsInGroup.find(
                (item) => item.name.toLowerCase() === String(tokens[1]).toLowerCase()
            );
            return command ? pathFor(command, tokens.slice(2)) : null;
        }

        const command = shortcutCommand(first, enabled);
        return command ? pathFor(command, tokens.slice(1)) : null;
    }

    /**
     * Return next-token suggestions.
     *
     * @param {Array} tokens Command body tokens
     * @param {Boolean} trailingSpace Whether the input ends with whitespace
     * @param {Object} callOptions Per-call options
     * @returns {Array} Suggestion descriptors
     */
    function suggest(tokens, trailingSpace, callOptions = {}) {
        const enabled = normalizeGroups(callOptions.enabledGroups);
        const values = Array.isArray(tokens) ? tokens : [];

        if (values.length === 0) {
            return firstTokenItems(enabled);
        }

        const first = String(values[0]).toLowerCase();
        const commandsInGroup = commandsForGroup(first, enabled);
        const shortcut = shortcutCommand(first, enabled);

        if (values.length === 1) {
            if (!trailingSpace) {
                return firstTokenItems(enabled)
                    .filter((item) => (
                        item.text.toLowerCase().indexOf(first) === 0
                    ));
            }
            if (commandsInGroup.length > 0) {
                return commandsInGroup.map(commandItem);
            }
            return shortcut && shortcut.subcommands ?
                subcommandItems(shortcut, false) :
                [];
        }

        if (values.length === 2) {
            const second = String(values[1]).toLowerCase();
            if (commandsInGroup.length > 0) {
                const command = commandsInGroup.find(
                    (item) => item.name.toLowerCase() === second
                );
                if (trailingSpace) {
                    return command && command.subcommands ?
                        subcommandItems(command, true) :
                        [];
                }
                return commandsInGroup
                    .filter((item) => (
                        item.name.toLowerCase().indexOf(second) === 0
                    ))
                    .map(commandItem);
            }
            if (shortcut && shortcut.subcommands && !trailingSpace) {
                return subcommandItems(shortcut, false)
                    .filter((item) => (
                        item.text.toLowerCase().indexOf(second) === 0
                    ));
            }
            return [];
        }

        if (values.length === 3 && !trailingSpace) {
            const second = String(values[1]).toLowerCase();
            const third = String(values[2]).toLowerCase();
            if (commandsInGroup.length > 0) {
                const command = commandsInGroup.find(
                    (item) => item.name.toLowerCase() === second
                );
                if (!command || !command.subcommands) {
                    return [];
                }
                return subcommandItems(command, true)
                    .filter((item) => (
                        item.text.toLowerCase().indexOf(third) === 0
                    ));
            }
            if (shortcut && shortcut.subcommands) {
                return subcommandItems(shortcut, false)
                    .filter((item) => (
                        item.text.toLowerCase().indexOf(third) === 0
                    ));
            }
        }

        return [];
    }

    function syntaxFor(result) {
        if (!result || !result.command) {
            return '';
        }
        if (result.subcommand) {
            return fullSyntax(
                result.command,
                result.subcommand.syntax,
                groupKey
            );
        }
        return fullSyntax(result.command, result.command.syntax, groupKey);
    }

    function deliveryFor(path) {
        if (!Array.isArray(path) || path.length === 0) {
            return defaultDelivery;
        }
        const key = path
            .map((part) => String(part).toLowerCase())
            .join(' ');
        return deliveryMap[key] || defaultDelivery;
    }

    return {
        suggest,
        resolve: resolveTokens,
        syntaxFor,
        deliveryFor,
    };
}
