const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../..');
const sourceSvg = path.join(projectRoot, 'static', 'kiwi.svg');
const buildDir = path.join(projectRoot, 'desktop', 'build');
const iconDir = path.join(buildDir, 'icons');
const windowsIcon = path.join(buildDir, 'icon.ico');
const pngSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512];
const windowsSizes = pngSizes.filter((size) => size <= 256);

function commandExists(command) {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return !result.error && result.status === 0;
}

function run(command, args) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}`);
    }
}

function magickCommand() {
    if (commandExists('magick')) {
        return 'magick';
    }
    if (commandExists('convert')) {
        return 'convert';
    }
    throw new Error('ImageMagick is required (magick or convert)');
}

if (!fs.existsSync(sourceSvg)) {
    throw new Error(`Source icon not found: ${sourceSvg}`);
}
if (!commandExists('rsvg-convert')) {
    throw new Error('rsvg-convert is required to render the SVG icon');
}

const magick = magickCommand();

fs.rmSync(iconDir, { recursive: true, force: true });
fs.mkdirSync(iconDir, { recursive: true });

const pngFiles = pngSizes.map((size) => {
    const output = path.join(iconDir, `${size}x${size}.png`);
    run('rsvg-convert', ['-w', String(size), '-h', String(size), sourceSvg, '-o', output]);
    return output;
});

const windowsPngs = windowsSizes.map((size) => path.join(iconDir, `${size}x${size}.png`));
run(magick, [...windowsPngs, windowsIcon]);

const iconStats = fs.statSync(windowsIcon);
if (!iconStats.isFile() || iconStats.size === 0) {
    throw new Error(`Failed to create ${windowsIcon}`);
}

console.log(`Generated ${windowsIcon}`);
console.log(`Generated ${pngFiles.length} PNG icons in ${iconDir}`);
