import { test as base, expect } from '@playwright/test';

/**
 * Browser messages that flows are expected to produce: a request blocked on purpose
 * (asset-failure and network-failure scenarios) is logged by Chromium itself.
 */
const EXPECTED_CONSOLE_ERRORS = [/Failed to load resource/];

/**
 * Every test fails on an uncaught page error or an unexpected `console.error`, so the
 * console stays clean across all covered flows. A suite that provokes a specific error on
 * purpose lists it with `test.use({ allowedConsoleErrors: [...] })`.
 */
export const test = base.extend<{ allowedConsoleErrors: RegExp[]; consoleGuard: undefined }>({
  allowedConsoleErrors: [[], { option: true }],
  consoleGuard: [
    async ({ page, allowedConsoleErrors }, use) => {
      const allowed = [...EXPECTED_CONSOLE_ERRORS, ...allowedConsoleErrors];
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`Uncaught: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (allowed.some((pattern) => pattern.test(text))) return;
        problems.push(`console.error: ${text}`);
      });
      await use(undefined);
      expect(problems, 'The browser console must stay free of errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
