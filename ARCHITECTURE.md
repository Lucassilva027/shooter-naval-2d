# Architecture

## Application overview

Pirate Battle is a browser application built with React, TypeScript, PixiJS, and
Vite. React owns screens and accessible HTML controls. PixiJS renders the active
arena, while a separate TypeScript simulation owns game state and rules.

## Runtime flow

1. `src/main.tsx` optionally starts MSW, then mounts `App` in React Strict Mode
   with a TanStack Query client.
2. `App` selects the menu, options, records, match, or result screen. Profile,
   options, latest result, and personal bests are stored locally.
3. `MatchScreen` creates a `GameController` in an effect and destroys it during
   cleanup. The controller owns the Pixi application, keyboard/touch input,
   simulation, renderer, audio, and ticker lifecycle.
4. When a match completes, the result is saved locally. Its API submission is
   first persisted in a retry queue, then sent; acknowledged entries are removed.
   Pending submissions are retried on startup and when connectivity returns.

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
- `src/game/bridge/gameStore.ts` publishes UI-relevant snapshots. React does not
  subscribe to every simulation step.

The loop accumulates frame time, advances simulation in fixed steps, clamps long
frame deltas, and renders with interpolation. Tests can supply a fixed seed and,
in E2E mode only, advance a manual clock and read a snapshot of simulation state.
The seed selects one of three island formations from the supplied tileset. The
same seed reproduces both the layout and enemy spawn sequence.

## UI and persistence

`src/app/App.tsx` owns screen navigation and application-level state.
`src/ui/screens/` contains the screen components, and `src/ui/components/`
contains shared dialogs, HUD and touch controls. The interface is HTML/CSS so
buttons, dialogs, tab semantics, keyboard focus and announcements remain
accessible to browser assistive technology.

`src/storage/` provides guarded local persistence for the player profile,
options, completed results, personal bests and queued API submissions. Personal
bests are keyed by the match configuration (`duration` and enemy spawn interval).
Each match receives an immutable configuration snapshot when it starts.

## Records API

`src/api/` defines typed contracts, an Axios client with a timeout, TanStack
Query options, and the persistent submission queue. Match IDs are generated on
the client; the server acknowledgement may be `created` or `already-recorded`,
making retries idempotent.

`src/mocks/` contains MSW handlers and a persistent mock database. MSW is enabled
unless `VITE_API_MOCKING=false`; therefore a successful submission in the default
build confirms the mock API, not a production service.

## Tests and build

- Vitest covers deterministic game rules, storage, API contracts and mock
  handlers.
- Playwright runs desktop and mobile Chromium flows, including visual snapshots
  under `tests/e2e/visual.spec.ts-snapshots/`.
- E2E-only hooks are enabled by the Playwright Vite `--mode e2e` server and are
  guarded by the Vite mode so they are absent from production builds.
- `npm run build` runs TypeScript project checks before Vite emits `dist/`.

See [README.md](./README.md) for setup and available commands.
