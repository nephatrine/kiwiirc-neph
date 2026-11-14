function buildEditableContextMenuTemplate(params = {}, actions = {}) {
    const suggestions = Array.isArray(params.dictionarySuggestions) ?
        params.dictionarySuggestions.slice(0, 5) :
        [];
    const template = suggestions.map((word) => ({
        label: word,
        click: () => {
            if (typeof actions.replaceMisspelling === 'function') {
                actions.replaceMisspelling(word);
            }
        },
    }));

    if (suggestions.length) {
        template.push({ type: 'separator' });
    }

    if (params.misspelledWord) {
        template.push(
            {
                label: 'Add to Dictionary',
                click: () => {
                    if (typeof actions.addToDictionary === 'function') {
                        actions.addToDictionary(params.misspelledWord);
                    }
                },
            },
            { type: 'separator' }
        );
    }

    const flags = params.editFlags || {};
    template.push(
        { role: 'cut', enabled: !!flags.canCut },
        { role: 'copy', enabled: !!flags.canCopy },
        { role: 'paste', enabled: !!flags.canPaste },
        { type: 'separator' },
        { role: 'selectAll' }
    );

    return template;
}

module.exports = {
    buildEditableContextMenuTemplate,
};
