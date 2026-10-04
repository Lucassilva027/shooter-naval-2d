import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  aimAt,
  distance,
  holdKeys,
  playFor,
  playUntil,
  readGameState,
  seedGameOptions,
  seedProfile,
  setPlayerHealth,
  STEP_MS,
  startMatch,
  turnTo,
} from './helpers';
import type { GameTestState } from '../../src/game/testing/gameTestHooks';

/** Seed 1 uses the first island layout, whose path straight north of the spawn is open water. */
const OPEN_NORTH_SEED = 1;
/** Seed 12345 uses the third layout, with a rock straight north of the spawn. */
const ROCK_NORTH_SEED = 12345;
const NORTH = -Math.PI / 2;

async function startSeededMatch(
  page: Page,
  seed: number,
  options = { matchDurationSeconds: 120, enemySpawnSeconds: 15 },
): Promise<GameTestState> {
  await seedProfile(page);
  await seedGameOptions(page, options);
  await page.goto(`/?seed=${seed}`);
  await startMatch(page);
  return readGameState(page);
}

function hullOverlapsIslands(state: GameTestState): boolean {
  return state.playerHull.some((hull) =>
    state.islands.some((island) =>
      island.colliders.some(
        (collider) => distance(hull, collider) < hull.radius + collider.radius - 0.5,
      ),
    ),
  );
}

test.describe('player movement', () => {
  test('sails forward along the heading and turns both ways', async ({ page }) => {
    const initial = await startSeededMatch(page, OPEN_NORTH_SEED);
    expect(initial.player.rotation).toBe(0);

    const sailed = await holdKeys(page, ['w'], 1_000);
    expect(sailed.player.x).toBeGreaterThan(initial.player.x + 50);
    expect(sailed.player.y).toBeCloseTo(initial.player.y, 5);
    expect(sailed.player.speed).toBeGreaterThan(0);

    const right = await holdKeys(page, ['d'], 30 * STEP_MS);
    expect(right.player.rotation).toBeCloseTo(Math.PI * 0.85 * 0.5, 2);
    const left = await holdKeys(page, ['ArrowLeft'], 60 * STEP_MS);
    expect(left.player.rotation).toBeCloseTo(-Math.PI * 0.85 * 0.5, 2);

    const braked = await holdKeys(page, ['s'], 2_000);
    expect(braked.player.speed).toBe(0);
  });

  test('moves and fires at the same time', async ({ page }) => {
    const initial = await startSeededMatch(page, OPEN_NORTH_SEED);
    const state = await holdKeys(page, ['w', 'Space'], 500);
    expect(state.player.x).toBeGreaterThan(initial.player.x);
    expect(state.stats.shotsFired.player).toBeGreaterThan(0);
  });

  test('cannot leave the arena', async ({ page }) => {
    await startSeededMatch(page, OPEN_NORTH_SEED);
    await setPlayerHealth(page, 10_000);
    await turnTo(page, NORTH);

    const state = await holdKeys(page, ['w'], 3_000);
    for (const hull of state.playerHull) {
      expect(hull.y - hull.radius).toBeGreaterThanOrEqual(-0.5);
    }
    const top = Math.min(...state.playerHull.map((hull) => hull.y - hull.radius));
    expect(top).toBeLessThan(2);
    expect(hullOverlapsIslands(state)).toBe(false);
  });

  test('never sails through an island and takes rock damage once per impact', async ({ page }) => {
    const initial = await startSeededMatch(page, ROCK_NORTH_SEED);
    const rock = initial.islands.find((island) => island.art === 'rock');
    const rockCentre = rock?.colliders[0];
    if (!rockCentre) throw new Error('Expected a rock in this layout.');
    const facing = await turnTo(page, NORTH);
    expect(Math.abs(facing.player.x - rockCentre.x)).toBeLessThan(rockCentre.radius + 27);

    let state = facing;
    let slowedByImpact = false;
    await page.keyboard.down('w');
    for (let slice = 0; slice < 30; slice++) {
      const previousSpeed = state.player.speed;
      state = await playFor(page, 100);
      expect(hullOverlapsIslands(state)).toBe(false);
      if (state.player.speed < previousSpeed - 1) slowedByImpact = true;
    }
    await page.keyboard.up('w');

    expect(slowedByImpact).toBe(true);
    expect(state.health).toBe(90);
    expect(Math.abs(state.player.x - facing.player.x)).toBeGreaterThan(1);
  });
});

test.describe('cannons', () => {
  test('front cannon fires one forward shot per cooldown while held', async ({ page }) => {
    await startSeededMatch(page, OPEN_NORTH_SEED);

    const state = await holdKeys(page, ['Space'], 1_000);
    expect(state.stats.shotsFired.player).toBe(3);
    const shots = state.projectiles.filter((shot) => shot.faction === 'player');
    expect(shots).toHaveLength(3);
    for (const shot of shots) {
      expect(shot.vx).toBeCloseTo(420, 5);
      expect(shot.vy).toBeCloseTo(0, 5);
    }
  });

  test('broadsides fire three parallel shots per side with separate cooldowns', async ({
    page,
  }) => {
    const initial = await startSeededMatch(page, OPEN_NORTH_SEED);

    const port = await holdKeys(page, ['k'], 500);
    expect(port.stats.shotsFired.player).toBe(3);
    const portShots = port.projectiles.filter((shot) => shot.faction === 'player');
    expect(portShots).toHaveLength(3);
    for (const shot of portShots) {
      expect(shot.vx).toBeCloseTo(0, 5);
      expect(shot.vy).toBeCloseTo(-420, 5);
    }
    const xs = portShots.map((shot) => Math.round(shot.x - initial.player.x)).sort((a, b) => a - b);
    expect(xs).toEqual([-26, 0, 26]);

    const starboard = await holdKeys(page, ['l'], 100);
    expect(starboard.stats.shotsFired.player).toBe(6);
    const starboardShots = starboard.projectiles.filter((shot) => shot.vy > 0);
    expect(starboardShots).toHaveLength(3);
  });

  test('shots damage an enemy once each and a kill scores exactly one point', async ({ page }) => {
    await startSeededMatch(page, OPEN_NORTH_SEED);
    const spawned = await playUntil(page, (state) => state.enemies.length === 1);
    const chaser = spawned.enemies[0];
    expect(chaser?.kind).toBe('chaser');
    expect(chaser?.health).toBe(40);

    let state = spawned;
    const healthSeen = new Set<number>();
    for (let attempt = 0; attempt < 30 && state.enemies.length > 0; attempt++) {
      const target = state.enemies[0];
      if (!target) break;
      healthSeen.add(target.health);
      await aimAt(page, target);
      state = await holdKeys(page, ['Space'], 100);
    }

    expect(state.enemies).toHaveLength(0);
    expect([...healthSeen].every((health) => health === 40 || health === 20)).toBe(true);
    expect(state.score).toBe(1);
    expect(state.health).toBe(100);
    await expect(page.getByTestId('hud-score')).toHaveText('1');

    const later = await playFor(page, 2_000);
    expect(later.score).toBe(1);
  });
});

test.describe('enemies', () => {
  test('a Chaser closes in, rams the player and explodes without scoring', async ({ page }) => {
    const initial = await startSeededMatch(page, OPEN_NORTH_SEED);
    const spawned = await playUntil(page, (state) => state.enemies.length === 1);
    const firstDistance = distance(spawned.enemies[0] ?? spawned.player, spawned.player);

    const closer = await playFor(page, 1_000);
    expect(distance(closer.enemies[0] ?? closer.player, closer.player)).toBeLessThan(firstDistance);

    const rammed = await playUntil(page, (state) => state.enemies.length === 0);
    expect(rammed.health).toBe(initial.health - 20);
    expect(rammed.score).toBe(0);
  });

  test('a Shooter approaches and fires only within its attack range', async ({ page }) => {
    await startSeededMatch(page, OPEN_NORTH_SEED);
    await setPlayerHealth(page, 10_000);

    const spawned = await playUntil(
      page,
      (s) => s.enemies.some((enemy) => enemy.kind === 'shooter'),
      { sliceMs: 250 },
    );
    const shotsBefore = spawned.stats.shotsFired.enemy;
    const spawnedShooter = spawned.enemies.find((enemy) => enemy.kind === 'shooter');
    if (!spawnedShooter) throw new Error('Expected a Shooter.');
    const spawnDistance = distance(spawnedShooter, spawned.player);

    const firing = await playUntil(page, (s, before) => s.stats.shotsFired.enemy > before, {
      sliceMs: STEP_MS,
      maxMs: 12_000,
      arg: shotsBefore,
    });
    const shooter = firing.enemies.find((enemy) => enemy.kind === 'shooter');
    if (!shooter) throw new Error('The Shooter should still be afloat.');
    const firedFrom = distance(shooter, firing.player);
    expect(firedFrom).toBeLessThanOrEqual(380);
    expect(firedFrom).toBeLessThan(spawnDistance);

    const hit = await playUntil(page, (s, before) => s.health < before, {
      maxMs: 10_000,
      arg: firing.health,
    });
    expect((firing.health - hit.health) % 10).toBe(0);
  });

  test('enemies spawn at the configured interval, away from the player, both kinds', async ({
    page,
  }) => {
    await startSeededMatch(page, OPEN_NORTH_SEED, {
      matchDurationSeconds: 60,
      enemySpawnSeconds: 3,
    });
    await setPlayerHealth(page, 10_000);

    const state = await playUntil(page, (s) => s.stats.spawns.length >= 4, { sliceMs: 250 });
    expect(state.elapsedSeconds).toBeLessThan(13.5);
    const times = state.stats.spawns.map((spawn) => spawn.atSeconds);
    expect(times[0]).toBeCloseTo(4, 1);
    for (let i = 1; i < times.length; i++) {
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeCloseTo(3, 1);
    }
    expect(state.stats.spawns.slice(0, 2).map((spawn) => spawn.kind)).toEqual([
      'chaser',
      'shooter',
    ]);
    for (const spawn of state.stats.spawns) {
      expect(spawn.distanceFromPlayer).toBeGreaterThanOrEqual(380);
    }
  });
});

test.describe('match end and restart', () => {
  test('sinking stops the simulation, and Play again starts a clean match', async ({ page }) => {
    await startSeededMatch(page, 7002, { matchDurationSeconds: 60, enemySpawnSeconds: 1 });

    const sunk = await playUntil(page, (state) => state.outcome !== null, { sliceMs: 250 });
    expect(sunk.outcome).toBe('destroyed');
    expect(sunk.health).toBe(0);

    await page.keyboard.down('Space');
    const frozen = await readGameState(page);
    await page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.advanceTime?.(500));
    await page.waitForTimeout(200);
    const after = await readGameState(page);
    await page.keyboard.up('Space');
    expect(after.elapsedSeconds).toBe(frozen.elapsedSeconds);
    expect(after.score).toBe(frozen.score);
    expect(after.stats).toEqual(frozen.stats);
    expect(after.enemies).toEqual(frozen.enemies);

    await page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.advanceTime?.(2_000));
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByTestId('result-score')).toHaveText(String(sunk.score));

    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('timer')).toHaveText('1:00', { timeout: 15_000 });
    const fresh = await readGameState(page);
    expect(fresh).toMatchObject({
      elapsedSeconds: 0,
      score: 0,
      health: 100,
      outcome: null,
      enemies: [],
      projectiles: [],
      stats: { shotsFired: { player: 0, enemy: 0 }, spawns: [] },
    });
    await expect(page.getByTestId('hud-score')).toHaveText('0');
  });

  test('the result survives a page refresh', async ({ page }) => {
    await startSeededMatch(page, 7002, { matchDurationSeconds: 60, enemySpawnSeconds: 1 });
    await page.evaluate(() => window.__PIRATE_BATTLE_TEST__?.advanceTime?.(20_000));
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    const score = await page.getByTestId('result-score').textContent();

    await page.reload();
    await expect(page.getByTestId('last-result')).toHaveText(
      new RegExp(`Last battle: ${score} points · 0:\\d\\d · Ship sunk`),
    );
  });

  test('repeated navigation between screens keeps one clean battle at a time', async ({ page }) => {
    await seedProfile(page);
    await page.goto('/');
    for (let round = 0; round < 3; round++) {
      await page.getByRole('button', { name: 'Options' }).click();
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await page.getByRole('button', { name: 'Ranking' }).click();
      await page.getByRole('tab', { name: 'Match history' }).click();
      await page.getByRole('button', { name: 'Back' }).click();
      await startMatch(page);
      await expect(page.locator('canvas')).toHaveCount(1);
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await page
        .getByRole('dialog', { name: 'Leave battle?' })
        .getByRole('button', { name: 'Leave' })
        .click();
      await expect(page.locator('canvas')).toHaveCount(0);
    }
    await expect(page.getByTestId('last-result')).toHaveCount(0);
  });
});

test.describe('touch controls', () => {
  test('steer and fire at the same time with two fingers', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch controls are only shown on touch devices.');
    const initial = await startSeededMatch(page, OPEN_NORTH_SEED);

    const stick = await page.getByTestId('touch-stick').boundingBox();
    const fire = await page.getByTestId('touch-fireFront').boundingBox();
    if (!stick || !fire) throw new Error('Touch controls are not laid out.');
    const stickPoint = { x: stick.x + stick.width / 2, y: stick.y + 6, id: 1 };
    const firePoint = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 };

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stickPoint] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [stickPoint, firePoint],
    });
    const state = await playFor(page, 1_000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    expect(state.player.x).toBeGreaterThan(initial.player.x + 50);
    expect(state.stats.shotsFired.player).toBeGreaterThanOrEqual(3);

    const released = await playFor(page, 500);
    expect(released.stats.shotsFired.player).toBe(state.stats.shotsFired.player);
  });
});
