import { expect, test } from '@playwright/test';
import {
  advanceGameTime,
  seedProfile,
  startMatch,
} from './helpers';

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

test('shows empty ranking and history for a player and settings without records', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'pirate-battle:profile',
      JSON.stringify({ playerId: 'empty-records-player', nickname: 'Ada' }),
    );
    localStorage.setItem(
      'pirate-battle:options',
      JSON.stringify({ matchDurationSeconds: 70, enemySpawnSeconds: 2 }),
    );
  });
  await page.reload();

  await page.getByRole('button', { name: 'Ranking' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toContainText(
    'No ranked battles for these settings yet.',
  );

  await page.getByRole('tab', { name: 'Match history' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Match history' })).toContainText(
    'No battles recorded yet.',
  );
});

test.describe('records API errors', () => {
  test.use({ serviceWorkers: 'block' });

  test('shows retryable errors for ranking and history when the API is unavailable', async ({
    page,
  }) => {
    await page.route('**/api/ranking**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Records service unavailable.' }),
      }),
    );
    await page.route('**/api/history**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Records service unavailable.' }),
      }),
    );
    await page.getByRole('button', { name: 'Ranking' }).click();

    const rankingPanel = page.getByRole('tabpanel', { name: 'Ranking' });
    await expect(rankingPanel.getByRole('alert')).toContainText('Could not load records');
    await expect(rankingPanel.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('tab', { name: 'Match history' }).click();
    const historyPanel = page.getByRole('tabpanel', { name: 'Match history' });
    await expect(historyPanel.getByRole('alert')).toContainText('Could not load records');
    await expect(historyPanel.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test('retries a timed-out submission with the same id without recording a duplicate', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await seedProfile(page, 'Retry Captain', 'timeout-retry-player');
  await page.reload();
  await page.getByRole('button', { name: 'Ranking' }).click();
  await page
    .getByRole('combobox', { name: 'Network scenario' })
    .selectOption('submission-timeout');
  await page.getByRole('button', { name: 'Back' }).click();

  await startMatch(page);
  await advanceGameTime(page, 20_000);
  await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();

  let timedOut = false;
  page.on('console', (message) => {
    if (
      message.type() === 'warning' &&
      message.text().includes('Match submission remains queued')
    ) {
      timedOut = true;
    }
  });
  await expect
    .poll(
      async () => page.evaluate(() => {
        const pending = JSON.parse(
          localStorage.getItem('pirate-battle:pending-submissions') ?? '[]',
        ) as unknown[];
        return pending.length;
      }),
      { timeout: 12_000 },
    )
    .toBe(1);
  await expect.poll(() => timedOut, { timeout: 12_000 }).toBe(true);

  const pendingMatchId = await page.evaluate(() => {
    const pending = JSON.parse(
      localStorage.getItem('pirate-battle:pending-submissions') ?? '[]',
    ) as { matchId: string }[];
    return pending[0]?.matchId;
  });
  expect(pendingMatchId).toBeTruthy();

  await page.getByRole('button', { name: 'Main menu' }).click();
  await page.getByRole('button', { name: 'Match history' }).click();
  await page
    .getByRole('combobox', { name: 'Network scenario' })
    .selectOption('normal');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  await expect
    .poll(
      async () => page.evaluate(() => {
        const pending = JSON.parse(
          localStorage.getItem('pirate-battle:pending-submissions') ?? '[]',
        ) as unknown[];
        return pending.length;
      }),
      { timeout: 5_000 },
    )
    .toBe(0);

  const history = page.getByRole('tabpanel', { name: 'Match history' });
  await expect(history.getByRole('row', { name: /Ship sunk 0/ })).toHaveCount(1);
  await expect(history.getByRole('row')).toHaveCount(2);
});

test('keeps a failed submission pending across reload and flushes it on startup', async ({
  page,
}) => {
  await seedProfile(page, 'Refresh Captain', 'refresh-pending-player');
  await page.reload();
  await page.getByRole('button', { name: 'Ranking' }).click();
  await page
    .getByRole('combobox', { name: 'Network scenario' })
    .selectOption('submission-error');
  await page.getByRole('button', { name: 'Back' }).click();

  await startMatch(page);
  await advanceGameTime(page, 20_000);
  await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
  await page.waitForFunction(() => {
    const pending = JSON.parse(
      localStorage.getItem('pirate-battle:pending-submissions') ?? '[]',
    ) as unknown[];
    return pending.length === 1;
  });
  await expect(page.getByTestId('submission-status')).toHaveText(
    'Saved on this device. It will be sent when the connection is available.',
  );
  await page.getByRole('button', { name: 'Retry submission' }).click();
  await expect(page.getByTestId('submission-status')).toHaveText(
    'Saved on this device. It will be sent when the connection is available.',
  );

  await page.reload();
  await expect
    .poll(
      async () => page.evaluate(() => {
        const pending = JSON.parse(
          localStorage.getItem('pirate-battle:pending-submissions') ?? '[]',
        ) as unknown[];
        return pending.length;
      }),
      { timeout: 5_000 },
    )
    .toBe(0);

  await page.getByRole('button', { name: 'Match history' }).click();
  const history = page.getByRole('tabpanel', { name: 'Match history' });
  await expect(history.getByRole('row', { name: /Ship sunk 0/ })).toHaveCount(1);
  await expect(history.getByRole('row')).toHaveCount(2);
});
