const {
    buildEditableContextMenuTemplate,
} = require('../../desktop/electron/spellcheck-menu');

describe('spellcheck context menu', () => {
    it('shows suggestions and dictionary action', () => {
        const replaceMisspelling = jest.fn();
        const addToDictionary = jest.fn();
        const template = buildEditableContextMenuTemplate({
            misspelledWord: 'teh',
            dictionarySuggestions: ['the', 'tea'],
            editFlags: {
                canCut: true,
                canCopy: true,
                canPaste: false,
            },
        }, {
            replaceMisspelling,
            addToDictionary,
        });

        expect(template.map((item) => item.label || item.role)).toEqual([
            'the',
            'tea',
            undefined,
            'Add to Dictionary',
            undefined,
            'cut',
            'copy',
            'paste',
            undefined,
            'selectAll',
        ]);

        template[0].click();
        expect(replaceMisspelling).toHaveBeenCalledWith('the');

        template[3].click();
        expect(addToDictionary).toHaveBeenCalledWith('teh');

        expect(template[5].enabled).toBe(true);
        expect(template[6].enabled).toBe(true);
        expect(template[7].enabled).toBe(false);
    });

    it('keeps edit actions when there is no misspelling', () => {
        const template = buildEditableContextMenuTemplate({
            misspelledWord: '',
            dictionarySuggestions: [],
            editFlags: {},
        });

        expect(template.map((item) => item.role)).toEqual([
            'cut',
            'copy',
            'paste',
            undefined,
            'selectAll',
        ]);
        expect(template[0].enabled).toBe(false);
    });
});
