import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // `next dev` compiles each route on first visit, which can take several seconds.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run dev:e2e',
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
