import { expect, test } from './fixtures';
import { advanceGameTime, seedGameOptions, seedProfile, startMatch } from './helpers';

const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.01,
};

test.describe('visual regression', () => {
  test('main menu', async ({ page }) => {
    await seedProfile(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.locator('.panel__title-art')).toBeVisible();
    await expect(page).toHaveScreenshot('main-menu.png', screenshotOptions);
  });

  test('stable arena', async ({ page }) => {
    await seedProfile(page);
    await page.goto('/?seed=12345');
    await startMatch(page);

    await expect(page.locator('[data-testid="arena"] canvas')).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText('2:00');
    await expect(page).toHaveScreenshot('arena.png', screenshotOptions);
  });

  test('match result', async ({ page }) => {
    await seedProfile(page);
    await seedGameOptions(page, { matchDurationSeconds: 60, enemySpawnSeconds: 1 });
    await page.goto('/?seed=7002');
    await startMatch(page);
    await advanceGameTime(page, 20_000);

    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Play again' })).not.toBeFocused();
    await expect(page.getByTestId('result-score')).toBeVisible();
    await expect(page).toHaveScreenshot('match-result.png', screenshotOptions);
  });
});
