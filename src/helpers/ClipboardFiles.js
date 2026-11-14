export function filesFromClipboard(clipboardData) {
    if (!clipboardData) {
        return [];
    }

    const files = Array.from(clipboardData.files || []);
    if (files.length) {
        return files;
    }

    const items = Array.from(clipboardData.items || [])
        .filter((item) => (
            item &&
            item.kind === 'file' &&
            typeof item.getAsFile === 'function'
        ))
        .map((item) => item.getAsFile())
        .filter(Boolean);

    const images = items.filter((file) => (
        typeof file.type === 'string' &&
        file.type.indexOf('image/') === 0
    ));
    if (images.length) {
        const nonImages = items.filter((file) => (
            typeof file.type !== 'string' ||
            file.type.indexOf('image/') !== 0
        ));
        return [images[0], ...nonImages];
    }

    return items;
}
