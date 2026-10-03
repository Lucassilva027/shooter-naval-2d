import { describe, expect, it } from 'vitest';
import { defaultGameConfig, type EnemyKind, type GameConfig } from '@/config/gameConfig';
import { createEnemy, type Enemy } from '../entities/enemy';
import { EMPTY_INPUT, type InputSnapshot } from '../input/actions';
import { GameSimulation } from './GameSimulation';
import type { GameEvent } from './events';

const DT = 1 / 60;
const ARENA = { width: 1600, height: 900 };
const { chaser, shooter, spawn } = defaultGameConfig.enemies;

/** Open sea and no automatic spawns, so each test places its own enemies. */
const SANDBOX: GameConfig = {
  ...defaultGameConfig,
  arena: { ...defaultGameConfig.arena, layouts: [[]] },
  enemies: {
    ...defaultGameConfig.enemies,
    spawn: { ...spawn, initialDelaySeconds: 1e6 },
  },
};

function place(sim: GameSimulation, kind: EnemyKind, x: number, y: number, rotation = 0): Enemy {
  const enemy = createEnemy(
    1000 + sim.enemies.length,
    kind,
    kind === 'chaser' ? chaser : shooter,
    x,
    y,
    rotation,
  );
  sim.enemies.push(enemy);
  return enemy;
}

function run(sim: GameSimulation, seconds: number, input: Partial<InputSnapshot> = {}) {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    sim.step(DT, { ...EMPTY_INPUT, ...input });
    events.push(...sim.drainEvents());
  }
  return events;
}

const destroyed = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: 'shipDestroyed' }> => e.type === 'shipDestroyed',
  );

describe('chaser', () => {
  it('leaves more room to react in the default match settings', () => {
    expect(chaser.motion.maxSpeed).toBeLessThan(defaultGameConfig.player.motion.maxSpeed);
    expect(chaser.contactDamage).toBe(20);
    expect(spawn.intervalSeconds).toBe(4);
    expect(spawn.initialDelaySeconds).toBe(4);
    expect(spawn.maxAlive).toBe(8);
  });

  it('closes in and rams the player: damage applied, chaser destroyed, no score', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    place(sim, 'chaser', sim.player.x + 400, sim.player.y, Math.PI);
    const events = run(sim, 4);

    expect(sim.player.health).toBe(defaultGameConfig.player.maxHealth - chaser.contactDamage);
    expect(sim.enemies).toHaveLength(0);
    expect(sim.score).toBe(0);
    expect(destroyed(events)).toEqual([expect.objectContaining({ cause: 'collision' })]);
  });

  it('turns around to chase a player behind it', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    const enemy = place(sim, 'chaser', sim.player.x + 400, sim.player.y, 0);
    const start = Math.abs(enemy.x - sim.player.x);
    run(sim, 2.5);
    expect(Math.hypot(enemy.x - sim.player.x, enemy.y - sim.player.y)).toBeLessThan(start);
  });

  it('steers around an island between it and the player', () => {
    const config: GameConfig = {
      ...SANDBOX,
      arena: {
        ...SANDBOX.arena,
        layouts: [[{ art: 'grassIsland', x: 0.5, y: 0.5, radius: 100 }]],
        playerSpawn: { x: 0.2, y: 0.5 },
      },
    };
    const sim = new GameSimulation(config, ARENA);
    place(sim, 'chaser', ARENA.width * 0.8, ARENA.height * 0.5, Math.PI);
    run(sim, 8);
    expect(sim.player.health).toBeLessThan(defaultGameConfig.player.maxHealth);
  });
});

describe('shooter', () => {
  it('stops near its hold distance instead of ramming', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    const enemy = place(sim, 'shooter', sim.player.x + 700, sim.player.y, Math.PI);
    run(sim, 8);
    const distance = Math.hypot(enemy.x - sim.player.x, enemy.y - sim.player.y);
    expect(distance).toBeLessThanOrEqual(shooter.attackRange);
    expect(distance).toBeGreaterThan(shooter.attackRange * shooter.holdDistanceRatio * 0.7);
    expect(Math.abs(enemy.speed)).toBeLessThan(5);
  });

  it('fires at the player on its cooldown once aligned and in range', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    place(sim, 'shooter', sim.player.x + 300, sim.player.y, Math.PI);
    const events = run(sim, shooter.weapon.cooldownSeconds * 3 + 0.5);
    const enemyShots = events.filter((e) => e.type === 'shot' && e.faction === 'enemy');
    expect(enemyShots.length).toBeGreaterThanOrEqual(3);
    expect(enemyShots.length).toBeLessThanOrEqual(4);
    expect(sim.player.health).toBeLessThan(defaultGameConfig.player.maxHealth);
  });

  it('holds fire while out of range', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    place(sim, 'shooter', sim.player.x + shooter.attackRange + 200, sim.player.y, 0);
    const events = run(sim, 0.5);
    expect(events.some((e) => e.type === 'shot')).toBe(false);
  });

  it('does not fire through islands', () => {
    const config: GameConfig = {
      ...SANDBOX,
      arena: {
        ...SANDBOX.arena,
        layouts: [[{ art: 'rock', x: 0.5, y: 0.5, radius: 40 }]],
        playerSpawn: { x: 0.4, y: 0.5 },
      },
    };
    const sim = new GameSimulation(config, ARENA);
    place(sim, 'shooter', ARENA.width * 0.6, ARENA.height * 0.5, Math.PI);
    const events = run(sim, 0.2);
    expect(events.some((e) => e.type === 'shot')).toBe(false);
  });
});

describe('kills and scoring', () => {
  it('scores once per enemy sunk by the player and removes it at once', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    const target = place(sim, 'shooter', sim.player.x + 200, sim.player.y, 0);
    target.health = 1;
    const events = run(sim, 1, { fireFront: true });

    expect(sim.score).toBe(1);
    expect(sim.enemies).not.toContain(target);
    expect(destroyed(events)).toEqual([
      expect.objectContaining({ shipId: target.id, kind: 'shooter', cause: 'player' }),
    ]);
  });

  it('lets later shots pass where a sunk enemy was', () => {
    const sim = new GameSimulation(SANDBOX, ARENA);
    const target = place(sim, 'chaser', sim.player.x + 200, sim.player.y, 0);
    target.health = 1;
    const events = run(sim, 2, { fireFront: true });
    const shipHits = events.filter((e) => e.type === 'impact' && e.surface === 'ship');
    expect(shipHits).toHaveLength(1);
    expect(sim.score).toBe(1);
  });

  it('spawns enemies over time in a reproducible way for a seed', () => {
    const summary = (seed: number) => {
      const sim = new GameSimulation(defaultGameConfig, ARENA, seed);
      return run(sim, 15)
        .filter((e) => e.type === 'enemySpawned')
        .map((e) => e.kind);
    };
    expect(summary(9)).toEqual(summary(9));
    expect(summary(9).slice(0, 2)).toEqual(['chaser', 'shooter']);
  });
});
