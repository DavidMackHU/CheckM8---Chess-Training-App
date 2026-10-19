import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, TEST_API_PORT, TEST_CLIENT_PORT } from './e2e/ports.ts'

/**
 * End-to-end tests. They drive the real app in a browser against the local
 * database, so start the database first:  npm run db:up && npm run db:push && npm run db:seed
 * Then:  npm run test:e2e
 *
 * Every test creates its own users (named pw_...) and courses, and
 * e2e/global-teardown.ts deletes them afterwards.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 950 },
    // Day-based numbers (streak, heatmap) follow the browser's time zone; pin it so dates in tests are predictable.
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'chromium',
      // Set PW_CHANNEL=msedge (or chrome) to use an installed browser instead of the downloaded one.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 950 }, channel: process.env.PW_CHANNEL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      // Goes through the client's proxy, so it only answers once both servers are up.
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // The tests sign up many accounts quickly; lift the sign-up rate limit for this run.
        AUTH_RATE_LIMIT: '100000',
        // Own ports, so a dev server you already have running is never mistaken for the test one.
        PORT: String(TEST_API_PORT),
        CLIENT_PORT: String(TEST_CLIENT_PORT),
        // Sign-in is pointed at e2e/fake-auth.mjs, which plays Firebase. None of these are real.
        FIREBASE_PROJECT_ID: 'e2e-project',
        FIREBASE_JWKS_URL: 'http://localhost:5999/jwks',
        VITE_FIREBASE_API_KEY: 'e2e-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
        VITE_FIREBASE_PROJECT_ID: 'e2e-project',
      },
    },
    {
      command: 'node e2e/fake-auth.mjs',
      url: 'http://localhost:5999',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
