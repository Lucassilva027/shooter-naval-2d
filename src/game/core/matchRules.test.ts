import { describe, expect, it } from 'vitest';
import { defaultGameConfig, type GameConfig } from '@/config/gameConfig';
import { createEnemy } from '../entities/enemy';
import { EMPTY_INPUT, type InputSnapshot } from '../input/actions';
import type { GameEvent } from './events';
import { GameSimulation } from './GameSimulation';

const DT = 1 / 60;
const ARENA = { width: 1600, height: 900 };
const { chaser, shooter, spawn } = defaultGameConfig.enemies;

function sandbox(durationSeconds: number): GameConfig {
  return {
    ...defaultGameConfig,
    match: { ...defaultGameConfig.match, durationSeconds },
    arena: { ...defaultGameConfig.arena, islands: [] },
    enemies: { ...defaultGameConfig.enemies, spawn: { ...spawn, initialDelaySeconds: 1e6 } },
  };
}

function run(sim: GameSimulation, steps: number, input: Partial<InputSnapshot> = {}) {
  const events: GameEvent[] = [];
  for (let i = 0; i < steps; i++) {
    sim.step(DT, { ...EMPTY_INPUT, ...input });
    events.push(...sim.drainEvents());
  }
  return events;
}

const ended = (events: readonly GameEvent[]) => events.filter((e) => e.type === 'matchEnded');

describe('match timer', () => {
  it('ends with a timeout exactly when the duration elapses', () => {
    const sim = new GameSimulation(sandbox(60), ARENA);
    run(sim, 60 * 60 - 1);
    expect(sim.outcome).toBeNull();
    expect(sim.remainingSeconds).toBeGreaterThan(0);

    const events = run(sim, 1);
    expect(sim.outcome).toBe('timeout');
    expect(sim.remainingSeconds).toBe(0);
    expect(sim.elapsedSeconds).toBe(60);
    expect(ended(events)).toEqual([{ type: 'matchEnded', outcome: 'timeout' }]);
  });

  it('freezes the world and the score once the match is over', () => {
    const sim = new GameSimulation(sandbox(60), ARENA);
    run(sim, 60 * 60, { forward: true });
    const { x, y } = sim.player;
    const later = run(sim, 120, { forward: true, fireFront: true });
    expect(later).toEqual([]);
    expect(sim.player.x).toBe(x);
    expect(sim.player.y).toBe(y);
    expect(sim.projectiles).toHaveLength(0);
  });
});

describe('player death', () => {
  it('ends the match when a Chaser rams a nearly sunk player, without scoring', () => {
    const sim = new GameSimulation(sandbox(120), ARENA);
    sim.player.health = chaser.contactDamage;
    sim.enemies.push(createEnemy(500, 'chaser', chaser, sim.player.x + 120, sim.player.y, Math.PI));
    const events = run(sim, 120);

    expect(sim.outcome).toBe('destroyed');
    expect(sim.player.health).toBe(0);
    expect(sim.score).toBe(0);
    expect(ended(events)).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'shipDestroyed', shipId: sim.player.id, cause: 'collision' }),
    );
  });

  it('ends the match when an enemy cannonball sinks the player', () => {
    const sim = new GameSimulation(sandbox(120), ARENA);
    sim.player.health = shooter.weapon.projectile.damage;
    sim.enemies.push(
      createEnemy(500, 'shooter', shooter, sim.player.x + 250, sim.player.y, Math.PI),
    );
    const events = run(sim, 180);

    expect(sim.outcome).toBe('destroyed');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'shipDestroyed', shipId: sim.player.id, cause: 'enemy' }),
    );
  });

  it('keeps the score earned before the end', () => {
    const sim = new GameSimulation(sandbox(120), ARENA);
    const target = createEnemy(500, 'shooter', shooter, sim.player.x + 200, sim.player.y, 0);
    target.health = 1;
    sim.enemies.push(target);
    run(sim, 30, { fireFront: true });
    expect(sim.score).toBe(1);

    sim.player.health = 0;
    run(sim, 1);
    expect(sim.outcome).toBe('destroyed');
    expect(sim.score).toBe(1);
  });
});
