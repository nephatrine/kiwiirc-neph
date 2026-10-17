module.exports = {
    preset: '@vue/cli-plugin-unit-jest',
    collectCoverage: true,
    // Only plain JS/JSX can be instrumented; istanbul cannot process the .vue
    // SFCs in this setup, so they are excluded (the glob is relative to the
    // project root, without a leading slash so it actually matches).
    collectCoverageFrom: ['src/**/*.{js,jsx}'],
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
    coverageDirectory: 'tests/coverage/',
    coverageReporters: ['html', 'text-summary'],
    setupFiles: ['<rootDir>/tests/unit/setup.js'],
    transformIgnorePatterns: [
        '/node_modules/(?!(ip-regex)/)',
    ],
};
