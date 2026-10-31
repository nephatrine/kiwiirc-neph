import IrcInput from '@/components/utils/IrcInput';

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
