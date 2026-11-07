import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // GitHub's Linux runners have 4 CPUs; Playwright's default would use only 2 there.
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/Krotik/', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Krotik/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
