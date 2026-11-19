import IrcInput from '@/components/utils/IrcInput';

describe('IrcInput paste handling', () => {
    test('emits pasted clipboard images once', () => {
        const image = {
            name: 'image.png',
            type: 'image/png',
            size: 10,
            lastModified: 1,
        };
        const methods = (IrcInput.options || IrcInput).methods;
        let context = {
            $emit: jest.fn(),
        };
        let event = {
            preventDefault: jest.fn(),
            clipboardData: {
                files: [],
                items: [{
                    kind: 'file',
                    getAsFile: () => image,
                }],
                types: ['image/png'],
            },
        };

        methods.onPaste.call(context, event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(context.$emit).toHaveBeenCalledWith('files', [image]);

        const duplicate = {
            name: 'image.png',
            type: 'image/png',
            size: 10,
            lastModified: 2,
        };
        context = {
            $emit: jest.fn(),
        };
        event = {
            preventDefault: jest.fn(),
            clipboardData: {
                files: [image],
                items: [{
                    kind: 'file',
                    getAsFile: () => duplicate,
                }],
                types: ['image/png'],
            },
        };

        methods.onPaste.call(context, event);

        expect(context.$emit).toHaveBeenCalledWith('files', [image]);
    });
});

describe('IrcInput non-breaking spaces', () => {
    test('normalizes non-breaking spaces in raw text', () => {
        const context = {
            $refs: {
                editor: {
                    innerText: '/lim\u00A0EIGHTBALL Am I cool?',
                },
            },
        };

        const methods = (IrcInput.options || IrcInput).methods;

        expect(methods.getRawText.call(context))
            .toBe('/lim EIGHTBALL Am I cool?');
    });
});
