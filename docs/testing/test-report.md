# Verification report

Verification completed locally on 2026-10-03 (Windows 11, Playwright Chromium
153). The measurements are from this working environment and do not replace
checks against the deployed site.

## Automated checks

| Command | Result |
| --- | --- |
| `npm test` | 106 tests passed across 18 files |
| `npx playwright test` | 105 passed, 1 skipped (106 total), desktop and mobile Chromium; 5.4 min |
| `npm run test:profile` | Passed; see [`../perf/performance-report.md`](../perf/performance-report.md) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; main chunk 343.6 kB (108.9 kB gzip), battle chunk with PixiJS 311.6 kB (91.2 kB gzip), no size warning |

The skipped test is the two-finger touch test, which only runs in the mobile
project. Every Playwright test also fails on an uncaught page error or an
unexpected `console.error` (`tests/e2e/fixtures.ts`). The Playwright HTML report
is written to `playwright-report/`, and traces are kept for failed tests.

## Coverage of the challenge's test list

| # | Requirement | Spec |
| --- | --- | --- |
| 1 | Options navigation, validation, persistence | `options.spec.ts` |
| 2 | Asset loading, failure, retry | `asset-loading.spec.ts` |
| 3 | Start, movement, rotation, arena bounds, island collision | `gameplay.spec.ts` |
| 4 | Front and broadside fire, damage, cooldown, score without duplicates | `gameplay.spec.ts` |
| 5 | Chaser and Shooter behavior, spawn interval | `gameplay.spec.ts` |
| 6 | End by time and by sinking, frozen simulation, clean restart | `gameplay.spec.ts`, `game-clock.spec.ts` |
| 7 | Pause, focus loss, resume without clock drift | `screens.spec.ts`, `game-clock.spec.ts` |
| 8 | Result screen and persistence after refresh | `gameplay.spec.ts`, `visual.spec.ts` |
| 9 | Leaving a match, repeated navigation, touch controls | `screens.spec.ts`, `gameplay.spec.ts`, `asset-loading.spec.ts` |
| 10 | Ranking and history paging, loading, empty and error states | `records.spec.ts` |
| 11 | Match registration updating both tabs, pending result after refresh | `records.spec.ts` |
| 12 | Retry after timeout without duplicates, late responses not overwriting | `records.spec.ts` |
| — | Visual regression of menu, stable arena and result | `visual.spec.ts` |

Combat tests drive the game through real keyboard events (and touch events on
mobile) on a manual game clock, then check the effects in the observable
simulation state: positions, health, projectiles, cooldowns, spawns and score.

## Notes

- A gameplay test found that sliding along a rock could count as two impacts;
  the contact rule was fixed and covered by a unit test and an E2E test.
- Visual baselines are committed for Windows only (`*-win32.png`).
- These checks do not confirm that the Vercel deployment has the latest code.
  That requires a new deploy and a check of the live URL.
