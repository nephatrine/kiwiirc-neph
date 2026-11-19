jest.mock('@/libs/fileupload', () => ({
    effectiveService: jest.fn(),
    effectiveRetention: jest.fn(() => ''),
}));

import { effectiveService } from '@/libs/fileupload';
import { filesFromClipboard } from '@/helpers/ClipboardFiles';
import ControlInput from '@/components/ControlInput';

describe('ControlInput uploads', () => {
    function makeBrowseContext(options = {}) {
        const input = {
            getRawText: jest.fn(() => options.rawText || ''),
            appendText: jest.fn(),
        };
        const buffer = {
            name: '#test',
            networkid: 1,
            current_input: options.currentInput || '',
        };
        const otherBuffer = {
            name: '#other',
            networkid: 1,
            current_input: '',
        };
        const state = {
            setting: jest.fn((name) => {
                if (name === 'buffers.shared_input') {
                    return !!options.sharedInput;
                }
                return undefined;
            }),
        };

        return {
            input,
            buffer,
            otherBuffer,
            context: {
                buffer: options.inactive ? otherBuffer : buffer,
                $refs: { input },
                $state: state,
            },
        };
    }

    test('appends the uploaded URL to the active input or the buffer draft', () => {
        let ctx = makeBrowseContext({
            rawText: 'hello',
        });

        ControlInput.methods.appendUploadUrl.call(
            ctx.context,
            ctx.buffer,
            'https://files.example/a.txt'
        );

        expect(ctx.input.appendText).toHaveBeenCalledWith(
            ' https://files.example/a.txt'
        );

        ctx = makeBrowseContext();

        ControlInput.methods.appendUploadUrl.call(
            ctx.context,
            ctx.buffer,
            'https://files.example/a.txt'
        );

        expect(ctx.input.appendText).toHaveBeenCalledWith(
            'https://files.example/a.txt'
        );

        ctx = makeBrowseContext({
            inactive: true,
            currentInput: 'hello',
        });

        ControlInput.methods.appendUploadUrl.call(
            ctx.context,
            ctx.buffer,
            'https://files.example/a.txt?x=1&y=2'
        );

        expect(ctx.input.appendText).not.toHaveBeenCalled();
        expect(ctx.buffer.current_input).toBe(
            'hello https://files.example/a.txt?x=1&amp;y=2'
        );

        ctx = makeBrowseContext({
            inactive: true,
            sharedInput: true,
        });

        ControlInput.methods.appendUploadUrl.call(
            ctx.context,
            ctx.buffer,
            'https://files.example/a.txt'
        );

        expect(ctx.input.appendText).toHaveBeenCalledWith(
            'https://files.example/a.txt'
        );
        expect(ctx.buffer.current_input).toBe('');
    });

    test('does not send an uploaded URL automatically', async() => {
        const upload = jest.fn(async() => 'https://files.example/a.txt');
        effectiveService.mockReturnValue({ upload, maxBytes: 0 });
        const buffer = {
            isChannel: () => true,
            isQuery: () => false,
            say: jest.fn(),
        };
        const network = {
            state: 'connected',
            ircClient: {},
        };
        const context = {
            buffer,
            fileUploadNetwork: network,
            $state: {},
            appendUploadUrl: jest.fn(),
            showUploadError: jest.fn(),
        };

        await ControlInput.methods.uploadOne.call(context, {
            name: 'a.txt',
            size: 1,
        });

        expect(upload).toHaveBeenCalled();
        expect(context.appendUploadUrl).toHaveBeenCalledWith(
            buffer,
            'https://files.example/a.txt'
        );
        expect(buffer.say).not.toHaveBeenCalled();
    });

    test('leaves the input alone when the upload fails', async() => {
        const upload = jest.fn(async() => {
            throw new Error('upload failed');
        });
        effectiveService.mockReturnValue({ upload, maxBytes: 0 });
        const buffer = {
            isChannel: () => true,
            isQuery: () => false,
        };
        const context = {
            buffer,
            fileUploadNetwork: {
                state: 'connected',
                ircClient: {},
            },
            $state: {},
            appendUploadUrl: jest.fn(),
            showUploadError: jest.fn(),
        };

        await ControlInput.methods.uploadOne.call(context, {
            name: 'a.txt',
            size: 1,
        });

        expect(context.appendUploadUrl).not.toHaveBeenCalled();
        expect(context.showUploadError).toHaveBeenCalled();
    });
});

describe('clipboard files', () => {
    function file(name, type = 'image/png', size = 10) {
        return {
            name,
            type,
            size,
            lastModified: 1,
        };
    }

    test('prefers clipboard files and returns every one of them', () => {
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

    test('falls back to file items and handles missing data', () => {
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
