import { describe, expect, it } from 'vitest';
import { defaultGameConfig, type GameConfig } from '@/config/gameConfig';
import { FixedStepLoop } from '../core/FixedStepLoop';
import { GameSimulation } from '../core/GameSimulation';
import { EMPTY_INPUT, type InputSnapshot } from '../input/actions';
import { createProjectile } from '../entities/projectile';

const DT = 1 / 60;
const ARENA = { width: 1600, height: 900 };
/** No islands, so projectiles fly freely unless a test adds obstacles. */
const OPEN_SEA: GameConfig = {
  ...defaultGameConfig,
  arena: { ...defaultGameConfig.arena, layouts: [[]] },
};
const { front, broadside } = defaultGameConfig.player.weapons;

function run(sim: GameSimulation, input: Partial<InputSnapshot>, seconds: number) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    sim.step(DT, { ...EMPTY_INPUT, ...input });
    events.push(...sim.drainEvents());
  }
  return events;
}

const shots = (events: ReturnType<typeof run>) => events.filter((e) => e.type === 'shot');

describe('front cannon', () => {
  it('fires one projectile ahead of the bow', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    run(sim, { fireFront: true }, DT);
    expect(sim.projectiles).toHaveLength(1);
    const [ball] = sim.projectiles;
    expect(ball?.x).toBeGreaterThan(sim.player.x + front.muzzleOffset - 1);
    expect(ball?.vx).toBeCloseTo(front.projectile.speed);
    expect(ball?.vy).toBeCloseTo(0);
  });

  it('respects its cooldown while the key is held', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    const events = run(sim, { fireFront: true }, 1);
    // Fires at t = 0, 0.4 and 0.8 s.
    expect(shots(events)).toHaveLength(3);
  });

  it('fires the same shots at any frame rate', () => {
    const shotsAt = (fps: number) => {
      const sim = new GameSimulation(OPEN_SEA, ARENA);
      const loop = new FixedStepLoop(DT, 0.25);
      let count = 0;
      for (let frame = 0; frame < fps * 3; frame++) {
        loop.advance(1 / fps, (dt) => sim.step(dt, { ...EMPTY_INPUT, fireFront: true }));
        count += shots(sim.drainEvents()).length;
      }
      return count;
    };
    expect(shotsAt(30)).toBe(8);
    expect(shotsAt(144)).toBe(8);
  });
});

describe('broadsides', () => {
  it('fires three parallel projectiles to the left', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    run(sim, { fireLeft: true }, DT);
    expect(sim.projectiles).toHaveLength(broadside.shotOffsets.length);
    for (const ball of sim.projectiles) {
      // Ship faces +x, so port (left) is -y on screen.
      expect(ball.vx).toBeCloseTo(0);
      expect(ball.vy).toBeCloseTo(-broadside.projectile.speed);
      expect(ball.y).toBeLessThan(sim.player.y);
    }
    const xs = sim.projectiles.map((ball) => ball.x);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBe(3);
  });

  it('fires to the right with the opposite direction', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    run(sim, { fireRight: true }, DT);
    for (const ball of sim.projectiles) expect(ball.vy).toBeCloseTo(broadside.projectile.speed);
  });

  it('uses an independent cooldown per side', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    run(sim, { fireLeft: true }, DT);
    const events = run(sim, { fireRight: true, fireLeft: true }, 0.5);
    const directions = shots(events).map((e) =>
      e.type === 'shot' ? Math.sign(e.y - sim.player.y) : 0,
    );
    expect(shots(events)).toHaveLength(3);
    expect(new Set(directions)).toEqual(new Set([1]));
  });
});

describe('projectiles', () => {
  it('expire after their lifetime with a splash', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    run(sim, { fireFront: true }, DT);
    sim.player.x = 200; // keep the shooter out of the way
    const events = run(sim, {}, front.projectile.lifetimeSeconds + 0.1);
    expect(sim.projectiles).toHaveLength(0);
    expect(events.filter((e) => e.type === 'impact' && e.surface === 'water')).toHaveLength(1);
  });

  it('are removed silently when leaving the arena', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    sim.projectiles.push(createProjectile(99, 'player', 5, 450, Math.PI, front.projectile));
    const events = run(sim, {}, 0.2);
    expect(sim.projectiles).toHaveLength(0);
    expect(events.filter((e) => e.type === 'impact')).toHaveLength(0);
  });

  it('are stopped by islands', () => {
    const sim = new GameSimulation(defaultGameConfig, ARENA);
    const island = sim.islands[0];
    if (!island) throw new Error('expected an island');
    const startX = island.x - island.radius - 100;
    sim.projectiles.push(createProjectile(99, 'player', startX, island.y, 0, front.projectile));
    const events = run(sim, {}, 1);
    expect(sim.projectiles).toHaveLength(0);
    const impact = events.find((e) => e.type === 'impact');
    expect(impact).toMatchObject({ surface: 'island' });
  });

  it('enemy shots damage the player exactly once', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    const { x, y } = sim.player;
    sim.projectiles.push(createProjectile(99, 'enemy', x, y - 100, Math.PI / 2, front.projectile));
    const events = run(sim, {}, 1);
    expect(sim.player.health).toBe(defaultGameConfig.player.maxHealth - front.projectile.damage);
    expect(sim.projectiles).toHaveLength(0);
    expect(events.filter((e) => e.type === 'impact' && e.surface === 'ship')).toHaveLength(1);
  });

  it('player shots never hit the player', () => {
    const sim = new GameSimulation(OPEN_SEA, ARENA);
    const { x, y } = sim.player;
    sim.projectiles.push(createProjectile(99, 'player', x, y - 100, Math.PI / 2, front.projectile));
    run(sim, {}, 1);
    expect(sim.player.health).toBe(defaultGameConfig.player.maxHealth);
  });
});
