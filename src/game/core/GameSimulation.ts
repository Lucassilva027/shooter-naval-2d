import type { GameConfig } from '@/config/gameConfig';
import type { InputSnapshot } from '../input/actions';
import { placeIslands, type Island } from '../entities/island';
import { createShip, rememberPreviousState, type Ship } from '../entities/ship';
import { confineToArena, resolveShipVsIsland } from '../systems/collision';
import { stepShipMotion, type MotionControls } from '../systems/shipMotion';
import type { Size } from './worldSize';

const STATIC_RESOLVE_PASSES = 3;

/**
 * Owns all continuous match state and advances it by fixed steps. Has no knowledge of
 * PixiJS, the DOM or React, so it can be unit-tested and driven by any clock.
 */
export class GameSimulation {
  readonly player: Ship;
  readonly islands: readonly Island[];
  elapsedSeconds = 0;

  constructor(
    readonly config: GameConfig,
    readonly arena: Size,
  ) {
    this.islands = placeIslands(config.arena.islands, arena);
    this.player = createShip({
      x: config.arena.playerSpawn.x * arena.width,
      y: config.arena.playerSpawn.y * arena.height,
      rotation: 0,
      maxHealth: config.player.maxHealth,
      maxSpeed: config.player.motion.maxSpeed,
      hull: config.player.hull,
    });
  }

  step(dt: number, input: InputSnapshot): void {
    rememberPreviousState(this.player);
    stepShipMotion(this.player, toMotionControls(input), this.config.player.motion, dt);
    this.resolveStaticCollisions(this.player);
    this.elapsedSeconds += dt;
  }

  /** Pushing out of one collider can nudge the hull into a neighbour, so resolve a few times. */
  private resolveStaticCollisions(ship: Ship): void {
    for (let pass = 0; pass < STATIC_RESOLVE_PASSES; pass++) {
      let hit = confineToArena(ship, this.arena);
      for (const island of this.islands) hit = resolveShipVsIsland(ship, island) || hit;
      if (!hit) return;
    }
  }
}

function toMotionControls(input: InputSnapshot): MotionControls {
  const turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  return { throttle: input.forward, brake: input.brake, turn: turn as MotionControls['turn'] };
}
