/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
   modulePaths:     ['<rootDir>/src'],
  clearMocks: false,
    moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',  // ← maps @/ to src/
  },
}
