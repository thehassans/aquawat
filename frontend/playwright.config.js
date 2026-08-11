import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
  projects: [
    // Optional: writes e2e/.auth/user.json when E2E credentials work.
    // Authenticated specs log in themselves and skip if login fails.
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /auth\.setup\.js/,
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
      testIgnore: /auth\.setup\.js/,
    },
  ],
  metadata: { apiUrl: API_URL },
})
