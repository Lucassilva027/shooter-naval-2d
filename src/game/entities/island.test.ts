import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '@/config/gameConfig';
import { createRandom } from '../core/random';
import { shipOverlapsIsland } from '../systems/collision';
import { createShip } from './ship';
import { placeIslands, selectIslandLayout } from './island';
import { findSpawnPoint } from '../systems/spawner';

describe('island layouts', () => {
  it('selects a repeatable, varied layout from the match seed', () => {
    const { layouts } = defaultGameConfig.arena;
    const signature = (seed: number) =>
      selectIslandLayout(layouts, seed)
        .map(({ art, x, y, radius }) => `${art}:${x}:${y}:${radius}`)
        .join('|');

    expect(signature(0)).toBe(signature(0));
    expect(new Set([signature(0), signature(1), signature(2)]).size).toBe(layouts.length);
  });

  it('keeps every layout inside the arena and clear of the player spawn', () => {
    const arena = { width: 1024, height: 576 };
    const player = createShip({
      id: 0,
      x: defaultGameConfig.arena.playerSpawn.x * arena.width,
      y: defaultGameConfig.arena.playerSpawn.y * arena.height,
      rotation: 0,
      maxHealth: defaultGameConfig.player.maxHealth,
      maxSpeed: defaultGameConfig.player.motion.maxSpeed,
      hull: defaultGameConfig.player.hull,
    });

    for (const layout of defaultGameConfig.arena.layouts) {
      for (const island of placeIslands(layout, arena)) {
        expect(island.x - island.boundingRadius).toBeGreaterThanOrEqual(0);
        expect(island.y - island.boundingRadius).toBeGreaterThanOrEqual(0);
        expect(island.x + island.boundingRadius).toBeLessThanOrEqual(arena.width);
        expect(island.y + island.boundingRadius).toBeLessThanOrEqual(arena.height);
        expect(shipOverlapsIsland(player, island)).toBe(false);
      }
    }
  });

  it('leaves valid enemy spawn points open in every layout', () => {
    const arena = { width: 1024, height: 576 };
    const player = createShip({
      id: 0,
      x: defaultGameConfig.arena.playerSpawn.x * arena.width,
      y: defaultGameConfig.arena.playerSpawn.y * arena.height,
      rotation: 0,
      maxHealth: defaultGameConfig.player.maxHealth,
      maxSpeed: defaultGameConfig.player.motion.maxSpeed,
      hull: defaultGameConfig.player.hull,
    });

    defaultGameConfig.arena.layouts.forEach((layout, index) => {
      const context = {
        arena,
        islands: placeIslands(layout, arena),
        player,
        ships: [],
        enemyRadius: 52,
      };
      for (let seed = 0; seed < 20; seed++) {
        const point = findSpawnPoint(
          defaultGameConfig.enemies.spawn,
          context,
          createRandom(index * 20 + seed),
        );
        expect(point, `layout ${index}, seed ${seed}`).not.toBeNull();
      }
    });
  });

  it('rejects a configuration without any island layouts', () => {
    expect(() => selectIslandLayout([], 1)).toThrow(
      new RangeError('At least one island layout is required.'),
    );
  });
});
