import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: true,
  reporter: 'list',
  workers: 1,
  use: {
    baseURL,
    colorScheme: 'light',
    timezoneId: 'America/Guayaquil',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
