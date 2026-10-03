# Verification report

Verification completed locally on 2026-10-03. The measurements are from this
working environment and do not replace checks against the deployed site.

## Automated tests

| Command | Result |
| --- | --- |
| `npm test` | 89 tests passed across 17 files |
| `npx playwright test --workers=1` | 63 passed, 1 skipped (64 total), desktop and mobile Chromium; 4.2 min |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `git diff --check` | Passed |
| `npm run build` | Passed; main minified chunk is 642.55 kB (194.85 kB gzip), above Vite's 500 kB advisory threshold |

The mobile skip is the browser-performance profiling test, which is intentionally
limited to the desktop Chromium project for comparable frame and heap samples.
The timeout E2E uses the E2E-only game hook to keep the player alive while it
checks the configured 60-second timeout, avoiding dependence on combat outcomes.

## Additional checks

- Local production-build smoke test with the exact headers from `vercel.json`:
  the game loaded and rendered, with no CSP violations or browser-console errors.
- Performance data and limitations: [`../perf/performance-report.md`](../perf/performance-report.md).
- Impeccable visual detector on the changed result UI: no findings.
- Visual regression tests passed as part of the full Playwright run.

These checks do not confirm that the Vercel deployment has the latest code or
that the production API is configured. Those still require checking the live
deployment and its environment settings.
