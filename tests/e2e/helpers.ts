import { expect, type Page } from '@playwright/test';

/** Skips the first-match nickname dialog by storing a profile before the app loads. */
export async function seedProfile(page: Page, nickname = 'Tester'): Promise<void> {
  await page.addInitScript((name) => {
    localStorage.setItem(
      'pirate-battle:profile',
      JSON.stringify({ playerId: 'e2e-player', nickname: name }),
    );
  }, nickname);
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
