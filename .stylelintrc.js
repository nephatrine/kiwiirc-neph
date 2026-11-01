module.exports = {
    extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
    plugins: ['@stylistic/stylelint-plugin'],
    overrides: [
        {
            files: ['**/*.html'],
            customSyntax: 'postcss-html',
        },
        {
            files: [
                'static/themes/**/*.css',
                'static/plugins/**/*.css',
                'static/plugins/**/*.html',
            ],
            rules: {
                'color-function-alias-notation': null,
                'custom-property-pattern': null,
                'declaration-no-important': null,
                'media-feature-range-notation': 'prefix',
                'no-duplicate-selectors': null,
                'selector-no-vendor-prefix': null,
            },
        },
    ],
    rules: {
        '@stylistic/indentation': 4,
        '@stylistic/string-quotes': 'single',
        'alpha-value-notation': null,
        'color-function-notation': null,
        'declaration-no-important': true,
        'no-descending-specificity': null,
        'property-no-vendor-prefix': null,
        'selector-class-pattern': null,
        'shorthand-property-no-redundant-values': null,
    },
};
