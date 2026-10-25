#!/usr/bin/env node

/*
 * Minify static assets that webpack copies into dist/.
 *
 * - Themes: postcss + cssnano
 * - Plugin HTML: html-minifier-terser
 * - Locales: compact JSON
 *
 * Config files, station lists, and other static data are left untouched.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const cssnano = require('cssnano');
const { minify } = require('html-minifier-terser');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'static');
const groups = {
    themes: [],
    plugins: [],
    locales: [],
};

function walk(dir, extension) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(entryPath, extension));
        } else if (entry.name.toLowerCase().endsWith(extension)) {
            files.push(entryPath);
        }
    });
    return files;
}

function fileSize(file) {
    return fs.statSync(file).size;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    return `${(bytes / 1024).toFixed(1)} KiB`;
}

function record(group, file, before, after) {
    groups[group].push({ file, before, after });
}

async function minifyTheme(file) {
    const before = fileSize(file);
    const css = fs.readFileSync(file, 'utf8');
    const result = await postcss([cssnano({ preset: 'default' })])
        .process(css, { from: undefined });
    if (!result.css) {
        throw new Error(`cssnano produced no output for ${file}`);
    }
    fs.writeFileSync(file, result.css);
    record('themes', file, before, fileSize(file));
}

async function minifyPlugin(file) {
    const before = fileSize(file);
    const html = fs.readFileSync(file, 'utf8');
    const result = await minify(html, {
        collapseWhitespace: 'conservative',
        conservativeCollapse: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
        ignoreCustomFragments: [/\{\{[\s\S]*?\}\}/g],
    });
    if (!result) {
        throw new Error(`html-minifier-terser produced no output for ${file}`);
    }
    fs.writeFileSync(file, result);
    record('plugins', file, before, fileSize(file));
}

function minifyLocale(file) {
    const before = fileSize(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(data));
    record('locales', file, before, fileSize(file));
}

function reportGroup(label, entries) {
    const before = entries.reduce((sum, entry) => sum + entry.before, 0);
    const after = entries.reduce((sum, entry) => sum + entry.after, 0);
    const saved = before - after;
    const percent = before ? ((saved / before) * 100).toFixed(1) : '0.0';
    console.log(
        `  ${label}: ${entries.length} files, ${formatBytes(before)} -> ` +
        `${formatBytes(after)} (${percent}% smaller)`
    );
}

async function main() {
    if (!fs.existsSync(DIST)) {
        throw new Error('dist/static does not exist; run the production build first');
    }

    const themes = walk(path.join(DIST, 'themes'), '.css');
    const plugins = walk(path.join(DIST, 'plugins'), '.html');
    const locales = walk(path.join(DIST, 'locales'), '.json');

    await Promise.all(themes.map((file) => minifyTheme(file)));
    await Promise.all(plugins.map((file) => minifyPlugin(file)));
    locales.forEach((file) => minifyLocale(file));

    console.log('Static asset minification:');
    reportGroup('themes', groups.themes);
    reportGroup('plugins', groups.plugins);
    reportGroup('locales', groups.locales);
}

main().catch((err) => {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
});
