import { filesFromClipboard } from '@/helpers/ClipboardFiles';

function file(name, type = 'image/png') {
    return {
        name,
        type,
        size: 10,
        lastModified: 1,
    };
}

describe('clipboard files', () => {
    it('collects clipboard files and file items', () => {
        const first = file('first.png');
        const second = file('second.png');
        const clipboardData = {
            files: [first],
            items: [
                {
                    kind: 'file',
                    getAsFile: () => second,
                },
                {
                    kind: 'string',
                    getAsFile: () => null,
                },
            ],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([first, second]);
    });

    it('deduplicates the same file from files and items', () => {
        const image = file('image.png');
        const clipboardData = {
            files: [image],
            items: [{
                kind: 'file',
                getAsFile: () => image,
            }],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([image]);
    });

    it('handles missing clipboard data', () => {
        expect(filesFromClipboard(null)).toEqual([]);
        expect(filesFromClipboard({})).toEqual([]);
    });
});
