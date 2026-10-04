import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

/** Headless Chromium falls back to software WebGL, which is several times slower. */
const gpuArgs =
  process.platform === 'win32'
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : [];

/**
 * Real-clock performance profile against a production build. The `profile` mode keeps
 * the read-only test hooks (state, entity counts) but runs the normal game clock.
 */
export default defineConfig({
  testDir: './tests/profile',
  workers: 1,
  timeout: 8 * 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: [...gpuArgs, '--enable-precise-memory-info'] },
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build --mode profile --outDir dist-profile && npx vite preview --outDir dist-profile --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
