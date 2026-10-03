# Performance profile

Measurements were collected on 2026-10-03 from the local production build and
the deterministic E2E simulation. These are local baselines, not real-user
telemetry or a guarantee for other devices.

## Environment

- OS: Windows 11 Pro
- CPU: Intel Core i7-8565U @ 1.80 GHz
- Browser: Playwright Chromium 153.0.8010.12, desktop viewport 1280 × 720
- Browser-reported logical processors: 8
- The browser profile runs headlessly through Playwright.

## Animation frame sample

The Playwright profile sampled 180 `requestAnimationFrame` intervals with one
enemy present, after five simulated seconds in an E2E-controlled match.

| Measurement | Result |
| --- | ---: |
| Mean callback interval | 5.65 ms |
| 95th-percentile callback interval | 16.70 ms |
| Mean inverse interval | 177.06 callbacks/s |

The inverse-interval value is not the display refresh rate. The browser is
headless and callback cadence can be bursty; the p95 is the more useful frame
budget indicator. This is a light scene sample: it had no active projectiles.

## Three-minute simulation entity load

Command:

```sh
npx vitest run src/game/core/performanceProfile.test.ts --disableConsoleIntercept --reporter=verbose
```

The profile ran a seeded 180-second simulation with default spawn interval and
an empty input snapshot. Player max health is raised to 10,000 only in this
profiling fixture so the simulation reaches the configured three-minute timeout
and exposes sustained entity load; this is not a gameplay balance change.

| Measurement | Result |
| --- | ---: |
| Simulated duration | 180 s |
| Peak enemy ships | 10 |
| Peak projectiles | 4 |
| Peak gameplay entities (player + enemies + projectiles) | 15 |
| Simulation runtime in Vitest | 330 ms |

The runtime value covers the TypeScript simulation loop only; it excludes
PixiJS rendering, audio, browser scheduling, and GPU work.

## Cleanup and JavaScript heap

Command:

```sh
npx playwright test tests/e2e/performance.spec.ts --project=desktop-chromium --workers=1
```

The browser profile force-collected JavaScript garbage before taking each heap
measurement. It started from the menu, completed five start/leave cycles, and
verified there were no remaining canvas elements.

| Measurement | Result |
| --- | ---: |
| JS heap before cycles | 39,600,000 bytes |
| JS heap after five cycles | 39,600,000 bytes |
| Heap delta | 0 bytes |
| Canvases after cleanup | 0 |

`performance.memory` measures JavaScript heap, not GPU allocations or all native
browser memory. Shared PixiJS textures remain in the asset cache by design, so
this result should not be interpreted as a complete GPU-memory measurement.

## Follow-up

- Repeat on physical low-end Android hardware before making mobile performance
  claims.
- Profile GPU memory and a sustained combat scene with active projectiles in a
  browser DevTools performance session.
- The production build still reports its existing main JavaScript chunk above
  500 kB; consider code splitting if load-time measurements identify it as a
  user-facing bottleneck.
