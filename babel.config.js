module.exports = {
    presets: [
        [
            '@vue/cli-plugin-babel/preset',
            {
                useBuiltIns: 'usage',
                modules: 'commonjs',
                corejs: { version: 3, proposals: true },
            },
        ],
    ],
    plugins: [['@babel/plugin-transform-runtime', { useESModules: true }]],
    env: {
        test: {
            plugins: [
                [
                    'istanbul',
                    {
                        exclude: ['**/*.spec.js'],
                    },
                ],
            ],
        },
    },
};
