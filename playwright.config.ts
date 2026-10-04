import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const isCI = Boolean(process.env.CI);

/** Headless Chromium falls back to software WebGL, which is several times slower. */
const gpuArgs =
  process.platform === 'win32'
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : [];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  /** WebGL-heavy pages slow each other down when too many run at once. */
  workers: 2,
  timeout: 60_000,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: gpuArgs },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7 landscape'] },
    },
  ],
  webServer: {
    command: `npx vite --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
