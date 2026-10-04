# Architecture

## Application overview

Pirate Battle is a browser application built with React, TypeScript, PixiJS, and
Vite. React owns screens and accessible HTML controls. PixiJS renders the active
arena, while a separate TypeScript simulation owns game state and rules.

## Runtime flow

1. `src/main.tsx` optionally starts MSW (after applying any `?scenario=` URL
   parameter), then mounts `App` in React Strict Mode with a TanStack Query
   client.
2. `App` selects the menu, options, records, match, or result screen. Profile,
   options, latest result, and personal bests are stored locally.
3. `LazyMatchScreen` loads the battle chunk (`MatchScreen`, PixiJS, game code)
   on demand, with a loading overlay and an error boundary whose "Try again"
   re-requests the chunk. `MatchScreen` creates a `GameController` in an effect
   and destroys it during cleanup. The controller owns the Pixi application,
   keyboard/touch input, simulation, renderer, audio, and ticker lifecycle.
4. When a match completes, the result is saved locally and submitted through a
   TanStack Query mutation (see "Match submission").

## Game layers

- `src/game/core/` contains the deterministic simulation, fixed-step loop,
  seeded random generator, world sizing, and match events. It has no React or
  PixiJS dependency.
- `src/game/entities/`, `src/game/systems/`, and `src/game/input/` define ships,
  islands, projectiles, collisions, weapons, enemy behavior, and input snapshots.
- `src/game/render/` maps simulation state to PixiJS display objects and effects.
- `src/game/GameController.ts` connects the simulation to PixiJS, input, audio,
  the HUD store, and match completion.
- The controller imports PixiJS's `pixi.js/unsafe-eval` static polyfills before
  renderer initialization so shader setup works under the production CSP without
  allowing the `unsafe-eval` source.
- `src/game/bridge/gameStore.ts` publishes UI-relevant snapshots (health, score,
  time, cannon readiness). It is written every frame but only notifies React
  subscribers (`useSyncExternalStore`) when a value actually changes, so React
  does not re-render on every simulation step.

The loop accumulates frame time, advances simulation in fixed steps of 1/60 s,
clamps long frame deltas (0.25 s) and renders with interpolation. The seed
selects one of three island formations from the supplied tileset. The same seed
reproduces both the layout and the enemy spawn sequence.

### Collisions

Ships use three hull circles along their length; islands use one or more
circles. Collisions are resolved every fixed step:

- Ship against island: the ship is pushed out of the coast and loses the part of
  its speed that points into it, so a head-on hit stops it and a glancing hit
  lets it slide.
- Rocks deal 10 damage per contact. A contact lasts while the hull stays within
  12 units of the rock (`ROCK_CONTACT_MARGIN`), so sliding along a rock, which
  separates and touches again on alternate steps, still counts as one impact.
- Ship against ship: hulls are separated; a Chaser that touches the player deals
  its ramming damage once and sinks without awarding a point.
- Projectiles hit the first ship of the opposing faction they overlap and are
  removed, so one shot can never damage or score twice. Projectiles that reach
  an island or the arena bounds are removed.

## UI and persistence

`src/app/App.tsx` owns screen navigation and application-level state.
`src/ui/screens/` contains the screen components, and `src/ui/components/`
contains shared dialogs, HUD and touch controls. The interface is HTML/CSS so
buttons, dialogs, tab semantics, keyboard focus and announcements remain
accessible to browser assistive technology. Each screen moves focus to its
heading when it opens; buttons never receive initial focus, so no focus ring is
shown until the player uses the keyboard.

`src/storage/` provides guarded local persistence for the player profile,
options, completed results, personal bests and queued API submissions. Personal
bests are keyed by the match configuration (`duration` and enemy spawn interval).
Each match receives an immutable configuration snapshot when it starts.

## Records API

`src/api/` defines typed contracts, an Axios client with a 10-second timeout,
TanStack Query options, and the persistent submission queue.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ranking?configKey&page&pageSize` | Ranking for one match configuration |
| `GET /api/history?playerId&page&pageSize` | One player's matches, newest first |
| `POST /api/matches` | Records a match; `201 created` or `200 already-recorded` |
| `POST /api/__mock/reset` | Mock only: restores the fixture records |

The ranking is ordered by score, then longer survival, then the earlier match,
then player and match id, so two entries never tie and pages are stable.

### Cache and invalidation

Ranking and history queries are keyed by endpoint, filter and page under a
common `records` root key. They use `staleTime: 0` (results change whenever a
match ends) and keep the previous page as placeholder data while the next page
loads, only if the filter is the same; a late answer for another page is cached
under its own key and never replaces the visible page. Server errors and
network failures are retried twice with backoff; 4xx answers are not retried.
Every submission, scenario change and mock reset invalidates the `records` root
key, so both tabs refresh automatically.

### Match submission

Match ids are generated on the client. The submission mutation first writes the
match into a persistent `localStorage` queue, then sends it; acknowledged
entries (`created` or `already-recorded`) are removed. A failed send leaves the
entry queued, and the mutation retries it twice with the same id. Queued
entries are sent again on startup, when connectivity returns, and from the
menu's "Send now" notice, which shows how many results are waiting. Because the
id is reused, a retry after a timeout whose request did reach the server is
recorded only once.

`src/mocks/` contains MSW handlers, network scenarios (`scenarios/network.ts`)
and a persistent IndexedDB mock database seeded with fixtures. MSW is enabled
unless `VITE_API_MOCKING=false`; therefore a successful submission in the
default build confirms the mock API, not a production service.

## Balancing decisions

- At most 8 enemies are afloat. With a 1-second spawn interval the arena would
  otherwise fill faster than the player can clear it; spawns resume when an
  enemy sinks.
- The first two spawns are a Chaser and then a Shooter, so every match shows
  both behaviors early; later spawns are 60 % Chasers.
- Enemies spawn at least 380 units from the player (the Shooter's range), so a
  new enemy never fires immediately.

## Tests and build

- Vitest covers deterministic game rules, storage, API contracts, the
  submission queue and mock handlers.
- Playwright runs desktop and mobile Chromium flows, including gameplay rules,
  records, network scenarios and visual snapshots under
  `tests/e2e/visual.spec.ts-snapshots/`. A shared fixture fails any test with an
  uncaught page error or an unexpected `console.error`.
- Test hooks (`window.__PIRATE_BATTLE_TEST__`) exist only in the Vite `e2e` and
  `profile` modes and are removed from the production build. `e2e` adds a manual
  game clock; `profile` keeps the real clock for performance measurements.
- `npm run build` runs TypeScript project checks before Vite emits `dist/`.

## Known limitations

- There is no production backend; the deployed build uses MSW in the browser.
- Visual baselines are committed for Windows only; fonts and GPU rasterization
  differ between platforms.
- Performance was measured on one desktop machine with headless Chromium;
  physical low-end mobile devices were not profiled.
- `performance.memory` covers the JavaScript heap only, not GPU memory.

See [README.md](./README.md) for setup and available commands.
