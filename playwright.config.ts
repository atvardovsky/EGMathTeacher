import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const port = Number(process.env.E2E_PORT ?? 5138);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const configuredChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const localChromium =
  configuredChromium ?? (existsSync('/snap/bin/chromium') ? '/snap/bin/chromium' : undefined);
const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  ...(localChromium ? { executablePath: localChromium } : {}),
};

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `VITE_DISABLE_HTTPS=true npm run dev --workspace @egmathteacher/web -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
