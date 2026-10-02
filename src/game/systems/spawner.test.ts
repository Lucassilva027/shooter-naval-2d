import { describe, expect, it } from 'vitest';
import { defaultGameConfig, type SpawnConfig } from '@/config/gameConfig';
import { createRandom } from '../core/random';
import { placeIslands } from '../entities/island';
import { createShip } from '../entities/ship';
import { circlesOverlap } from './collision';
import { createSpawnerState, findSpawnPoint, stepSpawner, type SpawnContext } from './spawner';

const DT = 1 / 60;
const ARENA = { width: 1600, height: 900 };
const config = defaultGameConfig.enemies.spawn;

function context(): SpawnContext {
  return {
    arena: ARENA,
    islands: placeIslands(defaultGameConfig.arena.islands, ARENA),
    player: createShip({
      id: 0,
      x: 800,
      y: 450,
      rotation: 0,
      maxHealth: 100,
      maxSpeed: 200,
      hull: defaultGameConfig.player.hull,
    }),
    ships: [],
    enemyRadius: 52,
  };
}

/** Runs the spawner for `seconds`, returning the step times at which spawns happened. */
function runSpawner(spawnConfig: SpawnConfig, seconds: number, alive = () => 0, seed = 7) {
  const state = createSpawnerState(spawnConfig);
  const random = createRandom(seed);
  const ctx = context();
  const spawns: { time: number; kind: string }[] = [];
  for (let i = 1; i <= Math.round(seconds / DT); i++) {
    const plan = stepSpawner(state, spawnConfig, ctx, alive(), random, DT);
    if (plan) spawns.push({ time: i * DT, kind: plan.kind });
  }
  return spawns;
}

describe('spawner', () => {
  it('waits the initial delay, then spawns once per interval', () => {
    const spawns = runSpawner(config, 15);
    const times = spawns.map((s) => s.time);
    expect(times[0]).toBeCloseTo(config.initialDelaySeconds, 1);
    for (let i = 1; i < times.length; i++) {
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeCloseTo(config.intervalSeconds, 1);
    }
    expect(times).toHaveLength(4);
  });

  it('opens with one enemy of each kind', () => {
    const kinds = runSpawner(config, 7).map((s) => s.kind);
    expect(kinds.slice(0, 2)).toEqual(['chaser', 'shooter']);
  });

  it('follows the configured mix after the opening order', () => {
    const fast = { ...config, initialDelaySeconds: 0, intervalSeconds: DT };
    const kinds = runSpawner(fast, 2000 * DT)
      .slice(2)
      .map((s) => s.kind);
    const chaserShare = kinds.filter((k) => k === 'chaser').length / kinds.length;
    expect(chaserShare).toBeGreaterThan(config.chaserWeight - 0.05);
    expect(chaserShare).toBeLessThan(config.chaserWeight + 0.05);
  });

  it('is reproducible for the same seed', () => {
    const fast = { ...config, initialDelaySeconds: 0, intervalSeconds: 0.1 };
    expect(runSpawner(fast, 5, () => 0, 42)).toEqual(runSpawner(fast, 5, () => 0, 42));
  });

  it('holds the spawn while the arena is full and releases it when a slot frees up', () => {
    let alive = config.maxAlive;
    const state = createSpawnerState(config);
    const random = createRandom(1);
    const ctx = context();
    let spawned = 0;
    for (let i = 0; i < Math.round(10 / DT); i++) {
      if (stepSpawner(state, config, ctx, alive, random, DT)) spawned++;
    }
    expect(spawned).toBe(0);
    alive = config.maxAlive - 1;
    expect(stepSpawner(state, config, ctx, alive, random, DT)).not.toBeNull();
  });

  it('picks points away from the player and clear of islands', () => {
    const ctx = context();
    const random = createRandom(3);
    for (let i = 0; i < 200; i++) {
      const point = findSpawnPoint(config, ctx, random);
      if (!point) continue;
      expect(Math.hypot(point.x - ctx.player.x, point.y - ctx.player.y)).toBeGreaterThanOrEqual(
        config.minDistanceFromPlayer,
      );
      for (const island of ctx.islands) {
        for (const c of island.colliders) {
          expect(circlesOverlap(point.x, point.y, ctx.enemyRadius, c.x, c.y, c.radius)).toBe(false);
        }
      }
      expect(point.x).toBeGreaterThan(ctx.enemyRadius);
      expect(point.x).toBeLessThan(ARENA.width - ctx.enemyRadius);
    }
  });
});
