import type { EnemyKind, SpawnConfig } from '@/config/gameConfig';
import type { Random } from '../core/random';
import type { Size } from '../core/worldSize';
import type { Island } from '../entities/island';
import type { Ship } from '../entities/ship';
import { circlesOverlap } from './collision';

export interface SpawnerState {
  /** Seconds until the next spawn is due; spawns wait at 0 while the arena is full. */
  timer: number;
  spawned: number;
}

export function createSpawnerState(config: SpawnConfig): SpawnerState {
  return { timer: config.initialDelaySeconds, spawned: 0 };
}

export interface SpawnPlan {
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

export interface SpawnContext {
  readonly arena: Size;
  readonly islands: readonly Island[];
  readonly player: Ship;
  readonly ships: readonly Ship[];
  /** Radius that encloses an enemy hull. */
  readonly enemyRadius: number;
}

/** Advances the spawn timer and returns a spawn to perform this step, if any. */
export function stepSpawner(
  state: SpawnerState,
  config: SpawnConfig,
  context: SpawnContext,
  aliveEnemies: number,
  random: Random,
  dt: number,
): SpawnPlan | null {
  state.timer = Math.max(0, state.timer - dt);
  if (state.timer > 1e-9 || aliveEnemies >= config.maxAlive) return null;

  const position = findSpawnPoint(config, context, random);
  if (!position) return null;

  const kind = pickKind(state.spawned, config, random);
  state.spawned++;
  state.timer = config.intervalSeconds;
  const rotation = Math.atan2(context.player.y - position.y, context.player.x - position.x);
  return { kind, ...position, rotation };
}

function pickKind(index: number, config: SpawnConfig, random: Random): EnemyKind {
  return config.openingOrder[index] ?? (random() < config.chaserWeight ? 'chaser' : 'shooter');
}

/** Random point inside the arena, away from the player and clear of islands and ships. */
export function findSpawnPoint(
  config: SpawnConfig,
  context: SpawnContext,
  random: Random,
): { x: number; y: number } | null {
  const { arena, islands, player, ships, enemyRadius } = context;
  const radius = enemyRadius + config.clearance;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const x = radius + random() * (arena.width - radius * 2);
    const y = radius + random() * (arena.height - radius * 2);

    if (Math.hypot(x - player.x, y - player.y) < config.minDistanceFromPlayer) continue;
    const hitsIsland = islands.some((island) =>
      island.colliders.some((c) => circlesOverlap(x, y, radius, c.x, c.y, c.radius)),
    );
    if (hitsIsland) continue;
    if (ships.some((ship) => circlesOverlap(x, y, radius, ship.x, ship.y, ship.boundingRadius))) {
      continue;
    }
    return { x, y };
  }
  return null;
}
