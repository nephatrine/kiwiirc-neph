const fs = require('node:fs');
const path = require('node:path');
const { atomicWriteFile, ensureDirectory } = require('./file-utils');

const STATE_FILENAME = 'window-state.json';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 820;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 560;
const MIN_VISIBLE = 100;

function stateFilePath(userDataDir) {
    return path.join(userDataDir, STATE_FILENAME);
}

function finiteNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function intersects(bounds, area) {
    const left = Math.max(bounds.x, area.x);
    const right = Math.min(bounds.x + bounds.width, area.x + area.width);
    const top = Math.max(bounds.y, area.y);
    const bottom = Math.min(bounds.y + bounds.height, area.y + area.height);
    return right - left >= MIN_VISIBLE && bottom - top >= MIN_VISIBLE;
}

function centeredBounds(area, width, height) {
    return {
        x: Math.round(area.x + Math.max(0, (area.width - width) / 2)),
        y: Math.round(area.y + Math.max(0, (area.height - height) / 2)),
        width,
        height,
    };
}

function restoreWindowState(savedState, workAreas, primaryWorkArea) {
    let areas = [];
    if (Array.isArray(workAreas)) {
        areas = workAreas.filter((area) => (
            finiteNumber(area.x) !== null &&
            finiteNumber(area.y) !== null &&
            finiteNumber(area.width) !== null &&
            finiteNumber(area.height) !== null
        ));
    }
    const primary = primaryWorkArea || areas[0] || {
        x: 0,
        y: 0,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
    };

    const savedWidth = finiteNumber(savedState && savedState.width) || DEFAULT_WIDTH;
    const savedHeight = finiteNumber(savedState && savedState.height) || DEFAULT_HEIGHT;
    const savedX = finiteNumber(savedState && savedState.x);
    const savedY = finiteNumber(savedState && savedState.y);

    let area = primary;
    let savedBounds = null;
    if (savedX !== null && savedY !== null) {
        savedBounds = {
            x: savedX,
            y: savedY,
            width: savedWidth,
            height: savedHeight,
        };
        area = areas.find((candidate) => intersects(savedBounds, candidate)) || primary;
    }

    const width = Math.max(
        MIN_WIDTH,
        Math.min(Math.round(savedWidth), Math.round(area.width))
    );
    const height = Math.max(
        MIN_HEIGHT,
        Math.min(Math.round(savedHeight), Math.round(area.height))
    );

    let x;
    let y;
    if (savedX !== null && savedY !== null && savedBounds && area !== primary) {
        x = clamp(savedX, area.x, area.x + area.width - width);
        y = clamp(savedY, area.y, area.y + area.height - height);
    } else if (savedX !== null && savedY !== null && intersects(savedBounds, primary)) {
        x = clamp(savedX, primary.x, primary.x + primary.width - width);
        y = clamp(savedY, primary.y, primary.y + primary.height - height);
    } else {
        const centered = centeredBounds(primary, width, height);
        x = centered.x;
        y = centered.y;
    }

    return {
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
        maximized: !!(savedState && savedState.maximized),
    };
}

function loadWindowState(userDataDir) {
    try {
        const value = JSON.parse(fs.readFileSync(stateFilePath(userDataDir), 'utf8'));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (err) {
        return null;
    }
}

async function saveWindowState(userDataDir, state) {
    await ensureDirectory(userDataDir);
    await atomicWriteFile(stateFilePath(userDataDir), JSON.stringify(state));
}

function saveWindowStateSync(userDataDir, state) {
    const filePath = stateFilePath(userDataDir);
    fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
    const tempPath = `${filePath}.${process.pid}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(state), { mode: 0o600 });
    try {
        fs.renameSync(tempPath, filePath);
    } catch (err) {
        fs.rmSync(filePath, { force: true });
        fs.renameSync(tempPath, filePath);
    }
}

module.exports = {
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    MIN_HEIGHT,
    MIN_WIDTH,
    STATE_FILENAME,
    loadWindowState,
    restoreWindowState,
    saveWindowState,
    saveWindowStateSync,
    stateFilePath,
};
