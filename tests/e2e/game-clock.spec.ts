import { expect, test } from './fixtures';
import {
  advanceGameTime,
  readGameState,
  seedGameOptions,
  seedProfile,
  setPlayerHealth,
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

    await setPlayerHealth(page, 10_000);
    await advanceGameTime(page, 59_000);
    await waitForGameElapsed(page, 59);
    await advanceGameTime(page, 1_000);
    await waitForGameElapsed(page, 60);
    expect((await readGameState(page)).outcome).toBe('timeout');

    await advanceGameTime(page, 2_000);
    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expect(page.getByText(/Time up/)).toBeVisible();
    await expect(page.getByTestId('submission-status')).toHaveText('Result submitted.');
  });

  test('finishes by sinking when chasers repeatedly reach an idle player', async ({ page }) => {
    await seedProfile(page);
    await seedGameOptions(page, { matchDurationSeconds: 60, enemySpawnSeconds: 1 });
    await page.goto('/?seed=7002');
    await startMatch(page);
    await advanceGameTime(page, 20_000);
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByText('Ship sunk', { exact: true })).toBeVisible();
    await expect(page.getByTestId('submission-status')).toHaveText('Result submitted.');
  });
});
