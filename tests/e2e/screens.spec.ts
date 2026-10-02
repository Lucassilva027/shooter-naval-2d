import { expect, test } from '@playwright/test';
import { leaveMatch, playButton, seedProfile, startMatch } from './helpers';

test.describe('first match', () => {
  test('asks for a valid nickname once, then remembers it', async ({ page }) => {
    await page.goto('/');
    await playButton(page).click();

    const dialog = page.getByRole('dialog', { name: 'Name your captain' });
    const input = dialog.getByLabel("Captain's name");
    await expect(input).toBeFocused();

    await input.fill('x');
    await dialog.getByRole('button', { name: 'Set sail' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Use 3 to 16 characters.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('  Anne   Bonny ');
    await dialog.getByRole('button', { name: 'Set sail' }).click();
    await expect(page.getByRole('timer')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText('Welcome aboard, Anne Bonny')).toBeVisible();
    await startMatch(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('cancelling the nickname dialog stays on the menu', async ({ page }) => {
    await page.goto('/');
    await playButton(page).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(playButton(page)).toBeFocused();
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('menu and screens', () => {
  test.beforeEach(async ({ page }) => {
    await seedProfile(page);
    await page.goto('/');
  });

  test('leaving a battle asks for confirmation and records nothing', async ({ page }) => {
    await startMatch(page);
    await page.getByRole('button', { name: 'Main Menu' }).click();

    const confirm = page.getByRole('dialog', { name: 'Leave battle?' });
    await expect(confirm.getByRole('button', { name: 'Keep fighting' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole('timer')).toBeVisible();

    await leaveMatch(page);
    await expect(page.getByTestId('last-result')).toHaveCount(0);
  });

  test('how to play opens as a dialog and returns focus on close', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'How to play' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'How to play' });
    await expect(dialog.getByRole('table', { name: 'Keyboard controls' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('records screen switches tabs with the arrow keys', async ({ page }) => {
    await page.getByRole('button', { name: 'Match history' }).click();
    const historyTab = page.getByRole('tab', { name: 'Match history' });
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Match history' })).toBeVisible();

    await historyTab.focus();
    await page.keyboard.press('ArrowLeft');
    const rankingTab = page.getByRole('tab', { name: 'Ranking' });
    await expect(rankingTab).toBeFocused();
    await expect(rankingTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(playButton(page)).toBeVisible();
  });

  test('options let the player rename their captain', async ({ page }) => {
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByTestId('options-nickname')).toHaveText('Tester');
    await page.getByRole('button', { name: 'Change' }).click();
    const input = page.getByRole('dialog').getByLabel("Captain's name");
    await expect(input).toHaveValue('Tester');
    await input.fill('Calico Jack');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('options-nickname')).toHaveText('Calico Jack');
  });

  test('touch controls appear only on touch devices', async ({ page, isMobile }) => {
    await startMatch(page);
    await expect(page.getByTestId('touch-controls')).toBeVisible({ visible: isMobile });
  });
});
