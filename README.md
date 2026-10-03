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
  repeatable testing.
- Configurable match duration and enemy spawn interval.
- Local captain profile, options, latest result, and per-configuration personal
  best score.
- Paginated ranking and match history screens, with retryable, idempotent match
  submissions.
- E2E-only clock and state hooks; these are excluded from production builds.

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

The Playwright suite starts its own Vite server in E2E mode. Browser binaries
must be installed for the local Playwright version if they are not already
available.

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

- [ARCHITECTURE.md](./ARCHITECTURE.md) describes the game and UI architecture.
- [PLANO.md](./PLANO.md) is the internal implementation checklist.
