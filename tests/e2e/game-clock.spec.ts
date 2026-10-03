import { expect, test } from '@playwright/test';
import {
  advanceGameTime,
  readGameState,
  seedGameOptions,
  seedProfile,
  startMatch,
  waitForGameElapsed,
} from './helpers';

test.describe('deterministic game instrumentation', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
    await page.goto('/?seed=12345');
    await startMatch(page);
  });

  test('reads a seeded initial state and advances only when requested', async ({ page }) => {
    const initial = await readGameState(page);
    expect(initial.seed).toBe(12345);
    expect(initial.elapsedSeconds).toBe(0);

    await page.waitForTimeout(300);
    expect((await readGameState(page)).elapsedSeconds).toBe(0);

    await page.keyboard.down('w');
    await advanceGameTime(page, 1_000);
    await waitForGameElapsed(page, 1);
    await page.keyboard.up('w');

    const advanced = await readGameState(page);
    expect(advanced.elapsedSeconds).toBeGreaterThanOrEqual(1);
    expect(advanced.player.x).not.toBe(initial.player.x);
    expect(advanced.player.y).toBe(initial.player.y);
  });

  test('real firing input creates projectiles as the controlled clock advances', async ({ page }) => {
    await page.keyboard.down('Space');
    await advanceGameTime(page, 250);
    await waitForGameElapsed(page, 0.25);
    await page.keyboard.up('Space');

    expect((await readGameState(page)).projectileCount).toBeGreaterThan(0);
  });

  test('pause freezes controlled time and discards time queued during pause', async ({ page }) => {
    await advanceGameTime(page, 1_000);
    await waitForGameElapsed(page, 1);
    await page.keyboard.press('p');

    const pauseDialog = page.getByRole('dialog', { name: 'Battle paused' });
    await expect(pauseDialog).toBeVisible();
    const elapsedWhenPaused = (await readGameState(page)).elapsedSeconds;

    await advanceGameTime(page, 5_000);
    await page.waitForTimeout(200);
    expect((await readGameState(page)).elapsedSeconds).toBe(elapsedWhenPaused);

    await pauseDialog.getByRole('button', { name: 'Resume' }).click();
    await advanceGameTime(page, 500);
    await waitForGameElapsed(page, elapsedWhenPaused + 0.5);
    const resumed = await readGameState(page);
    expect(resumed.elapsedSeconds).toBeLessThan(elapsedWhenPaused + 1);
  });
});

test.describe('match completion', () => {
  test('finishes by timeout at the configured minimum duration', async ({ page }) => {
    test.setTimeout(90_000);
    await seedProfile(page);
    await seedGameOptions(page, { matchDurationSeconds: 60, enemySpawnSeconds: 15 });
    await page.goto('/?seed=12345');
    await startMatch(page);

    await page.keyboard.down('w');
    await page.keyboard.down('Space');
    await page.keyboard.down('k');
    await page.keyboard.down('l');
    let outcome: 'timeout' | 'destroyed' | null = null;
    for (let elapsed = 1; elapsed <= 60; elapsed++) {
      const state = await readGameState(page);
      if (state.phase !== 'running') {
        outcome = state.outcome;
        break;
      }
      const target = state.enemies
        .slice()
        .sort(
          (left, right) =>
            Math.hypot(left.x - state.player.x, left.y - state.player.y) -
            Math.hypot(right.x - state.player.x, right.y - state.player.y),
        )[0];
      const desired = target
        ? Math.atan2(target.y - state.player.y, target.x - state.player.x)
        : null;
      const difference =
        desired === null
          ? 0
          : Math.atan2(
              Math.sin(desired - state.player.rotation),
              Math.cos(desired - state.player.rotation),
            );
      const duration = Math.min(Math.abs(difference) / (Math.PI * 0.85), 0.35);
      if (duration > 0.02) {
        const turnKey = difference > 0 ? 'd' : 'a';
        await page.keyboard.down(turnKey);
        await advanceGameTime(page, duration * 1_000);
        await page.keyboard.up(turnKey);
      }
      await advanceGameTime(page, (1 - duration) * 1_000);
      let current = await readGameState(page);
      let extraClockTicks = 0;
      while (
        current.phase === 'running' &&
        current.outcome === null &&
        current.elapsedSeconds + 1e-6 < elapsed &&
        extraClockTicks < 5
      ) {
        await advanceGameTime(page, 50);
        await page.waitForTimeout(50);
        current = await readGameState(page);
        extraClockTicks++;
      }
      expect(
        current.phase !== 'running' ||
          current.outcome !== null ||
          current.elapsedSeconds + 1e-6 >= elapsed,
      ).toBe(true);
      const completed = page.getByRole('heading', { name: 'Battle complete' });
      const sunk = page.getByRole('heading', { name: 'Ship sunk' });
      if (await completed.isVisible() || await sunk.isVisible()) {
        outcome = await completed.isVisible() ? 'timeout' : 'destroyed';
        break;
      }
      if (current.phase === 'ending' || current.outcome !== null) {
        outcome = current.outcome;
        break;
      }
    }
    expect(outcome).toBe('timeout');
    const resultHeading = page.getByRole('heading', { name: 'Battle complete' });
    if (!(await resultHeading.isVisible())) await advanceGameTime(page, 2_000);
    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expect(page.getByText(/Time up/)).toBeVisible();
  });

  test('finishes by sinking when chasers repeatedly reach an idle player', async ({ page }) => {
    await seedProfile(page);
    await seedGameOptions(page, { matchDurationSeconds: 60, enemySpawnSeconds: 1 });
    await page.goto('/?seed=7002');
    await startMatch(page);
    await advanceGameTime(page, 20_000);
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByText('Ship sunk', { exact: true })).toBeVisible();
  });
});
