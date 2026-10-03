import { expect, it } from 'vitest';
import { defaultGameConfig } from '@/config/gameConfig';
import { GameSimulation } from './GameSimulation';
import { EMPTY_INPUT } from '../input/actions';

it('profiles entity counts through a three-minute sustained simulation', () => {
  const config = {
    ...defaultGameConfig,
    match: { ...defaultGameConfig.match, durationSeconds: 180 },
    player: { ...defaultGameConfig.player, maxHealth: 10_000 },
  };
  const sim = new GameSimulation(config, { width: 1280, height: 720 }, 146);
  let peakEnemyCount = 0;
  let peakProjectileCount = 0;
  const startedAt = performance.now();

  while (!sim.outcome) {
    sim.step(1 / 60, EMPTY_INPUT);
    sim.drainEvents();
    peakEnemyCount = Math.max(peakEnemyCount, sim.enemies.length);
    peakProjectileCount = Math.max(peakProjectileCount, sim.projectiles.length);
  }

  const elapsedProfileMs = performance.now() - startedAt;
  const result = {
    simulatedMatchSeconds: sim.elapsedSeconds,
    outcome: sim.outcome,
    peakEnemyCount,
    peakProjectileCount,
    peakGameplayEntityCount: 1 + peakEnemyCount + peakProjectileCount,
    finalEnemyCount: sim.enemies.length,
    finalProjectileCount: sim.projectiles.length,
    simulationRuntimeMs: elapsedProfileMs,
  };
  console.log(`SIMULATION_PROFILE=${JSON.stringify(result)}`);
  expect(sim.outcome).toBe('timeout');
  expect(sim.elapsedSeconds).toBe(180);
  expect(peakEnemyCount).toBeGreaterThan(0);
});
