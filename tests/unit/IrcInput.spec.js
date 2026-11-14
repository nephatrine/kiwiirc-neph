import IrcInput from '@/components/utils/IrcInput';

describe('IrcInput paste handling', () => {
    test('emits files for pasted clipboard images', () => {
        const image = {
            name: 'image.png',
            type: 'image/png',
            size: 10,
            lastModified: 1,
        };
        const context = {
            $emit: jest.fn(),
        };
        const event = {
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

        const methods = (IrcInput.options || IrcInput).methods;
        methods.onPaste.call(context, event);

        expect(event.preventDefault).toHaveBeenCalled();
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
