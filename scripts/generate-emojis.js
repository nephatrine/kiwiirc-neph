#!/usr/bin/env node

/*
 * Generate src/res/emojis.js from JoyPixels emoji-toolkit data.
 *
 * Usage:
 *   node scripts/generate-emojis.js /path/to/emoji.json
 *
 * Only non-artwork metadata is used: names, aliases, categories, and code
 * points. Skin-tone variants, regional-indicator components, keycap
 * components, and hair-color variants are intentionally excluded.
 */

const fs = require('fs');
const path = require('path');

const CATEGORIES = [
    { id: 'people', label: 'Smileys & People', icon: 'fa-smile-o' },
    { id: 'nature', label: 'Animals & Nature', icon: 'fa-leaf' },
    { id: 'food', label: 'Food & Drink', icon: 'fa-cutlery' },
    { id: 'activity', label: 'Activity', icon: 'fa-soccer-ball-o' },
    { id: 'travel', label: 'Travel & Places', icon: 'fa-plane' },
    { id: 'objects', label: 'Objects', icon: 'fa-lightbulb-o' },
    { id: 'symbols', label: 'Symbols', icon: 'fa-heart-o' },
    { id: 'flags', label: 'Flags', icon: 'fa-flag' },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

const HAIR_COLOR_PEOPLE = new Set([
    'person_red_hair',
    'woman_red_haired',
    'man_red_haired',
    'person_curly_hair',
    'woman_curly_haired',
    'man_curly_haired',
    'person_white_hair',
    'woman_white_haired',
    'man_white_haired',
    'person_bald',
    'woman_bald',
    'man_bald',
    'blond_haired_person',
    'blond-haired_woman',
    'blond-haired_man',
]);

const HAIR_COMPONENTS = new Set([
    'red_haired',
    'curly_haired',
    'white_haired',
    'bald',
]);

const KEYCAP_COMPONENTS = new Set([
    'digit_zero',
    'digit_one',
    'digit_two',
    'digit_three',
    'digit_four',
    'digit_five',
    'digit_six',
    'digit_seven',
    'digit_eight',
    'digit_nine',
    'pound_symbol',
    'asterisk_symbol',
]);

const EXPECTED_CATEGORY_COUNTS = {
    people: 498,
    nature: 218,
    food: 130,
    activity: 123,
    travel: 131,
    objects: 227,
    symbols: 302,
    flags: 270,
};

function stripColons(value) {
    return String(value || '').replace(/^:/, '').replace(/:$/, '');
}

function codePointsToChar(codePoints) {
    return String(codePoints)
        .split('-')
        .filter(Boolean)
        .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
        .join('');
}

function quote(value) {
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function shouldInclude(entry) {
    if (!CATEGORY_IDS.has(entry.category)) {
        return false;
    }
    if (entry.diversity !== null) {
        return false;
    }

    const shortname = stripColons(entry.shortname);
    return !HAIR_COLOR_PEOPLE.has(shortname) &&
        !HAIR_COMPONENTS.has(shortname) &&
        !KEYCAP_COMPONENTS.has(shortname);
}

function buildData(joypixels) {
    const entries = [];

    Object.values(joypixels).forEach((entry) => {
        if (!shouldInclude(entry)) {
            return;
        }

        const shortcode = stripColons(entry.shortname);
        const aliases = (entry.shortname_alternates || [])
            .map(stripColons)
            .filter((alias) => alias && alias !== shortcode);

        entries.push({
            char: codePointsToChar(entry.code_points.fully_qualified || entry.code_points.base),
            name: entry.name,
            shortcode,
            aliases,
            category: entry.category,
            order: entry.order,
            version: Number(entry.unicode_version) || 0,
        });
    });

    entries.sort((a, b) => a.order - b.order);

    const byCategory = {};
    CATEGORIES.forEach((category) => {
        byCategory[category.id] = [];
    });

    const shortcodeToChar = {};
    entries.forEach((entry) => {
        byCategory[entry.category].push(entry);
        [entry.shortcode, ...entry.aliases].forEach((name) => {
            if (shortcodeToChar[name] && shortcodeToChar[name] !== entry.char) {
                throw new Error(`Duplicate shortname ${name}: ${shortcodeToChar[name]} and ${entry.char}`);
            }
            shortcodeToChar[name] = entry.char;
        });
    });

    CATEGORIES.forEach((category) => {
        const expected = EXPECTED_CATEGORY_COUNTS[category.id];
        const actual = byCategory[category.id].length;
        if (actual !== expected) {
            throw new Error(`Expected ${expected} ${category.id} emoji, found ${actual}`);
        }
    });

    const total = entries.length;
    const expectedTotal = Object.values(EXPECTED_CATEGORY_COUNTS)
        .reduce((sum, count) => sum + count, 0);
    if (total !== expectedTotal) {
        throw new Error(`Expected ${expectedTotal} emoji, found ${total}`);
    }

    return { byCategory, shortcodeToChar };
}

function render(data) {
    const lines = [
        "'kiwi public';",
        '',
        '/*',
        ' * Generated from JoyPixels emoji-toolkit emoji.json.',
        ' * https://github.com/joypixels/emoji-toolkit',
        ' *',
        ' * Only non-artwork metadata is used. Skin-tone variants, regional-indicator',
        ' * components, keycap components, and hair-color variants are excluded.',
        ' */',
        '',
        'export const categories = [',
    ];

    CATEGORIES.forEach((category) => {
        lines.push('    {');
        lines.push(`        id: ${quote(category.id)},`);
        lines.push(`        label: ${quote(category.label)},`);
        lines.push(`        icon: ${quote(category.icon)},`);
        lines.push('    },');
    });
    lines.push('];');
    lines.push('');
    lines.push('export const emojiData = {');

    CATEGORIES.forEach((category) => {
        lines.push(`    ${category.id}: [`);
        data.byCategory[category.id].forEach((emoji) => {
            lines.push('        {');
            lines.push(`            char: ${quote(emoji.char)},`);
            lines.push(`            name: ${quote(emoji.name)},`);
            lines.push(`            shortcode: ${quote(emoji.shortcode)},`);
            if (emoji.aliases.length) {
                lines.push(`            aliases: [${emoji.aliases.map(quote).join(', ')}],`);
            }
            lines.push(`            version: ${emoji.version},`);
            lines.push('        },');
        });
        lines.push('    ],');
    });

    lines.push('};');
    lines.push('');
    lines.push('export const shortcodeToChar = {');

    Object.keys(data.shortcodeToChar).forEach((name) => {
        lines.push(`    ${quote(name)}: ${quote(data.shortcodeToChar[name])},`);
    });

    lines.push('};');
    lines.push('');

    return lines.join('\n');
}

function main() {
    const sourcePath = process.argv[2];
    if (!sourcePath) {
        throw new Error('Usage: node scripts/generate-emojis.js /path/to/emoji.json');
    }

    const joypixels = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const data = buildData(joypixels);
    const outputPath = path.join(__dirname, '..', 'src', 'res', 'emojis.js');
    fs.writeFileSync(outputPath, render(data));
    process.stdout.write(`Wrote ${outputPath}\n`);
}

main();
