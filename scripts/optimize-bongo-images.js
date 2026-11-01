#!/usr/bin/env node

/*
 * Convert Bongo Companion source PNGs to lossy WebP siblings.
 *
 * The PNGs remain the editable source and are still used by the standalone
 * artboard. The plugin definitions use the generated .webp files.
 *
 * Requires ImageMagick with WebP support. No npm dependency is needed.
 *
 * Usage:
 *   npm run optimize:bongo
 *   npm run optimize:bongo -- --force
 *   WEBP_QUALITY=82 npm run optimize:bongo
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'static', 'plugins', 'bongo-cat');
const QUALITY = Math.min(100, Math.max(1, parseInt(process.env.WEBP_QUALITY, 10) || 85));
const FORCE = process.argv.includes('--force');
const VERBOSE = process.argv.includes('--verbose');

function findImageMagick() {
    const candidates = [process.env.IMAGEMAGICK, 'magick', 'convert'].filter(Boolean);
    const command = candidates.find((candidate) => (
        spawnSync(candidate, ['-version'], { stdio: 'ignore' }).status === 0
    ));
    if (command) {
        return command;
    }
    throw new Error(
        'ImageMagick was not found. Install it or set IMAGEMAGICK to the executable.'
    );
}

function checkWebpSupport(command) {
    const result = spawnSync(command, ['-list', 'format'], { encoding: 'utf8' });
    if (result.status !== 0 || !/\bWEBP\b/.test(result.stdout || '')) {
        throw new Error(
            `${command} does not report WebP support. Install libwebp support for ImageMagick.`
        );
    }
}

function walk(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(entryPath));
        } else if (entry.name.toLowerCase().endsWith('.png')) {
            files.push(entryPath);
        }
    });
    return files.sort();
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

function needsConversion(source, target) {
    if (FORCE || !fs.existsSync(target)) {
        return true;
    }
    return fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs;
}

function convert(command, source, target) {
    const args = [
        source,
        '-strip',
        '-quality', String(QUALITY),
        '-define', 'webp:method=6',
        '-define', 'webp:alpha-quality=100',
        target,
    ];
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim();
        throw new Error(`Failed to convert ${source}${detail ? `: ${detail}` : ''}`);
    }
}

function main() {
    const command = findImageMagick();
    checkWebpSupport(command);

    const sources = walk(SOURCE_DIR);
    let converted = 0;
    let skipped = 0;
    let before = 0;
    let after = 0;

    sources.forEach((source) => {
        const target = source.replace(/\.png$/i, '.webp');
        const sourceSize = fileSize(source);
        if (!needsConversion(source, target)) {
            skipped++;
            before += sourceSize;
            after += fileSize(target);
            return;
        }

        convert(command, source, target);
        converted++;
        before += sourceSize;
        after += fileSize(target);
        if (VERBOSE) {
            console.log(`${path.relative(ROOT, source)} -> ${path.relative(ROOT, target)}`);
        }
    });

    const saved = before - after;
    const percent = before ? ((saved / before) * 100).toFixed(1) : '0.0';
    console.log(
        `Bongo WebP: ${sources.length} PNGs, ${converted} converted, ${skipped} up to date`
    );
    console.log(
        `  ${formatBytes(before)} -> ${formatBytes(after)} ` +
        `(${percent}% smaller, quality ${QUALITY})`
    );
}

try {
    main();
} catch (err) {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
}
