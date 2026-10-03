import { expect, test, type Page } from '@playwright/test';
import {
  advanceGameTime,
  leaveMatch,
  readGameState,
  seedGameOptions,
  seedProfile,
  startMatch,
} from './helpers';

declare global {
  interface Window {
    __frameDurations?: number[];
    __lastFrameTime?: number;
  }
}

test('measures active-arena frames and heap retention across five cleanup cycles', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Performance baseline is recorded on desktop.');
  await seedProfile(page);
  await seedGameOptions(page, { matchDurationSeconds: 180, enemySpawnSeconds: 15 });
  await page.addInitScript(() => {
    window.__frameDurations = [];
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      requestFrame((timestamp) => {
        if (window.__lastFrameTime !== undefined) {
          window.__frameDurations?.push(timestamp - window.__lastFrameTime);
        }
        window.__lastFrameTime = timestamp;
        callback(timestamp);
      });
  });
  await page.goto('/?seed=146');
  await startMatch(page);
  await expect(page.locator('[data-testid="arena"] canvas')).toBeVisible();
  await advanceGameTime(page, 5_000);
  const gameLoad = await readGameState(page);
  expect(gameLoad.phase).toBe('running');
  await page.evaluate(() => {
    window.__frameDurations = [];
    window.__lastFrameTime = undefined;
  });
  await page.waitForFunction(() => (window.__frameDurations?.length ?? 0) >= 180, null, {
    timeout: 15_000,
  });

  const frameMetrics = await page.evaluate(() => {
    const samples = [...(window.__frameDurations ?? []).slice(-180)].sort((a, b) => a - b);
    if (samples.length === 0) throw new Error('No animation frame samples were collected.');
    const meanFrameTimeMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return {
      sampleCount: samples.length,
      meanFrameTimeMs,
      p95FrameTimeMs: samples[Math.ceil(samples.length * 0.95) - 1] ?? meanFrameTimeMs,
      meanFps: 1_000 / meanFrameTimeMs,
    };
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  await expect(page.getByRole('region', { name: 'Battle' })).toBeVisible();
  await leaveMatch(page);
  await expect(page.locator('canvas')).toHaveCount(0);
  await cdp.send('HeapProfiler.collectGarbage');
  const heapBeforeCycles = await readHeapBytes(page);

  for (let cycle = 0; cycle < 5; cycle++) {
    await page.goto('/');
    await startMatch(page);
    await expect(page.locator('[data-testid="arena"] canvas')).toHaveCount(1);
    await leaveMatch(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await cdp.send('HeapProfiler.collectGarbage');
  }

  const heapAfterCycles = await readHeapBytes(page);
  const metrics = {
    measuredAt: new Date().toISOString(),
    browser: await page.evaluate(() => navigator.userAgent),
    viewport: page.viewportSize(),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
    simulatedSecondsAtFrameSample: gameLoad.elapsedSeconds,
    enemiesAtFrameSample: gameLoad.enemies.length,
    projectilesAtFrameSample: gameLoad.projectileCount,
    frameMetrics,
    heapBeforeCyclesBytes: heapBeforeCycles,
    heapAfterFiveCyclesBytes: heapAfterCycles,
    heapDeltaBytes:
      heapBeforeCycles === null || heapAfterCycles === null
        ? null
        : heapAfterCycles - heapBeforeCycles,
    cleanupCycles: 5,
    canvasesAfterCleanup: await page.locator('canvas').count(),
  };
  console.log(`PERFORMANCE_PROFILE=${JSON.stringify(metrics)}`);
  await testInfo.attach('performance-profile.json', {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: 'application/json',
  });
});

async function readHeapBytes(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return memory.memory?.usedJSHeapSize ?? null;
  });
}
