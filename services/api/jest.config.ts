// import type { Config } from 'jest'

// const config: Config = {
//   preset: 'ts-jest',
//   testEnvironment: 'node',
//   roots: ['<rootDir>/src'],
//   testMatch: ['**/__tests__/**/*.test.ts'],
//   clearMocks: true,
//   // transform: {
//   //   '^.+\\.tsx?$': ['ts-jest', {
//   //     // isolatedModules: true,   // ← fixes the TS151002 warning
//   //   }],
//   // },
// }

// export default config




import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
}

export default config