import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  advanceGameTime,
  readPendingSubmissions,
  seedGameOptions,
  seedProfile,
  selectNetworkScenario,
  setPlayerHealth,
  startMatch,
} from './helpers';

const rankingPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Ranking' });
const historyPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Match history' });
const scenarioSelect = (page: Page) => page.getByRole('combobox', { name: 'Network scenario' });

/** Plays a 60-second match to its timeout and waits for the result screen. */
async function completeTimedMatch(page: Page): Promise<void> {
  await startMatch(page);
  await setPlayerHealth(page, 10_000);
  await advanceGameTime(page, 62_000);
  await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
}

test.describe('records as a fixture captain', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page, 'Ada', 'fixture-player-ada');
    await page.goto('/');
  });

  test('ranks and paginates the ranking and history independently', async ({ page }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    const ranking = rankingPanel(page);
    await expect(ranking.getByRole('table')).toBeVisible();
    await expect(ranking.getByRole('row')).toHaveCount(6);
    await expect(ranking.getByText('Page 1 of 3')).toBeVisible();
    await expect(ranking.getByRole('row').nth(1)).toHaveText(/^1Ada \(you\)122:00$/);
    await expect(ranking.getByRole('row').nth(2)).toHaveText(/^2Grace121:34$/);

    await ranking.getByRole('button', { name: 'Next' }).click();
    await expect(ranking.getByText('Page 2 of 3')).toBeVisible();
    await expect(ranking.getByRole('row').nth(1)).toHaveText(/^6Blackbeard8/);

    await page.getByRole('tab', { name: 'Match history' }).click();
    const history = historyPanel(page);
    await expect(history.getByRole('row')).toHaveCount(6);
    await expect(history.getByText('Page 1 of 2')).toBeVisible();
    await expect(history.getByRole('row').nth(1)).toHaveText(/^Ship sunk31:35/);

    await history.getByRole('button', { name: 'Next' }).click();
    await expect(history.getByText('Page 2 of 2')).toBeVisible();
    await expect(history.getByRole('row', { name: /Time up 12/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Ranking' }).click();
    await expect(ranking.getByText('Page 2 of 3')).toBeVisible();
  });

  test('switches network scenarios, shows background refreshes and resets', async ({ page }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    const ranking = rankingPanel(page);
    await expect(ranking.getByRole('table')).toBeVisible();

    await scenarioSelect(page).selectOption('slow');
    await expect(ranking.locator('[aria-busy="true"]')).toBeVisible();
    await expect(ranking.locator('[aria-busy="false"]')).toBeVisible({ timeout: 5_000 });

    await scenarioSelect(page).selectOption('server-error');
    await expect(ranking.getByText(/Refresh failed\. Showing saved results\./)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Reset scenario' }).click();
    await expect(ranking.getByRole('table')).toBeVisible();
    await expect(ranking.getByText(/Refresh failed\. Showing saved results\./)).toHaveCount(0);
    await expect(scenarioSelect(page)).toHaveValue('normal');
  });

  test('keeps the selected scenario after a refresh until it is reset', async ({ page }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    await scenarioSelect(page).selectOption('empty');
    await expect(rankingPanel(page)).toContainText('No ranked battles for these settings yet.');

    await page.reload();
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(scenarioSelect(page)).toHaveValue('empty');
    await expect(rankingPanel(page)).toContainText('No ranked battles for these settings yet.');
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(historyPanel(page)).toContainText('No battles recorded yet.');

    await page.getByRole('button', { name: 'Reset scenario' }).click();
    await expect(historyPanel(page).getByRole('table')).toBeVisible();
  });

  test('selects a scenario from the URL and pages through many records', async ({ page }) => {
    await page.goto('/?scenario=many-pages');
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(scenarioSelect(page)).toHaveValue('many-pages');
    const ranking = rankingPanel(page);
    await expect(ranking.getByText('Page 1 of 15')).toBeVisible();
    for (let pageNumber = 2; pageNumber <= 4; pageNumber++) {
      await ranking.getByRole('button', { name: 'Next' }).click();
      await expect(ranking.getByText(`Page ${pageNumber} of 15`)).toBeVisible();
    }
    await ranking.getByRole('button', { name: 'Previous' }).click();
    await expect(ranking.getByText('Page 3 of 15')).toBeVisible();
  });

  test('a late response for an older request never replaces the page on screen', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    const ranking = rankingPanel(page);
    await expect(ranking.getByText('Page 1 of 3')).toBeVisible();

    // The scenario switch refetches page 1 (answered after 2.4 s); page 2 answers in 1.7 s.
    await scenarioSelect(page).selectOption('out-of-order');
    await ranking.getByRole('button', { name: 'Next' }).click();
    await expect(ranking.getByText('Page 2 of 3')).toBeVisible({ timeout: 5_000 });
    await expect(ranking.locator('[aria-busy="false"]')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1_500);

    await expect(ranking.getByText('Page 2 of 3')).toBeVisible();
    await expect(ranking.getByRole('row').nth(1)).toHaveText(/^6Blackbeard8/);
  });

  test('restores the fixture records with Reset mock data', async ({ page }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    await page.getByRole('button', { name: 'Reset mock data' }).click();
    await expect(page.getByText('Mock records restored to the initial fixtures.')).toBeVisible();
    await expect(rankingPanel(page).getByText('Page 1 of 3')).toBeVisible();
  });
});

test('shows empty ranking and history for a player and settings without records', async ({
  page,
}) => {
  await seedProfile(page, 'Ada', 'empty-records-player');
  await seedGameOptions(page, { matchDurationSeconds: 70, enemySpawnSeconds: 2 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Ranking' }).click();
  await expect(rankingPanel(page)).toContainText('No ranked battles for these settings yet.');

  await page.getByRole('tab', { name: 'Match history' }).click();
  await expect(historyPanel(page)).toContainText('No battles recorded yet.');
});

test.describe('records API errors', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page, 'Ada', 'fixture-player-ada');
    await page.goto('/');
  });

  test('shows a retryable error for each tab independently', async ({ page }) => {
    await page.getByRole('button', { name: 'Ranking' }).click();
    await scenarioSelect(page).selectOption('ranking-error');
    await page.reload();
    await page.getByRole('button', { name: 'Ranking' }).click();

    const ranking = rankingPanel(page);
    await expect(ranking.getByRole('alert')).toContainText('Could not load records', {
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(historyPanel(page).getByRole('table')).toBeVisible();

    await scenarioSelect(page).selectOption('history-error');
    await page.reload();
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(historyPanel(page).getByRole('alert')).toContainText('Could not load records', {
      timeout: 15_000,
    });

    await expect(historyPanel(page).getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset scenario' }).click();
    await expect(historyPanel(page).getByRole('table')).toBeVisible();
  });

  test('does not retry client errors', async ({ page }) => {
    const requestTimes: number[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/ranking')) requestTimes.push(Date.now());
    });
    await page.goto('/?scenario=client-error');
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(rankingPanel(page).getByRole('alert')).toContainText('429');
    await page.waitForTimeout(3_500);

    // Development Strict Mode may cancel and restart the first fetch in the same tick, but a
    // retry would only follow after the one-second backoff.
    expect(requestTimes.length).toBeGreaterThan(0);
    expect(Math.max(...requestTimes) - Math.min(...requestTimes)).toBeLessThan(500);
  });

  test('reports a connection failure and recovers on retry', async ({ page }) => {
    await page.goto('/?scenario=connection-failure');
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(rankingPanel(page).getByRole('alert')).toContainText('Network Error', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Reset scenario' }).click();
    await expect(rankingPanel(page).getByRole('table')).toBeVisible();
  });
});

test.describe('match registration', () => {
  test.beforeEach(async ({ page }) => {
    await seedGameOptions(page, { matchDurationSeconds: 60, enemySpawnSeconds: 15 });
  });

  test('a completed match appears once in both tabs, which refresh on their own', async ({
    page,
  }) => {
    await seedProfile(page, 'Fresh Captain', 'fresh-records-player');
    await page.goto('/?seed=12345');
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(rankingPanel(page)).toContainText('No ranked battles for these settings yet.');
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(historyPanel(page)).toContainText('No battles recorded yet.');
    await page.getByRole('button', { name: 'Back' }).click();

    await completeTimedMatch(page);
    await expect(page.getByTestId('submission-status')).toHaveText('Result submitted.');
    await page.getByRole('button', { name: 'Main menu' }).click();

    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(rankingPanel(page).getByRole('row')).toHaveCount(2);
    await expect(rankingPanel(page).getByRole('row').nth(1)).toHaveText(
      /^1Fresh Captain \(you\)\d+1:00$/,
    );
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(historyPanel(page).getByRole('row')).toHaveCount(2);
    await expect(historyPanel(page).getByRole('row').nth(1)).toHaveText(/^Time up\d+1:00/);
  });

  test('a timed-out submission is retried with the same id and recorded once', async ({ page }) => {
    test.setTimeout(60_000);
    await seedProfile(page, 'Retry Captain', 'timeout-retry-player');
    await page.goto('/?scenario=submission-timeout');

    await completeTimedMatch(page);
    await expect(page.getByTestId('submission-status')).toHaveText('Sending your result…');
    const [pending] = await readPendingSubmissions(page);
    expect(pending?.matchId).toBeTruthy();

    await expect(page.getByTestId('submission-status')).toHaveText('Result submitted.', {
      timeout: 20_000,
    });
    expect(await readPendingSubmissions(page)).toEqual([]);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Match history' }).click();
    const history = historyPanel(page);
    await expect(history.getByRole('row')).toHaveCount(2);
    await expect(history.getByRole('row', { name: /Time up/ })).toHaveCount(1);
  });

  test('an outage at match end keeps the result pending across reload until recovery', async ({
    page,
  }) => {
    await seedProfile(page, 'Refresh Captain', 'refresh-pending-player');
    await page.goto('/');
    await selectNetworkScenario(page, 'submission-error');

    await completeTimedMatch(page);
    const status = page.getByTestId('submission-status');
    await expect(status).toHaveText(
      'Saved on this device. It will be sent when the connection is available.',
    );
    expect(await readPendingSubmissions(page)).toHaveLength(1);
    await page.getByRole('button', { name: 'Retry submission' }).click();
    await expect(status).toHaveText('Sending your result…');
    await expect(status).toHaveText(
      'Saved on this device. It will be sent when the connection is available.',
    );

    // Another battle can start while the result is still pending.
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('timer')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page
      .getByRole('dialog', { name: 'Leave battle?' })
      .getByRole('button', { name: 'Leave' })
      .click();

    await page.reload();
    await expect(page.getByTestId('pending-submissions')).toContainText(
      '1 battle result is waiting to be sent.',
    );
    expect(await readPendingSubmissions(page)).toHaveLength(1);

    await page.getByRole('button', { name: 'Ranking' }).click();
    await page.getByRole('button', { name: 'Reset scenario' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByTestId('pending-submissions')).toHaveCount(0);
    expect(await readPendingSubmissions(page)).toEqual([]);

    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(historyPanel(page).getByRole('row', { name: /Time up/ })).toHaveCount(1);
  });

  test('a pending result is sent automatically on the next startup', async ({ page }) => {
    await seedProfile(page, 'Startup Captain', 'startup-pending-player');
    await page.goto('/?scenario=connection-failure');
    await completeTimedMatch(page);
    await expect(page.getByTestId('submission-status')).toHaveText(
      'Saved on this device. It will be sent when the connection is available.',
    );

    await page.goto('/?scenario=normal');
    await expect.poll(() => readPendingSubmissions(page)).toEqual([]);
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(historyPanel(page).getByRole('row', { name: /Time up/ })).toHaveCount(1);
  });
});
