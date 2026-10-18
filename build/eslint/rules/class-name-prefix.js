module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'html class names must start with `u-` or `kiwi-`',
        },
        schema: [],
    },
    create: function (context) {
        let parserServices = context.sourceCode.parserServices;
        // The rule only inspects Vue template attributes, so it has nothing to
        // do for plain JS files where the template visitor is unavailable.
        if (!parserServices || typeof parserServices.defineTemplateBodyVisitor !== 'function') {
            return {};
        }
        return parserServices.defineTemplateBodyVisitor({
            "VAttribute[key.name='class']"(node) {
                let classes = node.value.value.split(' ');
                classes.forEach((c) => {
                    // Ignore empty and fontawesome classes
                    if (!c || c === 'fa' || c.startsWith('fa-')) {
                        return;
                    }
                    if (!c.startsWith('kiwi-') &&
                        !c.startsWith('u-') &&
                        // Special exception for google recaptcha -  welcome screen.
                        !c.startsWith('g-') &&
                        !c.startsWith('irc-fg-') &&
                        !c.startsWith('irc-bg-')
                    ) {
                        context.report({
                            node: node,
                            message: 'Expected class name to start with `kiwi-` or `u-` ({{ class }})',
                            data: {
                                class: c,
                            },
                        });
                    }
                });
            },
        });
    },
};
