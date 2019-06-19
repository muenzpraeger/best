module.exports = {
    rootDir: '../..',
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            // The tsconfig location has to be specified otherwise, it will not transform the javascript
            // files.
            tsConfig: '<rootDir>/tsconfig.settings.json',

            // By default ts-jest reports typescript compilation errors. Let's disable for now diagnostic
            // reporting since some of the packages doesn't pass the typescript compilation.
            diagnostics: false,
        },
    },

    testMatch: ['<rootDir>/**/__tests__/*.spec.ts'],

    // Global mono-repo code coverage threshold.
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 85,
            lines: 85,
        },
    },
};