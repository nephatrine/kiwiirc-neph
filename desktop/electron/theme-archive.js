/* eslint-disable no-bitwise, no-restricted-syntax, no-await-in-loop */

const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { TextDecoder } = require('node:util');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_COMMENT_LENGTH = 0xffff;

const DEFAULT_LIMITS = Object.freeze({
    maxEntries: 2000,
    maxEntryUncompressedBytes: 16 * 1024 * 1024,
    maxTotalUncompressedBytes: 64 * 1024 * 1024,
    maxCompressionRatio: 200,
});

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[i] = value >>> 0;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
        crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
    if (buffer.length < 22) {
        return -1;
    }

    const minOffset = Math.max(0, buffer.length - 22 - MAX_COMMENT_LENGTH);
    for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
        if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) {
            continue;
        }

        const commentLength = buffer.readUInt16LE(offset + 20);
        if (offset + 22 + commentLength === buffer.length) {
            return offset;
        }
    }

    return -1;
}

function decodeEntryName(nameBuffer, flags) {
    if (flags & 0x800) {
        return nameBuffer.toString('utf8');
    }

    try {
        return utf8Decoder.decode(nameBuffer);
    } catch (err) {
        return nameBuffer.toString('latin1');
    }
}

function safeArchivePath(name) {
    const raw = String(name || '').replace(/\\/g, '/');
    if (!raw || raw.indexOf('\0') !== -1) {
        return null;
    }
    if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
        return null;
    }

    const segments = raw.split('/');
    const cleaned = [];
    for (const segment of segments) {
        if (!segment || segment === '.') {
            continue;
        }
        if (segment === '..') {
            return null;
        }
        cleaned.push(segment);
    }

    return cleaned.length ? cleaned.join('/') : null;
}

function isIgnoredPath(relativePath) {
    const parts = relativePath.split('/');
    if (parts[0].toLowerCase() === '__macosx') {
        return true;
    }

    const base = parts[parts.length - 1].toLowerCase();
    return base === '.ds_store' || base === 'thumbs.db';
}

function isSymlinkEntry(versionMadeBy, externalAttributes) {
    const madeByUnix = (versionMadeBy >> 8) === 3;
    if (!madeByUnix) {
        return false;
    }

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const fileType = unixMode & 0o170000;
    return fileType === 0o120000;
}

function isDirectoryEntry(name, versionMadeBy, externalAttributes) {
    if (name.endsWith('/') || name.endsWith('\\')) {
        return true;
    }

    const madeByUnix = (versionMadeBy >> 8) === 3;
    if (!madeByUnix) {
        return false;
    }

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    return (unixMode & 0o170000) === 0o040000;
}

function readCentralDirectory(buffer, limits) {
    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset === -1) {
        throw new Error('Archive is not a valid ZIP file');
    }

    const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
    const centralDisk = buffer.readUInt16LE(eocdOffset + 6);
    const entriesThisDisk = buffer.readUInt16LE(eocdOffset + 8);
    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const centralSize = buffer.readUInt32LE(eocdOffset + 12);
    const centralOffset = buffer.readUInt32LE(eocdOffset + 16);

    if (diskNumber !== 0 || centralDisk !== 0 || entriesThisDisk !== totalEntries) {
        throw new Error('Multi-disk ZIP archives are not supported');
    }
    if (totalEntries === 0xffff ||
        centralSize === 0xffffffff ||
        centralOffset === 0xffffffff
    ) {
        throw new Error('ZIP64 archives are not supported');
    }
    if (totalEntries > limits.maxEntries) {
        throw new Error('Archive contains too many entries');
    }
    if (centralOffset + centralSize > eocdOffset) {
        throw new Error('Archive central directory is invalid');
    }

    const entries = [];
    let offset = centralOffset;

    for (let i = 0; i < totalEntries; i++) {
        if (offset + 46 > buffer.length ||
            buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE
        ) {
            throw new Error('Archive central directory is invalid');
        }

        const versionMadeBy = buffer.readUInt16LE(offset + 4);
        const flags = buffer.readUInt16LE(offset + 8);
        const method = buffer.readUInt16LE(offset + 10);
        const expectedCrc = buffer.readUInt32LE(offset + 16);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const externalAttributes = buffer.readUInt32LE(offset + 38);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const entryEnd = offset + 46 + nameLength + extraLength + commentLength;

        if (entryEnd > buffer.length) {
            throw new Error('Archive central directory is invalid');
        }
        if (flags & 0x1) {
            throw new Error('Encrypted ZIP entries are not supported');
        }
        if (method !== 0 && method !== 8) {
            throw new Error('Unsupported ZIP compression method');
        }
        if (compressedSize === 0xffffffff ||
            uncompressedSize === 0xffffffff ||
            localOffset === 0xffffffff
        ) {
            throw new Error('ZIP64 archives are not supported');
        }
        if (isSymlinkEntry(versionMadeBy, externalAttributes)) {
            throw new Error('Theme archives may not contain symlinks');
        }

        const nameBuffer = buffer.subarray(offset + 46, offset + 46 + nameLength);
        const name = decodeEntryName(nameBuffer, flags);
        const directory = isDirectoryEntry(name, versionMadeBy, externalAttributes);

        entries.push({
            name,
            directory,
            method,
            expectedCrc,
            compressedSize,
            uncompressedSize,
            localOffset,
        });

        offset = entryEnd;
    }

    return entries;
}

function extractEntryData(buffer, entry) {
    const localOffset = entry.localOffset;
    if (localOffset + 30 > buffer.length ||
        buffer.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE
    ) {
        throw new Error('Archive local file header is invalid');
    }

    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + entry.compressedSize;

    if (localFlags & 0x1) {
        throw new Error('Encrypted ZIP entries are not supported');
    }
    if (localMethod !== entry.method || dataEnd > buffer.length) {
        throw new Error('Archive local file header is invalid');
    }

    const compressed = buffer.subarray(dataOffset, dataEnd);
    if (entry.method === 0) {
        if (entry.compressedSize !== entry.uncompressedSize) {
            throw new Error('Archive stored entry size is invalid');
        }
        return Buffer.from(compressed);
    }

    return zlib.inflateRawSync(compressed);
}

async function writeEntry(destination, relativePath, data) {
    const root = path.resolve(destination);
    const target = path.resolve(root, relativePath);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;

    if (target === root || !target.startsWith(prefix)) {
        throw new Error('Archive contains an unsafe path');
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data, { flag: 'wx', mode: 0o600 });
}

async function extractZipArchive(buffer, destination, options = {}) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('Archive data must be a buffer');
    }

    const limits = { ...DEFAULT_LIMITS, ...options };
    const entries = readCentralDirectory(buffer, limits);
    let totalUncompressed = 0;
    let extracted = 0;

    for (const entry of entries) {
        if (entry.uncompressedSize > limits.maxEntryUncompressedBytes) {
            throw new Error('Archive entry is too large');
        }
        if (entry.compressedSize > 0 &&
            entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio
        ) {
            throw new Error('Archive compression ratio is too high');
        }

        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > limits.maxTotalUncompressedBytes) {
            throw new Error('Archive expands to too much data');
        }

        const relativePath = safeArchivePath(entry.name);
        if (!relativePath) {
            throw new Error('Archive contains an unsafe path');
        }
        if (isIgnoredPath(relativePath)) {
            continue;
        }
        if (entry.directory) {
            continue;
        }

        const data = extractEntryData(buffer, entry);
        if (data.length !== entry.uncompressedSize ||
            crc32(data) !== entry.expectedCrc
        ) {
            throw new Error('Archive entry failed integrity checks');
        }

        await writeEntry(destination, relativePath, data);
        extracted++;
    }

    return { entries: extracted };
}

module.exports = {
    DEFAULT_LIMITS,
    crc32,
    extractZipArchive,
    findEndOfCentralDirectory,
    safeArchivePath,
};
