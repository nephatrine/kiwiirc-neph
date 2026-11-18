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

function buildLinkItems(params, actions) {
    if (!params.linkURL) {
        return [];
    }

    const items = [{
        label: 'Copy Link Address',
        click: () => {
            if (typeof actions.copyText === 'function') {
                actions.copyText(params.linkURL);
            }
        },
    }];

    if (typeof actions.canOpenExternal === 'function' &&
        typeof actions.openExternal === 'function' &&
        actions.canOpenExternal(params.linkURL)
    ) {
        items.push({
            label: 'Open Link in Browser',
            click: () => actions.openExternal(params.linkURL),
        });
    }

    return items;
}

function buildMediaItems(params, actions) {
    const mediaTypes = ['image', 'audio', 'video'];
    if (!params.srcURL || mediaTypes.indexOf(params.mediaType) === -1) {
        return [];
    }

    const isImage = params.mediaType === 'image';
    const items = [{
        label: isImage ? 'Copy Image Address' : 'Copy Media Address',
        click: () => {
            if (typeof actions.copyText === 'function') {
                actions.copyText(params.srcURL);
            }
        },
    }];

    if (isImage && typeof actions.copyImage === 'function') {
        items.push({
            label: 'Copy Image',
            click: () => actions.copyImage(),
        });
    }

    return items;
}

function buildContextMenuTemplate(params = {}, actions = {}) {
    if (params.isEditable) {
        return buildEditableContextMenuTemplate(params, actions);
    }

    const groups = [
        buildLinkItems(params, actions),
        buildMediaItems(params, actions),
        params.selectionText ? [{ role: 'copy' }] : [],
    ].filter((group) => group.length);

    if (!groups.length) {
        return [];
    }

    const template = [];
    groups.forEach((group, index) => {
        if (index) {
            template.push({ type: 'separator' });
        }
        template.push(...group);
    });

    template.push({ type: 'separator' }, { role: 'selectAll' });

    return template;
}

module.exports = {
    buildContextMenuTemplate,
    buildEditableContextMenuTemplate,
};
