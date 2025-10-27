/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/typescript'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.js$'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        target: 'ES2015',
        module: 'commonjs',
        esModuleInterop: true,
        skipLibCheck: true,
      }
    }]
  },
  collectCoverageFrom: [
    'typescript/src/**/*.{ts,tsx}',
    '!typescript/src/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
