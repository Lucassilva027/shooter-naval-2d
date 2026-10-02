import { describe, expect, it } from 'vitest';
import { defaultGameConfig, type HullCircle } from '@/config/gameConfig';
import { GameSimulation } from '../core/GameSimulation';
import { EMPTY_INPUT } from '../input/actions';
import { placeIslands, type Island } from '../entities/island';
import { createShip } from '../entities/ship';
import {
  confineToArena,
  resolveShipVsIsland,
  separateShips,
  shipOverlapsIsland,
} from './collision';

const ROUND_HULL: readonly HullCircle[] = [{ offset: 0, radius: 20 }];
const LONG_HULL: readonly HullCircle[] = [
  { offset: 30, radius: 15 },
  { offset: 0, radius: 20 },
  { offset: -30, radius: 15 },
];

function shipAt(x: number, y: number, rotation = 0, hull = ROUND_HULL) {
  const ship = createShip({ x, y, rotation, maxHealth: 100, maxSpeed: 100, hull });
  ship.speed = 100;
  return ship;
}

function rockAt(x: number, y: number, radius: number): Island {
  const [island] = placeIslands([{ art: 'rock', x, y, radius }], { width: 1, height: 1 });
  if (!island) throw new Error('expected one island');
  return island;
}

describe('resolveShipVsIsland', () => {
  const rock = rockAt(100, 100, 30);

  it('ignores ships that do not touch the island', () => {
    const ship = shipAt(200, 100);
    expect(resolveShipVsIsland(ship, rock)).toBe(false);
    expect(ship.speed).toBe(100);
  });

  it('pushes the hull out to the surface', () => {
    const ship = shipAt(140, 100, Math.PI);
    expect(resolveShipVsIsland(ship, rock)).toBe(true);
    expect(ship.x).toBeCloseTo(150, 1);
    expect(ship.y).toBeCloseTo(100);
  });

  it('stops a head-on hit and keeps speed on a glancing one', () => {
    const headOn = shipAt(140, 100, Math.PI);
    resolveShipVsIsland(headOn, rock);
    expect(headOn.speed).toBeCloseTo(0);

    const glancing = shipAt(140, 100, Math.PI / 2);
    resolveShipVsIsland(glancing, rock);
    expect(glancing.speed).toBeCloseTo(100);
  });

  it('does not slow a ship sailing away', () => {
    const ship = shipAt(140, 100, 0);
    resolveShipVsIsland(ship, rock);
    expect(ship.speed).toBe(100);
  });

  it('collides with the bow of an elongated hull, not just its centre', () => {
    // Centre is 70 units away (clear of a single 20 radius circle), but the bow reaches it.
    const ship = shipAt(30, 100, 0, LONG_HULL);
    expect(shipOverlapsIsland(ship, rock)).toBe(true);
    resolveShipVsIsland(ship, rock);
    expect(shipOverlapsIsland(ship, rock)).toBe(false);
    expect(ship.speed).toBeCloseTo(0);
  });

  it('covers the corners of square islands', () => {
    const [square] = placeIslands([{ art: 'sandIsland', x: 500, y: 500, radius: 100 }], {
      width: 1,
      height: 1,
    });
    if (!square) throw new Error('expected one island');
    // Just inside the visible corner region, outside the central circle.
    const ship = shipAt(500 + 85, 500 + 85, 0, [{ offset: 0, radius: 5 }]);
    expect(shipOverlapsIsland(ship, square)).toBe(true);
  });
});

describe('confineToArena', () => {
  it('keeps the whole hull inside and absorbs speed into the wall', () => {
    const ship = shipAt(10, 400, Math.PI, LONG_HULL);
    expect(confineToArena(ship, { width: 1000, height: 800 })).toBe(true);
    // Facing left, the bow circle (offset 30, radius 15) is the one sticking out.
    expect(ship.x).toBeCloseTo(45);
    expect(ship.speed).toBeCloseTo(0);
  });

  it('accounts for the hull orientation', () => {
    const ship = shipAt(500, 790, Math.PI / 2, LONG_HULL);
    confineToArena(ship, { width: 1000, height: 800 });
    expect(ship.y).toBeCloseTo(800 - 45);
  });
});

describe('separateShips', () => {
  it('moves overlapping ships apart symmetrically', () => {
    const a = shipAt(100, 100);
    const b = shipAt(120, 100);
    expect(separateShips(a, b)).toBe(true);
    expect(a.x).toBeCloseTo(90, 1);
    expect(b.x).toBeCloseTo(130, 1);
  });
});

describe('GameSimulation with islands', () => {
  const arena = { width: 1280, height: 720 };

  function firstIsland(sim: GameSimulation) {
    const island = sim.islands[0];
    if (!island) throw new Error('default config must define islands');
    return island;
  }

  it('spawns the player clear of every island', () => {
    const sim = new GameSimulation(defaultGameConfig, arena);
    for (const island of sim.islands) expect(shipOverlapsIsland(sim.player, island)).toBe(false);
  });

  it('never lets the player sail into an island', () => {
    const sim = new GameSimulation(defaultGameConfig, arena);
    const target = firstIsland(sim);
    sim.player.rotation = Math.atan2(target.y - sim.player.y, target.x - sim.player.x);

    for (let i = 0; i < 60 * 10; i++) {
      sim.step(1 / 60, { ...EMPTY_INPUT, forward: true });
      expect(shipOverlapsIsland(sim.player, target)).toBe(false);
    }
  });

  it('slides along the coast instead of sticking when hitting at an angle', () => {
    const sim = new GameSimulation(defaultGameConfig, arena);
    const target = firstIsland(sim);
    const aim = Math.atan2(target.y - sim.player.y, target.x - sim.player.x);
    sim.player.rotation = aim + 0.5;

    for (let i = 0; i < 60 * 3; i++) sim.step(1 / 60, { ...EMPTY_INPUT, forward: true });
    expect(sim.player.speed).toBeGreaterThan(40);
  });
});
