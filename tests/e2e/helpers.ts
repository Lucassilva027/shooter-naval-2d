import { expect, type Page } from '@playwright/test';
import type { GameTestHooks, GameTestState } from '../../src/game/testing/gameTestHooks';

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: GameTestHooks;
  }
}

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
    const hooks = window.__PIRATE_BATTLE_TEST__;
    if (!hooks) throw new Error('Game test hooks are unavailable.');
    hooks.advanceTime(time);
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
        state.elapsedSeconds + 1e-6 >= target
      );
    },
    seconds,
  );
}
