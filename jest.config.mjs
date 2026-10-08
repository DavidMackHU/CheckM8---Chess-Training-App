// Unit tests for pure logic only (no database, no browser).
// End-to-end tests live in /e2e and run with Playwright: npm run test:e2e
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/server/tests/**/*.test.ts',
    '<rootDir>/client/tests/**/*.test.ts',
    '<rootDir>/scripts/tests/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          target: 'es2022',
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  // Server code imports "./x.js" (Node's ESM rule) for files that are "./x.ts" on disk.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
}
