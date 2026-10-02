import { expect, test } from '@playwright/test';

test.describe('asset loading', () => {
  test('shows an accessible error when assets fail and recovers on retry', async ({ page }) => {
    await page.route('**/assets/png/**/tile_73.png', (route) => route.abort('failed'));

    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('could not be loaded', { timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);

    await page.unroute('**/assets/png/**/tile_73.png');
    await alert.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByText(/Loading assets/)).toHaveCount(0);
    await expect(page.getByRole('timer')).toHaveText(/^[12]:\d\d$/);
  });

  test('mounts a single canvas across repeated enter/exit cycles', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Play' }).click();
      await expect(page.locator('canvas')).toHaveCount(1);
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});
