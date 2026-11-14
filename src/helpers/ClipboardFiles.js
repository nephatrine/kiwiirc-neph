function fileKey(file) {
    return [
        file.name || '',
        file.size || 0,
        file.type || '',
        file.lastModified || 0,
    ].join(':');
}

export function filesFromClipboard(clipboardData) {
    const files = [];
    const seen = new Set();

    function add(file) {
        if (!file) {
            return;
        }
        const key = fileKey(file);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        files.push(file);
    }

    if (clipboardData && clipboardData.files) {
        Array.from(clipboardData.files).forEach(add);
    }

    if (clipboardData && clipboardData.items) {
        Array.from(clipboardData.items).forEach((item) => {
            if (item && item.kind === 'file' && typeof item.getAsFile === 'function') {
                add(item.getAsFile());
            }
        });
    }

    return files;
}
