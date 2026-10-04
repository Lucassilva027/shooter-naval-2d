import { expect, type Page } from '@playwright/test';
import type { GameTestHooks, GameTestState } from '../../src/game/testing/gameTestHooks';

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: GameTestHooks;
  }
}

/** One fixed simulation step, in milliseconds. */
export const STEP_MS = 1000 / 60;
/** Mirrors `defaultGameConfig.player.motion.turnSpeed`. */
const PLAYER_TURN_SPEED = Math.PI * 0.85;

/** Skips the first-match nickname dialog by storing a profile before the app loads. */
export async function seedProfile(
  page: Page,
  nickname = 'Tester',
  playerId = 'e2e-player',
): Promise<void> {
  await page.addInitScript(({ name, id }) => {
    localStorage.setItem(
      'pirate-battle:profile',
      JSON.stringify({ playerId: id, nickname: name }),
    );
  }, { name: nickname, id: playerId });
}

export async function seedGameOptions(
  page: Page,
  options: { readonly matchDurationSeconds: number; readonly enemySpawnSeconds: number },
): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('pirate-battle:options', JSON.stringify(value));
  }, options);
}

export const playButton = (page: Page) => page.getByRole('button', { name: 'Play', exact: true });

/** Starts a match from the menu and waits until it is running (HUD visible). */
export async function startMatch(page: Page): Promise<void> {
  await playButton(page).click();
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 15_000 });
}

/** Leaves a running match through the confirmation dialog. */
export async function leaveMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page
    .getByRole('dialog', { name: 'Leave battle?' })
    .getByRole('button', { name: 'Leave' })
    .click();
  await expect(playButton(page)).toBeVisible();
}

export async function readGameState(page: Page): Promise<GameTestState> {
  return page.evaluate(() => {
    const hooks = window.__PIRATE_BATTLE_TEST__;
    const state = hooks?.readState();
    if (!state) throw new Error('Game test hooks are unavailable or the match has not started.');
    return state;
  });
}

export async function advanceGameTime(page: Page, milliseconds: number): Promise<void> {
  await page.evaluate((time) => {
    const advance = window.__PIRATE_BATTLE_TEST__?.advanceTime;
    if (!advance) throw new Error('The manual game clock is unavailable.');
    advance(time);
  }, milliseconds);
}

export async function setPlayerHealth(page: Page, health: number): Promise<void> {
  await page.evaluate((value) => {
    const hooks = window.__PIRATE_BATTLE_TEST__;
    if (!hooks) throw new Error('Game test hooks are unavailable.');
    hooks.setPlayerHealth(value);
  }, health);
}

export async function waitForGameElapsed(page: Page, seconds: number): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const state = window.__PIRATE_BATTLE_TEST__?.readState();
      return (
        state !== null &&
        state !== undefined &&
        (state.elapsedSeconds + 1e-6 >= target || state.outcome !== null)
      );
    },
    seconds,
  );
}

/** Advances the match clock and waits until the simulation has caught up. */
export async function playFor(page: Page, milliseconds: number): Promise<GameTestState> {
  const start = (await readGameState(page)).elapsedSeconds;
  await advanceGameTime(page, milliseconds);
  await waitForGameElapsed(page, start + milliseconds / 1000);
  return readGameState(page);
}

/** Holds real keyboard keys while the match clock advances, then releases them. */
export async function holdKeys(
  page: Page,
  keys: readonly string[],
  milliseconds: number,
): Promise<GameTestState> {
  for (const key of keys) await page.keyboard.down(key);
  const state = await playFor(page, milliseconds);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  return state;
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Turns the player's bow towards `heading` (radians) with the A/D keys. */
export async function turnTo(page: Page, heading: number, tolerance = 0.05): Promise<GameTestState> {
  let state = await readGameState(page);
  for (let attempt = 0; attempt < 20; attempt++) {
    const error = wrapAngle(heading - state.player.rotation);
    if (Math.abs(error) <= tolerance) return state;
    const steps = Math.max(1, Math.round(Math.abs(error) / (PLAYER_TURN_SPEED / 60)));
    state = await holdKeys(page, [error > 0 ? 'd' : 'a'], steps * STEP_MS);
  }
  return state;
}

/** Turns the bow towards a world point. */
export async function aimAt(
  page: Page,
  target: { readonly x: number; readonly y: number },
): Promise<GameTestState> {
  const { player } = await readGameState(page);
  return turnTo(page, Math.atan2(target.y - player.y, target.x - player.x), 0.06);
}

/**
 * Advances the match clock one slice per animation frame until `predicate` holds, and
 * returns the first matching state. The loop runs inside the page, so `predicate` is
 * serialised: it must only use its arguments, never variables from the test.
 */
export async function playUntil<Arg = undefined>(
  page: Page,
  predicate: (state: GameTestState, arg: Arg) => boolean,
  { sliceMs = 100, maxMs = 30_000, arg }: { sliceMs?: number; maxMs?: number; arg?: Arg } = {},
): Promise<GameTestState> {
  const start = (await readGameState(page)).elapsedSeconds;
  const handle = await page.waitForFunction(
    ({ source, slice, deadline, value }) => {
      const hooks = window.__PIRATE_BATTLE_TEST__;
      const state = hooks?.readState();
      if (!hooks?.advanceTime || !state) return false;
      const test = new Function(`return (${source});`)() as (s: unknown, a: unknown) => boolean;
      if (test(state, value)) return state;
      if (state.outcome) throw new Error('The match ended before the condition was reached.');
      if (state.elapsedSeconds > deadline) {
        throw new Error(`Condition not reached by ${deadline.toFixed(2)} s of game time.`);
      }
      hooks.advanceTime(slice);
      return false;
    },
    { source: predicate.toString(), slice: sliceMs, deadline: start + maxMs / 1000, value: arg },
    { polling: 'raf', timeout: 60_000 },
  );
  return (await handle.jsonValue()) as GameTestState;
}

export function distance(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export async function readPendingSubmissions(page: Page): Promise<{ matchId: string }[]> {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('pirate-battle:pending-submissions') ?? '[]') as {
        matchId: string;
      }[],
  );
}

/** Selects a mock network scenario from the records screen and returns to the menu. */
export async function selectNetworkScenario(page: Page, scenario: string): Promise<void> {
  await page.getByRole('button', { name: 'Ranking' }).click();
  await page.getByRole('combobox', { name: 'Network scenario' }).selectOption(scenario);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(playButton(page)).toBeVisible();
}
