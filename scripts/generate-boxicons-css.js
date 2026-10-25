#!/usr/bin/env node

/*
 * Generate src/res/boxicons.css from the installed Boxicons package.
 *
 * Usage:
 *   npm run generate:boxicons
 *
 * The package stylesheet references eot, woff, ttf and svg copies of the
 * font. Kiwi only ships the woff2, so the @font-face block is rewritten.
 */

const fs = require('fs');
const path = require('path');

const sourcePath = require.resolve('boxicons/css/boxicons.min.css');
const packagePath = require.resolve('boxicons/package.json');
const outputPath = path.join(__dirname, '../src/res/boxicons.css');
const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;

const fontFace = '@font-face{font-family:boxicons;font-weight:400;font-style:normal;'
    + 'font-display:block;src:url("~boxicons/fonts/boxicons.woff2") format("woff2")}';
const css = fs.readFileSync(sourcePath, 'utf8');
const output = css.replace(/@font-face\{[^}]*\}/, fontFace);

if (output === css) {
    throw new Error('Could not find the Boxicons @font-face block');
}

const header = `/*
 * Generated from boxicons@${version} by scripts/generate-boxicons-css.js.
 * Do not edit by hand.
 *
 * Only the woff2 font is referenced so webpack does not emit the package's
 * eot, woff, ttf and svg copies.
 */
`;

fs.writeFileSync(outputPath, header + output + '\n');
console.log(`Wrote ${path.relative(process.cwd(), outputPath)} from boxicons@${version}`);
