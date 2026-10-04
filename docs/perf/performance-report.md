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

- Desktop results are from one headless Chromium machine. One physical Android
  phone was also profiled once; it is not a representative sample of Android
  devices, and a low-end phone was not tested.
- `performance.memory` measures the JavaScript heap, not GPU memory or all
  native browser memory. Shared textures stay in the PixiJS asset cache by
  design.
- The frame rate is capped by the display refresh rate, so the measurement
  shows the target is met but not how much headroom remains.
- The simulation-only stress check (`src/game/core/performanceProfile.test.ts`)
  runs 180 simulated seconds in about 0.1 s of CPU time; it excludes rendering.

## Physical Android profile

One physical-device run was recorded on 2026-10-04. The full raw result is in
[`performance-profile-physical-android.json`](./performance-profile-physical-android.json).
The phone was an ASUS device (model `ASUS_I006D`) running Android 13, with
Chrome 154, in landscape at 831 × 312 CSS pixels and device pixel ratio 2.75.
The optimized `profile` build ran over the local Wi-Fi network. The match used
the real game clock, a 180-second duration and the default four-second spawn
interval. The read-only test hook kept the player alive; keyboard events were
automated through remote DevTools to sustain movement and firing.

| Measurement | Result |
| --- | ---: |
| Active match time / wall-clock time | 180 s / 181.8 s |
| Frames recorded | 10,765 |
| Average frame rate | 59.8 FPS |
| Mean / median frame interval | 16.72 ms / 16.70 ms |
| 95th / 99th-percentile frame interval | 16.80 ms / 16.90 ms |
| Worst frame interval | 33.50 ms |
| Frames over 33 ms / 50 ms | 2 / 0 |
| Enemies sunk / shots fired (player / enemies) | 25 / 1,170 / 124 |
| Enemy spawns | 45 |
| Peak enemies / projectiles | 4 / 8 |
| Peak scene ships / projectiles / effects | 5 / 8 / 30 |
| Sampled JS heap (min / max) | 13.4 MB / 13.4 MB |
| Canvas elements after match | 0 |

No focus-loss pauses occurred during this run. The two frames over 33 ms are
isolated long frames; the measured average is close to, but below, the 60 FPS
target. The heap readings are live samples without forced garbage collection
and do not establish post-match memory retention.

This is a single-device, single-run measurement, not a low-end Android
benchmark. It drove controls with synthetic keyboard events, not human touch,
and did not measure touch latency, GPU memory, battery or thermal effects.
Repeat the run after a fresh page load if a second sample is available, and
record any run separately rather than averaging away slow results. A manual
touch-control test on the same phone remains useful for usability but is not a
substitute for another performance sample.

### Mobile viewport emulation (not a physical-device result)

The supplementary Playwright run was measured on 2026-10-04 with
`npm run test:profile:mobile`. It executed the same three-minute match in
Playwright Chromium using the Pixel 7 landscape viewport, device scale factor
and touch emulation. The raw output is in
[`performance-profile-mobile-emulated.json`](./performance-profile-mobile-emulated.json)
so it cannot overwrite the desktop profile. Rendering and performance still
come from this computer's CPU, GPU, operating system and browser build; this
does not validate Android hardware, Chrome on Android, battery/thermal effects,
or real touch latency.

| Measurement | Result |
| --- | ---: |
| Emulated viewport | 863 × 360 (Pixel 7 landscape) |
| Active match time / wall-clock time | 180 s / 180.3 s |
| Frames recorded | 10,809 |
| Average frame rate | 59.95 FPS |
| Mean / median frame interval | 16.68 ms / 16.70 ms |
| 95th / 99th-percentile frame interval | 16.70 ms / 16.80 ms |
| Worst frame interval | 83.30 ms |
| Frames over 33 ms / 50 ms | 2 / 1 |
| Heap during match (min / max) | 10.11 MB / 13.28 MB |
| Heap growth over five cleanup cycles | 0.69 MB |
| Canvas elements after cleanup | 0 |

The run confirms the game and cleanup flow work in the emulated mobile
viewport. The long-frame samples mean the profile does not demonstrate a
consistent 60 FPS, and the desktop host prevents drawing conclusions about
real-phone performance.

To repeat the physical-device run, build and serve the instrumented production
bundle from the development machine:

```sh
npx vite build --mode profile --outDir dist-profile
npx vite preview --outDir dist-profile --host 0.0.0.0
adb forward tcp:9222 localabstract:chrome_devtools_remote
```

Open the LAN URL printed by Vite in Chrome on the phone, keep Chrome in the
foreground and the device in landscape, then inspect its tab from desktop Chrome
at `chrome://inspect/#devices`. The `profile` mode keeps the read-only test
hooks and real game clock; it is for measurement only and is not the normal
production build. The existing Playwright profiles cannot substitute for this
run because they do not use the phone's rendering hardware. Save another
physical-device result separately from
[`performance-profile.json`](./performance-profile.json) and
[`performance-profile-mobile-emulated.json`](./performance-profile-mobile-emulated.json).
