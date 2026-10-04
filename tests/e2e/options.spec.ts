import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProfile, startMatch } from './helpers';

const durationStepper = (page: Page) => page.getByRole('spinbutton', { name: 'Game session time' });
const spawnStepper = (page: Page) => page.getByRole('spinbutton', { name: 'Enemy spawn time' });

async function openOptions(page: Page) {
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
}

test.describe('options', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
  });

  test('starts from the documented defaults', async ({ page }) => {
    await page.goto('/');
    await openOptions(page);
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '120');
    await expect(durationStepper(page)).toHaveAttribute('aria-valuemin', '60');
    await expect(durationStepper(page)).toHaveAttribute('aria-valuemax', '180');
    await expect(spawnStepper(page)).toHaveAttribute('aria-valuenow', '4');
    await expect(page.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
  });

  test('changes values with the buttons and the keyboard, and persists them', async ({ page }) => {
    await page.goto('/');
    await openOptions(page);

    const decreaseDuration = page.getByRole('button', { name: 'Decrease Game session time' });
    await expect(decreaseDuration).toHaveClass(/btn--secondary/);
    await decreaseDuration.hover();
    const resetButton = page.getByRole('button', { name: 'Reset to defaults' });
    await expect(decreaseDuration).toHaveCSS(
      'border-image-source',
      await resetButton.evaluate((button) => getComputedStyle(button).borderImageSource),
    );

    await decreaseDuration.click();
    await decreaseDuration.click();
    await expect(durationStepper(page)).toHaveText('100 s');

    await spawnStepper(page).focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(spawnStepper(page)).toHaveAttribute('aria-valuetext', '6 seconds');

    await page.reload();
    await openOptions(page);
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '100');
    await expect(spawnStepper(page)).toHaveAttribute('aria-valuenow', '6');
  });

  test('stops at the limits and disables the matching button', async ({ page }) => {
    await page.goto('/');
    await openOptions(page);

    await durationStepper(page).focus();
    await page.keyboard.press('End');
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '180');
    await page.keyboard.press('ArrowUp');
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '180');
    await expect(page.getByRole('button', { name: 'Increase Game session time' })).toBeDisabled();

    await spawnStepper(page).focus();
    await page.keyboard.press('Home');
    await expect(spawnStepper(page)).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('button', { name: 'Decrease Enemy spawn time' })).toBeDisabled();
  });

  test('reset restores the defaults', async ({ page }) => {
    await page.goto('/');
    await openOptions(page);
    await durationStepper(page).focus();
    await page.keyboard.press('Home');

    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '120');
    await expect(page.getByRole('status').filter({ hasText: 'reset' })).toHaveText(
      'Settings reset to defaults.',
    );

    await page.reload();
    await openOptions(page);
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '120');
  });

  test('repairs corrupted stored values field by field', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'pirate-battle:options',
        JSON.stringify({ matchDurationSeconds: 'lots', enemySpawnSeconds: 42 }),
      );
    });
    await page.goto('/');
    await openOptions(page);
    await expect(durationStepper(page)).toHaveAttribute('aria-valuenow', '120');
    await expect(spawnStepper(page)).toHaveAttribute('aria-valuenow', '15');
  });

  test('a new match uses the chosen duration', async ({ page }) => {
    await page.goto('/');
    await openOptions(page);
    await durationStepper(page).focus();
    await page.keyboard.press('Home');
    await page.getByRole('button', { name: 'Main Menu' }).click();

    await startMatch(page);
    await expect(page.getByRole('timer')).toHaveText(/^(1:00|0:5\d)$/);
  });
});
