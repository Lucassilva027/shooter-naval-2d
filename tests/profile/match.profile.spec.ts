import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '../e2e/fixtures';
import {
  leaveMatch,
  playButton,
  readGameState,
  seedGameOptions,
  seedProfile,
  setPlayerHealth,
  startMatch,
} from '../e2e/helpers';

const MATCH_SECONDS = 180;
const CLEANUP_CYCLES = 5;
const CYCLE_PLAY_MS = 5_000;
const RESULT_FILES: Record<string, string> = {
  'desktop-chromium': 'docs/perf/performance-profile.json',
  'mobile-emulated': 'docs/perf/performance-profile-mobile-emulated.json',
};

interface EntitySample {
  readonly atSeconds: number;
  readonly enemies: number;
  readonly projectiles: number;
  readonly sceneShips: number;
  readonly sceneProjectiles: number;
  readonly sceneEffects: number;
  readonly heapBytes: number | null;
}

declare global {
  interface Window {
    __profile?: {
      frames: number[];
      last: number | undefined;
      recording: boolean;
      samples: EntitySample[];
      sampler: number | undefined;
    };
  }
}

const usedHeap = () =>
  (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
  null;

test('three-minute real-clock match, then five cleanup cycles', async ({ page }, testInfo) => {
  await seedProfile(page, 'Profiler', 'profile-player');
  await seedGameOptions(page, { matchDurationSeconds: MATCH_SECONDS, enemySpawnSeconds: 4 });
  await page.addInitScript(() => {
    const profile = {
      frames: [] as number[],
      last: undefined as number | undefined,
      recording: false,
      samples: [],
      sampler: undefined,
    };
    window.__profile = profile;
    const tick = (timestamp: number) => {
      if (profile.recording && profile.last !== undefined)
        profile.frames.push(timestamp - profile.last);
      profile.last = timestamp;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.goto('/?seed=146&scenario=normal');
  await startMatch(page);
  await expect(page.locator('[data-testid="arena"] canvas')).toHaveCount(1);
  // Keeps the ship afloat for the full duration so the arena reaches its sustained load.
  await setPlayerHealth(page, 100_000);

  await page.evaluate((heapReader) => {
    const readHeap = new Function(`return (${heapReader})()`) as () => number | null;
    const profile = window.__profile;
    if (!profile) throw new Error('The frame recorder was not installed.');
    profile.frames = [];
    profile.last = undefined;
    profile.recording = true;
    profile.sampler = window.setInterval(() => {
      const state = window.__PIRATE_BATTLE_TEST__?.readState();
      if (!state) return;
      profile.samples.push({
        atSeconds: state.elapsedSeconds,
        enemies: state.enemies.length,
        projectiles: state.projectileCount,
        sceneShips: state.sceneCounts.ships,
        sceneProjectiles: state.sceneCounts.projectiles,
        sceneEffects: state.sceneCounts.effects,
        heapBytes: readHeap(),
      });
    }, 1_000);
  }, usedHeap.toString());

  // Sails in wide circles and keeps all cannons firing, so projectiles, hits and
  // effects stay on screen for the whole match.
  const heldKeys = ['KeyW', 'Space', 'KeyK', 'KeyL'];
  const startedAt = Date.now();
  for (const key of heldKeys) await page.keyboard.down(key);
  for (let step = 0; (await readGameState(page)).outcome === null; step++) {
    expect(Date.now() - startedAt).toBeLessThan((MATCH_SECONDS + 30) * 1_000);
    const turnKey = Math.floor(step / 8) % 2 === 0 ? 'KeyD' : 'KeyA';
    await page.keyboard.down(turnKey);
    await page.waitForTimeout(700);
    await page.keyboard.up(turnKey);
    await page.waitForTimeout(300);
  }
  const wallClockSeconds = (Date.now() - startedAt) / 1_000;
  for (const key of heldKeys) await page.keyboard.up(key);

  const match = await page.evaluate(() => {
    const profile = window.__profile;
    if (!profile) throw new Error('The frame recorder was not installed.');
    profile.recording = false;
    window.clearInterval(profile.sampler);
    const state = window.__PIRATE_BATTLE_TEST__?.readState() ?? null;
    return { frames: profile.frames, samples: profile.samples, state };
  });
  const finalState = match.state;
  if (!finalState) throw new Error('The match state was unavailable at the end of the match.');
  expect(finalState.outcome).toBe('timeout');
  await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  const collectHeap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return page.evaluate(
      (heapReader) => (new Function(`return (${heapReader})()`) as () => number | null)(),
      usedHeap.toString(),
    );
  };
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(playButton(page)).toBeVisible();
  await cdp.send('HeapProfiler.enable');
  const heapAfterMatch = await collectHeap();

  const cycleHeaps: (number | null)[] = [];
  for (let cycle = 0; cycle < CLEANUP_CYCLES; cycle++) {
    await startMatch(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.waitForTimeout(CYCLE_PLAY_MS);
    await leaveMatch(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    cycleHeaps.push(await collectHeap());
  }

  const frames = [...match.frames].sort((a, b) => a - b);
  const percentile = (p: number) =>
    frames[Math.min(frames.length - 1, Math.ceil(frames.length * p) - 1)] ?? 0;
  const totalMs = match.frames.reduce((sum, value) => sum + value, 0);
  const peak = (key: keyof Omit<EntitySample, 'heapBytes'>) =>
    Math.max(...match.samples.map((sample) => sample[key]));
  const mean = (key: keyof Omit<EntitySample, 'heapBytes'>) =>
    match.samples.reduce((sum, sample) => sum + sample[key], 0) / match.samples.length;
  const heaps = match.samples.flatMap((sample) =>
    sample.heapBytes === null ? [] : [sample.heapBytes],
  );
  const lastHeap = cycleHeaps.at(-1) ?? null;

  const report = {
    measuredAt: new Date().toISOString(),
    project: testInfo.project.name,
    deviceEmulation: testInfo.project.name === 'mobile-emulated',
    build: 'vite build --mode profile (production bundle, real game clock)',
    browser: await page.evaluate(() => navigator.userAgent),
    viewport: page.viewportSize(),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
    match: {
      durationSeconds: finalState.elapsedSeconds,
      wallClockSeconds,
      score: finalState.score,
      shotsFired: finalState.stats.shotsFired,
      spawns: finalState.stats.spawns.length,
    },
    frames: {
      count: frames.length,
      averageFps: frames.length / (totalMs / 1_000),
      meanMs: totalMs / frames.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      worstMs: frames.at(-1),
      over33MsCount: frames.filter((value) => value > 33.4).length,
      over50MsCount: frames.filter((value) => value > 50).length,
    },
    entities: {
      samples: match.samples.length,
      peakEnemies: peak('enemies'),
      meanEnemies: mean('enemies'),
      peakProjectiles: peak('projectiles'),
      meanProjectiles: mean('projectiles'),
      peakSceneShips: peak('sceneShips'),
      peakSceneProjectiles: peak('sceneProjectiles'),
      peakSceneEffects: peak('sceneEffects'),
      simulationPeakEnemies: finalState.stats.peakEnemies,
      simulationPeakProjectiles: finalState.stats.peakProjectiles,
    },
    memory: {
      heapMinDuringMatchBytes: heaps.length ? Math.min(...heaps) : null,
      heapMaxDuringMatchBytes: heaps.length ? Math.max(...heaps) : null,
      heapAfterMatchGcBytes: heapAfterMatch,
      heapAfterEachCycleGcBytes: cycleHeaps,
      heapDeltaAcrossCyclesBytes:
        heapAfterMatch === null || lastHeap === null ? null : lastHeap - heapAfterMatch,
      canvasesAfterCleanup: await page.locator('canvas').count(),
    },
  };

  console.log(`PERFORMANCE_PROFILE=${JSON.stringify(report)}`);
  mkdirSync('docs/perf', { recursive: true });
  const resultFile = RESULT_FILES[testInfo.project.name];
  if (!resultFile) throw new Error(`No performance report path for project "${testInfo.project.name}".`);
  writeFileSync(resultFile, `${JSON.stringify(report, null, 2)}\n`);

  expect(report.memory.canvasesAfterCleanup).toBe(0);
  expect(report.entities.peakSceneShips).toBeLessThanOrEqual(1 + finalState.stats.peakEnemies);
});
