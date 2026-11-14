import { filesFromClipboard } from '@/helpers/ClipboardFiles';

function file(name, type = 'image/png', size = 10) {
    return {
        name,
        type,
        size,
        lastModified: 1,
    };
}

describe('clipboard files', () => {
    it('prefers clipboard files over file items', () => {
        const first = file('first.png');
        const second = file('second.png');
        const clipboardData = {
            files: [first],
            items: [
                {
                    kind: 'file',
                    getAsFile: () => second,
                },
            ],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([first]);
    });

    it('returns every file when the clipboard provides several files', () => {
        const first = file('first.png');
        const second = file('second.png');
        const clipboardData = {
            files: [first, second],
            items: [],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([first, second]);
    });

    it('falls back to file items when files are absent', () => {
        const image = file('image.png');
        const clipboardData = {
            files: [],
            items: [
                {
                    kind: 'file',
                    getAsFile: () => image,
                },
                {
                    kind: 'string',
                    getAsFile: () => null,
                },
            ],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([image]);
    });

    it('uses one image representation when several are exposed', () => {
        const png = file('image.png', 'image/png', 20);
        const bmp = file('image.bmp', 'image/bmp', 40);
        const clipboardData = {
            files: [],
            items: [
                {
                    kind: 'file',
                    getAsFile: () => png,
                },
                {
                    kind: 'file',
                    getAsFile: () => bmp,
                },
            ],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([png]);
    });

    it('keeps non-image file items together', () => {
        const text = file('notes.txt', 'text/plain');
        const pdf = file('document.pdf', 'application/pdf');
        const clipboardData = {
            files: [],
            items: [
                {
                    kind: 'file',
                    getAsFile: () => text,
                },
                {
                    kind: 'file',
                    getAsFile: () => pdf,
                },
            ],
        };

        expect(filesFromClipboard(clipboardData)).toEqual([text, pdf]);
    });

    it('handles missing clipboard data', () => {
        expect(filesFromClipboard(null)).toEqual([]);
        expect(filesFromClipboard({})).toEqual([]);
    });
});
