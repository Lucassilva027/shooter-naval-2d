# Pirate Battle

A top-down 2D naval shooter built as a Jungle Gaming Game Developer Challenge
submission. The player steers a ship, fires front and broadside cannons, avoids
islands and enemy ships, and tries to survive while earning points.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```sh
npm ci
npm run dev
```

Vite prints the local URL. The app uses Mock Service Worker (MSW) by default for
the ranking, match history, and match-submission API. To point it at a separately
configured backend, set `VITE_API_MOCKING=false`; the app then uses the same-origin
`/api` endpoints. If that backend is hosted on another origin, configure
`VITE_API_BASE_URL` and allow that exact origin in the `connect-src` directive
of the Content Security Policy in `vercel.json`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_MOCKING` | enabled | Set to `false` to disable MSW and call a real backend |
| `VITE_API_BASE_URL` | same origin | Base URL of the records API when MSW is disabled |

No `.env` file is required.

## Controls

| Action | Keyboard |
| --- | --- |
| Sail forward | W or Up Arrow |
| Brake | S or Down Arrow |
| Turn | A / D or Left / Right Arrow |
| Fire front cannon | Space |
| Fire left / right broadsides | K / L |
| Pause / resume | P or Escape |

Touch devices have an on-screen steering stick and cannon controls. The game is
designed for landscape orientation.

## Features

- Fixed-step deterministic game simulation, seeded with `?seed=<number>` for
  repeatable testing; each seed also selects one of three island layouts.
- Rocks damage any ship for 10 health on first impact; scraping or sliding
  along the same rock does not repeatedly apply damage, and sandy/grass islands
  remain harmless.
- The HUD shows health, score, time and the reload state of each cannon; hits
  and sinking shake the camera (disabled with `prefers-reduced-motion`).
- Local captain profile, options, latest result, and per-configuration personal
  best score.
- Paginated ranking and match history screens (5 rows per page, the current
  captain highlighted as "(you)"), with retryable, idempotent match submissions
  and a menu notice for results still waiting to be sent.
- The battle screen (PixiJS) is a separate lazily loaded chunk with its own
  loading and error states.
- Test-only clock and state hooks; these are excluded from production builds.

## Gameplay configuration

Values live in `src/config/gameConfig.ts`. Every match receives a frozen copy
with the player's options applied, so changing options only affects new matches.

| Setting | Value |
| --- | --- |
| Match duration (option) | 60–180 s, step 10, default 120 |
| Enemy spawn interval (option) | 1–15 s, default 4; first spawn at 4 s |
| Spawn rules | Chaser, then Shooter, then 60 % Chasers; at least 380 units from the player; at most 8 enemies afloat |
| Player | 100 health, 220 units/s |
| Front cannon | 20 damage, 0.4 s reload |
| Broadsides | 3 parallel shots of 15 damage per side, 1.5 s reload each |
| Chaser | 40 health, 130 units/s, 20 ramming damage (no point awarded) |
| Shooter | 60 health, 120 units/s, 10 damage per shot, range 380, 1.6 s reload |
| Rock impact | 10 damage once per contact |
| Score | 1 point per enemy sunk by the player's cannons |

The 8-enemy cap is a balancing decision: with a 1-second spawn interval the
arena would otherwise fill faster than the player can clear it.

## Network scenarios (MSW)

The Ranking screen has a **Network scenario** selector, a **Reset scenario**
button, and a **Reset mock data** button that restores the fixture records. The
selected scenario is kept in `localStorage` until it is reset, so it survives a
refresh. It can also be chosen with URL parameters, for example
`/?scenario=variable-latency&scenarioSeed=7`.

| Scenario | Behaviour |
| --- | --- |
| `normal` | Fixture records (14 ranked matches for the default settings) |
| `empty` | Ranking and history return no records |
| `many-pages` | Adds 60 generated matches to every list |
| `slow` | Records answer after 1.5 s |
| `variable-latency` | Records answer after 0.1–2.5 s, reproducible with `scenarioSeed` |
| `out-of-order` | Each new records request answers sooner than the previous one |
| `records-timeout` | Records exceed the 10 s client timeout |
| `connection-failure` | Ranking, history and submissions fail at the network level |
| `client-error` | Records return HTTP 429 (not retried) |
| `server-error` | Records return HTTP 503 |
| `ranking-error` / `history-error` | Only that endpoint returns HTTP 500 |
| `submission-error` | Match submissions return HTTP 503 |
| `submission-timeout` | The first submission of each match is recorded but its answer times out |

To reproduce an offline match: choose `connection-failure` (or
`submission-error`), play a match, and the result screen reports that the result
is saved on this device. Reset the scenario and use **Send now** in the menu,
or reload the app, to send it. The same match id is reused, so it is recorded
once.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript project build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright tests on desktop and mobile Chromium |
| `npm run test:e2e:report` | Open the latest Playwright HTML report |
| `npm run test:profile` | Three-minute real-clock performance profile on a production build |

The Playwright suite starts its own Vite server in E2E mode, where the game runs
on a manual clock so gameplay tests are deterministic. Every test also fails on
an uncaught page error or an unexpected `console.error`. Browser binaries must
be installed for the local Playwright version if they are not already available
(`npx playwright install chromium`).

Visual baselines are committed for Windows (`*-win32.png`); on another platform
generate local baselines first with
`npx playwright test tests/e2e/visual.spec.ts --update-snapshots`.

The profile (`npm run test:profile`) builds with `vite build --mode profile`,
serves it with `vite preview`, plays a full three-minute match, and writes the
results to `docs/perf/performance-profile.json`; see
[docs/perf/performance-report.md](./docs/perf/performance-report.md).

## Deployment

The repository includes `vercel.json` for Vercel's Vite build and security
headers. The Content Security Policy is tested against the local production
build; PixiJS's `pixi.js/unsafe-eval` static polyfills let the game run without
allowing the `unsafe-eval` CSP source. Build locally with `npm run build`, then
deploy the repository through the Vercel project connected to it. A production
backend is not included; the default build uses MSW unless
`VITE_API_MOCKING=false` is configured.

## Asset use

The supplied visual and audio assets are documented in [ASSETS.md](./ASSETS.md).
For this submission, treat them as restricted to the technical challenge; this
repository does not establish a general-purpose license.

## Project notes

- [ARCHITECTURE.md](./ARCHITECTURE.md) describes the game and UI architecture,
  technical decisions and known limitations.
- [docs/testing/test-report.md](./docs/testing/test-report.md) lists what the
  automated tests cover.
- [PLANO.md](./PLANO.md) is the internal implementation checklist.
