import { expect, test } from '@playwright/test';
import { seedProfile } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedProfile(page, 'Ada', 'fixture-player-ada');
  await page.goto('/');
});

test('loads ranked matches and paginates without changing the other record set', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ranking' }).click();

  const rankingPanel = page.getByRole('tabpanel', { name: 'Ranking' });
  await expect(rankingPanel.getByRole('table')).toBeVisible();
  await expect(rankingPanel.getByRole('row')).toHaveCount(3);
  await expect(rankingPanel.getByRole('row', { name: /Ada 12/ })).toBeVisible();
  await expect(rankingPanel.getByRole('row', { name: /Grace 12/ })).toBeVisible();

  await rankingPanel.getByRole('button', { name: 'Next' }).click();
  await expect(rankingPanel.getByText('Page 2 of 2')).toBeVisible();
  await expect(rankingPanel.getByRole('row', { name: /Lin 5/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Match history' }).click();
  const historyPanel = page.getByRole('tabpanel', { name: 'Match history' });
  await expect(historyPanel.getByRole('row')).toHaveCount(3);
  await expect(historyPanel.getByRole('row', { name: /Time up 4/ })).toBeVisible();

  await historyPanel.getByRole('button', { name: 'Next' }).click();
  await expect(historyPanel.getByText('Page 2 of 2')).toBeVisible();
  await expect(historyPanel.getByRole('row', { name: /Time up 12/ })).toBeVisible();
});

test('switches network scenarios and resets the records API', async ({ page }) => {
  await page.getByRole('button', { name: 'Ranking' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Ranking' });
  await expect(panel.getByRole('table')).toBeVisible();

  const scenario = page.getByRole('combobox', { name: 'Network scenario' });
  await scenario.selectOption('slow');
  await expect(panel.locator('[aria-busy="true"]')).toBeVisible();
  await expect(panel.locator('[aria-busy="false"]')).toBeVisible({ timeout: 5_000 });

  await scenario.selectOption('server-error');
  await expect(panel.getByText(/Refresh failed\. Showing saved results\./)).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Reset scenario' }).click();
  await expect(panel.getByRole('table')).toBeVisible();
  await expect(panel.getByText(/Refresh failed\. Showing saved results\./)).toHaveCount(0);
  await expect(scenario).toHaveValue('normal');
});
