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
    it('prefers clipboard files and returns every one of them', () => {
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

        const several = {
            files: [first, second],
            items: [],
        };

        expect(filesFromClipboard(several)).toEqual([first, second]);
    });

    it('falls back to file items and handles missing data', () => {
        const image = file('image.png');
        let clipboardData = {
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

        const png = file('image.png', 'image/png', 20);
        const bmp = file('image.bmp', 'image/bmp', 40);
        clipboardData = {
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

        const text = file('notes.txt', 'text/plain');
        const pdf = file('document.pdf', 'application/pdf');
        clipboardData = {
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

        expect(filesFromClipboard(null)).toEqual([]);
        expect(filesFromClipboard({})).toEqual([]);
    });
});
