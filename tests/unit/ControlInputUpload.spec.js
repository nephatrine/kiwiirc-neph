jest.mock('@/libs/fileupload', () => ({
    effectiveService: jest.fn(),
    effectiveRetention: jest.fn(() => ''),
}));

import { effectiveService } from '@/libs/fileupload';
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
