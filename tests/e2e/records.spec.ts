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
