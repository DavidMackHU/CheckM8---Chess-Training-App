import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 950 },
  },
  projects: [
    {
      name: 'chromium',
      // Set PW_CHANNEL=msedge (or chrome) to use an installed browser instead of the downloaded one.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 950 }, channel: process.env.PW_CHANNEL },
    },
  ],
  webServer: {
    command: 'npm run dev',
    // Goes through the client's proxy, so it only answers once both servers are up.
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The tests sign up many accounts quickly; lift the sign-up rate limit for this run.
    env: { AUTH_RATE_LIMIT: '100000' },
  },
})
