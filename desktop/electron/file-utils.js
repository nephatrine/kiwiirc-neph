const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

async function ensureDirectory(directory, mode = 0o700) {
    await fs.mkdir(directory, { recursive: true, mode });
}

async function atomicWriteFile(filePath, data, mode = 0o600) {
    const directory = path.dirname(filePath);
    await ensureDirectory(directory);

    const tempPath = path.join(
        directory,
        `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
    );

    let handle = null;
    try {
        handle = await fs.open(tempPath, 'wx', mode);
        await handle.writeFile(data);
        await handle.sync();
        await handle.close();
        handle = null;

        try {
            await fs.rename(tempPath, filePath);
        } catch (err) {
            if (err.code !== 'EEXIST' && err.code !== 'EPERM' && err.code !== 'ENOTEMPTY') {
                throw err;
            }
            await fs.rm(filePath, { force: true });
            await fs.rename(tempPath, filePath);
        }
    } catch (err) {
        if (handle) {
            await handle.close().catch(() => {});
        }
        await fs.rm(tempPath, { force: true }).catch(() => {});
        throw err;
    }
}

async function readTextFile(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
}

async function removeFile(filePath) {
    await fs.rm(filePath, { force: true });
}

module.exports = {
    atomicWriteFile,
    ensureDirectory,
    readTextFile,
    removeFile,
};
