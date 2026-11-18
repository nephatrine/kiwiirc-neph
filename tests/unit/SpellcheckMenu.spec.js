const {
    buildContextMenuTemplate,
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

describe('page context menu', () => {
    function labels(template) {
        return template.map((item) => item.label || item.role);
    }

    it('offers link and selection actions', () => {
        const copyText = jest.fn();
        const openExternal = jest.fn();
        const template = buildContextMenuTemplate({
            linkURL: 'https://example.com/page',
            selectionText: 'hello',
            mediaType: 'none',
            isEditable: false,
        }, {
            copyText,
            canOpenExternal: () => true,
            openExternal,
        });

        expect(labels(template)).toEqual([
            'Copy Link Address',
            'Open Link in Browser',
            undefined,
            'copy',
            undefined,
            'selectAll',
        ]);

        template[0].click();
        expect(copyText).toHaveBeenCalledWith('https://example.com/page');

        template[1].click();
        expect(openExternal).toHaveBeenCalledWith('https://example.com/page');
    });

    it('hides Open Link in Browser for unsupported schemes', () => {
        const template = buildContextMenuTemplate({
            linkURL: 'ftp://example.com/file',
            isEditable: false,
        }, {
            copyText: jest.fn(),
            canOpenExternal: () => false,
            openExternal: jest.fn(),
        });

        expect(labels(template)).toEqual([
            'Copy Link Address',
            undefined,
            'selectAll',
        ]);
    });

    it('offers image address and image copy', () => {
        const copyText = jest.fn();
        const copyImage = jest.fn();
        const template = buildContextMenuTemplate({
            mediaType: 'image',
            srcURL: 'https://example.com/a.png',
            isEditable: false,
        }, {
            copyText,
            copyImage,
        });

        expect(labels(template)).toEqual([
            'Copy Image Address',
            'Copy Image',
            undefined,
            'selectAll',
        ]);

        template[0].click();
        expect(copyText).toHaveBeenCalledWith('https://example.com/a.png');

        template[1].click();
        expect(copyImage).toHaveBeenCalled();
    });

    it('offers a media address for audio and video', () => {
        const template = buildContextMenuTemplate({
            mediaType: 'video',
            srcURL: 'https://example.com/a.mp4',
            isEditable: false,
        }, {
            copyText: jest.fn(),
        });

        expect(labels(template)).toEqual([
            'Copy Media Address',
            undefined,
            'selectAll',
        ]);
    });

    it('returns nothing for empty areas', () => {
        expect(buildContextMenuTemplate({ isEditable: false }, {})).toEqual([]);
    });

    it('keeps the editable spellcheck menu for inputs', () => {
        const template = buildContextMenuTemplate({
            isEditable: true,
            misspelledWord: '',
            dictionarySuggestions: [],
            editFlags: { canCut: true },
        }, {});

        expect(labels(template)).toEqual([
            'cut',
            'copy',
            'paste',
            undefined,
            'selectAll',
        ]);
    });
});
