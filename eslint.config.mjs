import { createRequire } from 'node:module';

import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import neostandard from 'neostandard';
import pluginVue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';

const require = createRequire(import.meta.url);
const classNamesPrefix = require('./build/eslint/rules/class-name-prefix.js');

const isProduction = process.env.NODE_ENV === 'production';

// Every file the project lints. Keep in sync with the `lint:eslint` script.
const lintedFiles = ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.vue'];

export default [
    {
        ignores: [
            'build/*.js',
            'config/*.js',
            'tests/unit/coverage/',
        ],
    },

    // Base ruleset (the maintained successor to `standard`)
    ...neostandard({
        env: ['browser'],
        files: ['**/*.vue'],
        semi: true,
    }),

    ...pluginVue.configs['flat/vue2-recommended'],
    ...vueA11y.configs['flat/recommended'],

    importX.configs['flat/recommended'],

    // The `<script>` blocks of our SFCs are parsed with babel rather than espree
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: {
                parser: '@babel/eslint-parser',
                sourceType: 'module',
            },
        },
    },

    {
        files: lintedFiles,
        linterOptions: {
            // A dead `eslint-disable` comment is a lint error; delete the
            // directive (and its now-wrong comment) when the violation goes away.
            reportUnusedDisableDirectives: 'error',
        },
        languageOptions: {
            sourceType: 'module',
        },
        plugins: {
            rulesdir: {
                rules: {
                    'class-name-prefix': classNamesPrefix,
                },
            },
        },
        rules: {
            // console.warn/error are fine in production; only console.log is banned
            'no-console': isProduction ? ['error', { allow: ['warn', 'error'] }] : 'off',
            'no-debugger': isProduction ? 'error' : 'off',
            'rulesdir/class-name-prefix': 'warn',

            'class-methods-use-this': 'off',
            'max-classes-per-file': 'off',
            'no-continue': 'off',
            'no-control-regex': 'off',
            'no-else-return': 'off',
            'no-multi-assign': 'off',
            'no-param-reassign': ['error', { props: false }],
            'no-plusplus': 'off',
            'no-prototype-builtins': 'off',
            'object-shorthand': 'off',
            'prefer-const': 'off',
            'prefer-destructuring': 'off',
            'prefer-object-spread': 'off',
            'prefer-promise-reject-errors': 'off',
            'prefer-template': 'off',

            'import-x/extensions': 'off',
            'import-x/no-cycle': 'off',
            'import-x/no-extraneous-dependencies': 'off',
            // airbnb-base set these, but eslint-config-standard (which came
            // last) silenced them; `Vue.set` / `i18next.t` style access is fine
            // in this Vue 2 codebase.
            'import-x/no-named-as-default': 'off',
            'import-x/no-named-as-default-member': 'off',
            'import-x/no-unresolved': 'off',
            'import-x/prefer-default-export': 'off',

            '@stylistic/comma-dangle': ['error', {
                arrays: 'always-multiline',
                objects: 'always-multiline',
                imports: 'never',
                exports: 'never',
                functions: 'ignore',
            }],
            // Core `max-len` was disabled by @vue/eslint-config-airbnb; only the
            // vue template variant applies, so match that behaviour.
            '@stylistic/max-len': 'off',
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 0,
                // @stylistic added this check; core `indent` never had it, so
                // multi-assignments like `a.b = a.c = function` used to pass.
                assignmentOperator: 'off',
            }],
            '@stylistic/operator-linebreak': 'off',
            '@stylistic/quote-props': ['error', 'consistent-as-needed'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'never',
                catch: 'always',
            }],

            'vue/component-definition-name-casing': 'off',
            // Allow self-closing on void elements such as <img /> (as airbnb did)
            'vue/html-self-closing': ['error', {
                html: { void: 'any' },
            }],
            'vue/html-indent': ['error', 4],
            'vue/max-attributes-per-line': 'off',
            'vue/max-len': ['error', 100, 4, {
                ignoreUrls: true,
                ignoreComments: false,
                ignoreRegExpLiterals: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreHTMLAttributeValues: true,
                ignoreHTMLTextContents: false,
            }],
            'vue/multi-word-component-names': 'off',
            'vue/multiline-html-element-content-newline': 'off',
            'vue/no-mutating-props': 'off',
            'vue/no-unused-components': 'off',
            'vue/no-v-html': 'off',
            'vue/one-component-per-file': 'off',
            'vue/require-default-prop': 'off',
            'vue/require-prop-types': 'off',
            'vue/singleline-html-element-content-newline': 'off',

            'vuejs-accessibility/anchor-has-content': 'off',
            'vuejs-accessibility/click-events-have-key-events': 'off',
            'vuejs-accessibility/form-control-has-label': 'off',
            'vuejs-accessibility/iframe-has-title': 'off',
            'vuejs-accessibility/interactive-supports-focus': 'off',
            'vuejs-accessibility/label-has-for': 'off',
            'vuejs-accessibility/mouse-events-have-key-events': 'off',
            'vuejs-accessibility/no-static-element-interactions': 'off',
        },
    },

    // Rules from airbnb-base that neostandard does not enable. Each one was an
    // error under the old `@vue/airbnb` config, so this restores that coverage
    // (except for the style rules in the second half, kept for formatting
    // parity). All of them pass cleanly on the current tree.
    {
        files: lintedFiles,
        rules: {
            // Correctness / bug-catching
            'no-shadow': 'error',
            'no-bitwise': 'error',
            'no-nested-ternary': 'error',
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ForInStatement',
                    message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
                },
                {
                    selector: 'ForOfStatement',
                    message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
                },
                {
                    selector: 'LabeledStatement',
                    message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                },
                {
                    selector: 'WithStatement',
                    message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
                },
            ],
            'consistent-return': 'error',
            'default-case': ['error', { commentPattern: '^no default$' }],
            'default-param-last': 'error',
            'guard-for-in': 'error',
            'radix': 'error',
            'no-await-in-loop': 'error',
            'no-loop-func': 'error',
            'no-promise-executor-return': 'error',
            'getter-return': ['error', { allowImplicit: true }],
            'no-setter-return': 'error',
            'no-constructor-return': 'error',
            'no-dupe-else-if': 'error',
            'for-direction': 'error',
            'n/global-require': 'error',
            'n/no-path-concat': 'error',
            'n/no-new-require': 'error',
            'no-script-url': 'error',
            'no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
            'no-lonely-if': 'error',
            'no-array-constructor': 'error',
            'no-object-constructor': 'error',
            'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
            'no-useless-concat': 'error',
            'no-underscore-dangle': [
                'error',
                {
                    allow: [],
                    allowAfterThis: false,
                    allowAfterSuper: false,
                    enforceInMethodNames: true,
                },
            ],
            'prefer-exponentiation-operator': 'error',
            'prefer-numeric-literals': 'error',
            'prefer-rest-params': 'error',
            'prefer-spread': 'error',
            'grouped-accessor-pairs': 'error',
            'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
            'no-restricted-globals': [
                'error',
                {
                    name: 'isFinite',
                    message: 'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
                },
                {
                    name: 'isNaN',
                    message: 'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
                },
            ],
            'no-restricted-properties': [
                'error',
                {
                    object: 'arguments',
                    property: 'callee',
                    message: 'arguments.callee is deprecated',
                },
                {
                    object: 'global',
                    property: 'isFinite',
                    message: 'Please use Number.isFinite instead',
                },
                {
                    object: 'self',
                    property: 'isFinite',
                    message: 'Please use Number.isFinite instead',
                },
                {
                    object: 'window',
                    property: 'isFinite',
                    message: 'Please use Number.isFinite instead',
                },
                { object: 'global', property: 'isNaN', message: 'Please use Number.isNaN instead' },
                { object: 'self', property: 'isNaN', message: 'Please use Number.isNaN instead' },
                { object: 'window', property: 'isNaN', message: 'Please use Number.isNaN instead' },
                {
                    property: '__defineGetter__',
                    message: 'Please use Object.defineProperty instead.',
                },
                {
                    property: '__defineSetter__',
                    message: 'Please use Object.defineProperty instead.',
                },
                {
                    object: 'Math',
                    property: 'pow',
                    message: 'Use the exponentiation operator (**) instead.',
                },
            ],
            'no-restricted-exports': ['error', { restrictedNamedExports: ['default', 'then'] }],
            'import-x/order': ['error', { groups: [['builtin', 'external', 'internal']] }],

            // Formatting parity with the old airbnb ruleset
            '@stylistic/arrow-parens': ['error', 'always'],
            'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
            '@stylistic/no-confusing-arrow': ['error', { allowParens: true }],
            'prefer-arrow-callback': ['error', { allowNamedFunctions: false, allowUnboundThis: true }],
            '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
            '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
            '@stylistic/newline-per-chained-call': ['error', { ignoreChainWithDepth: 4 }],
            '@stylistic/nonblock-statement-body-position': ['error', 'beside', { overrides: {} }],
            '@stylistic/one-var-declaration-per-line': ['error', 'always'],
            'operator-assignment': ['error', 'always'],
            '@stylistic/semi-style': ['error', 'last'],
            '@stylistic/switch-colon-spacing': ['error', { after: true, before: false }],
            '@stylistic/linebreak-style': ['error', 'unix'],
            'strict': ['error', 'never'],
            'vars-on-top': 'error',
        },
    },

    {
        files: ['**/__tests__/*.{js,ts}', '**/tests/unit/**/*.spec.{js,ts}'],
        languageOptions: {
            globals: { ...globals.jest },
        },
    },
];
