import type { GameConfig } from '@/config/gameConfig';
import type { InputSnapshot } from '../input/actions';
import { createShip, rememberPreviousState, type Ship } from '../entities/ship';
import { confineToArena, stepShipMotion, type MotionControls } from '../systems/shipMotion';
import type { Size } from './worldSize';

/**
 * Owns all continuous match state and advances it by fixed steps. Has no knowledge of
 * PixiJS, the DOM or React, so it can be unit-tested and driven by any clock.
 */
export class GameSimulation {
  readonly player: Ship;
  elapsedSeconds = 0;

  constructor(
    readonly config: GameConfig,
    readonly arena: Size,
  ) {
    this.player = createShip({
      x: arena.width / 2,
      y: arena.height / 2,
      rotation: 0,
      maxHealth: config.player.maxHealth,
      radius: config.player.radius,
    });
  }

  step(dt: number, input: InputSnapshot): void {
    rememberPreviousState(this.player);
    stepShipMotion(this.player, toMotionControls(input), this.config.player.motion, dt);
    confineToArena(this.player, this.arena);
    this.elapsedSeconds += dt;
  }
}

function toMotionControls(input: InputSnapshot): MotionControls {
  const turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  return { throttle: input.forward, brake: input.brake, turn: turn as MotionControls['turn'] };
}
