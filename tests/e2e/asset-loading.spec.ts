import { expect, test } from './fixtures';
import { leaveMatch, playButton, seedProfile, startMatch } from './helpers';

test.describe('asset loading', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
  });

  test.describe('failed asset request', () => {
    // Blocking service workers lets `page.route` see asset requests, so the mock API is off.
    test.use({
      serviceWorkers: 'block',
      allowedConsoleErrors: [/Failed to start the mock API worker/],
    });

    test('shows an accessible error and recovers on retry', async ({ page }) => {
      await page.route('**/assets/png/**/tile_73.png', (route) => route.abort('failed'));

      await page.goto('/');
      await playButton(page).click();

      const alert = page.getByRole('alert').filter({ hasText: 'could not be loaded' });
      await expect(alert).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('canvas')).toHaveCount(0);

      await page.unroute('**/assets/png/**/tile_73.png');
      await alert.getByRole('button', { name: 'Try again' }).click();

      await expect(alert).toHaveCount(0);
      await expect(page.locator('canvas')).toHaveCount(1);
      await expect(page.getByText(/Loading assets/)).toHaveCount(0);
      await expect(page.getByRole('timer')).toHaveText(/^[12]:\d\d$/);
    });
  });

  test('mounts a single canvas across repeated enter/exit cycles', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      await startMatch(page);
      await expect(page.locator('canvas')).toHaveCount(1);
      await leaveMatch(page);
      await expect(page.locator('canvas')).toHaveCount(0);
    }
  });
});
