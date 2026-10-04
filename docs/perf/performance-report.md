# Performance profile

Measured on 2026-10-03 with `npm run test:profile`. The raw output of the last
run is in [`performance-profile.json`](./performance-profile.json). These are
local baselines, not real-user telemetry or a guarantee for other devices.

## Environment and method

| Item | Value |
| --- | --- |
| OS | Windows 11 Pro |
| CPU | Intel Core i7-8565U @ 1.80 GHz (8 logical processors) |
| Browser | Playwright Chromium 153.0.8010.12, headless, GPU via ANGLE/D3D11 |
| Viewport | 1280 × 720, device pixel ratio 1 |
| Build | `vite build --mode profile`: the production bundle plus read-only state hooks; the game runs on its real clock |
| Match | 180 s, enemy spawn every 4 s (defaults otherwise), seed 146 |

The profile (`tests/profile/match.profile.spec.ts`) plays a full match through
the keyboard: it sails forward in alternating wide turns while holding the front
and both broadside cannons. The player's health is raised once through the test
hook so the ship survives the whole three minutes and the arena stays under
sustained load; nothing else is changed. A `requestAnimationFrame` recorder
collects every frame interval, and entity counts and JS heap are sampled once
per second.

## Three-minute match

| Measurement | Result |
| --- | ---: |
| Active match time / wall-clock time | 180 s / 180.1 s |
| Frames recorded | 10,808 |
| Average frame rate | 60.0 FPS |
| Mean / median frame interval | 16.67 ms / 16.70 ms |
| 95th-percentile frame interval | 16.70 ms |
| 99th-percentile / worst frame interval | 16.80 ms / 16.80 ms |
| Frames over 33 ms (a dropped frame at 60 Hz) | 0 |
| Enemies sunk by the player (score) | 22 |
| Shots fired (player / enemies) | 1,169 / 131 |
| Enemy spawns | 45 |

| Entities (sampled every second) | Peak | Mean |
| --- | ---: | ---: |
| Enemy ships | 5 | 1.8 |
| Projectiles | 10 | 3.7 |
| Ship display objects in the scene (player + enemies) | 6 | — |
| Effect sprites (flashes, splashes, explosions, debris) | 27 | — |

The simulation's own peak counters, which see every fixed step rather than one
sample per second, recorded 5 enemies and 12 projectiles. The scene counts
match the simulation, so sunk ships and spent projectiles are removed from the
scene. The 60 FPS target is met with no long frames; the frame rate is capped by
the 60 Hz display, so the margin above the target is not measured here.

## Memory across five start / play / leave cycles

After the match, the profile returns to the menu, then starts a match, plays
for 5 seconds and leaves, five times. Garbage collection is forced through the
DevTools protocol before each reading.

| Reading | JS heap |
| --- | ---: |
| During the match (min / max) | 9.80 MB / 14.16 MB |
| Menu after the match | 9.29 MB |
| After cycle 1 / 2 / 3 / 4 / 5 | 9.44 / 9.67 / 9.77 / 9.92 / 9.99 MB |
| Growth over five cycles | 0.70 MB |
| Canvas elements after cleanup | 0 |

### Investigation of the growth

A separate 15-cycle run showed the growth slowing down: about 300 KB for the
first cycles, then roughly 25 KB per cycle. A heap-snapshot comparison
(after 5 and after 15 cycles, unminified build) found these new objects for 10
cycles:

| Object | Added in 10 cycles |
| --- | ---: |
| `Object` | 194 |
| `Array` | 24 |
| `BindGroup` (PixiJS) | 10 |
| `EE` (event listener, eventemitter3) | 10 |

No game object is retained: there are no extra `GameController`, simulation,
`Application`, `Container`, `Sprite` or texture instances, and the page keeps 48
DOM nodes. The retainer chains show that each destroyed renderer leaves one
PixiJS shader bind group subscribed to PixiJS's own global objects (the shared
batch-sampler uniform group and the `Texture.EMPTY` / `Texture.WHITE` source),
even with `app.destroy({ releaseGlobalResources: true })`. That costs about
25 KB per match after warm-up. It does not grow during a match, and it would take
thousands of matches in one page session to matter. The fix belongs in PixiJS,
or would require reusing one Pixi `Application` across matches, which this
project avoids so that each match starts and ends with a clean lifecycle.

## Limitations

- One desktop machine with headless Chromium. Physical low-end Android devices
  were not profiled.
- `performance.memory` measures the JavaScript heap, not GPU memory or all
  native browser memory. Shared textures stay in the PixiJS asset cache by
  design.
- The frame rate is capped by the display refresh rate, so the measurement
  shows the target is met but not how much headroom remains.
- The simulation-only stress check (`src/game/core/performanceProfile.test.ts`)
  runs 180 simulated seconds in about 0.1 s of CPU time; it excludes rendering.
