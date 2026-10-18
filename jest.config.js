module.exports = {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'jsx', 'json', 'vue'],
    transform: {
        // Process *.vue single file components with vue-jest
        '^.+\\.vue$': '@vue/vue2-jest',
        // Everything else goes through babel
        '^.+\\.jsx?$': 'babel-jest',
    },
    // Support the same @ -> src alias mapping as the source code
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testMatch: [
        '**/tests/unit/**/*.spec.[jt]s?(x)',
        '**/__tests__/*.[jt]s?(x)',
    ],
    collectCoverage: true,
    // Only plain JS/JSX can be instrumented; istanbul cannot process the .vue
    // SFCs in this setup, so they are excluded (the glob is relative to the
    // project root, without a leading slash so it actually matches).
    collectCoverageFrom: ['src/**/*.{js,jsx}'],
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
    coverageDirectory: 'tests/coverage/',
    coverageReporters: ['html', 'text-summary'],
    setupFiles: ['<rootDir>/tests/unit/setup.js'],
};
