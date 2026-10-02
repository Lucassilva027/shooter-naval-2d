import type { GameConfig, ProjectileConfig } from '@/config/gameConfig';
import type { InputSnapshot } from '../input/actions';
import { placeIslands, type Island } from '../entities/island';
import { createProjectile, type Projectile } from '../entities/projectile';
import { createShip, rememberPreviousState, type Ship } from '../entities/ship';
import { confineToArena, resolveShipVsIsland } from '../systems/collision';
import { stepProjectiles, type ProjectileWorld } from '../systems/projectiles';
import { stepShipMotion, type MotionControls } from '../systems/shipMotion';
import {
  broadsideShots,
  createCooldown,
  frontShot,
  tickCooldown,
  type ShotRequest,
} from '../systems/weapons';
import type { GameEvent } from './events';
import type { Size } from './worldSize';

const STATIC_RESOLVE_PASSES = 3;
const PLAYER_ID = 0;
const NO_SHIPS: readonly Ship[] = [];

/**
 * Owns all continuous match state and advances it by fixed steps. Has no knowledge of
 * PixiJS, the DOM or React, so it can be unit-tested and driven by any clock.
 */
export class GameSimulation {
  readonly player: Ship;
  private readonly playerTargets: readonly Ship[];
  readonly islands: readonly Island[];
  readonly projectiles: Projectile[] = [];
  elapsedSeconds = 0;

  private readonly events: GameEvent[] = [];
  private nextEntityId = PLAYER_ID + 1;
  private readonly playerCooldowns = {
    front: createCooldown(),
    left: createCooldown(),
    right: createCooldown(),
  };

  private readonly projectileWorld: ProjectileWorld;

  constructor(
    readonly config: GameConfig,
    readonly arena: Size,
  ) {
    this.islands = placeIslands(config.arena.islands, arena);
    this.projectileWorld = {
      arena,
      islands: this.islands,
      targetsFor: (projectile) => (projectile.faction === 'enemy' ? this.playerTargets : NO_SHIPS),
      onShipHit: () => undefined,
    };
    this.player = createShip({
      id: PLAYER_ID,
      x: config.arena.playerSpawn.x * arena.width,
      y: config.arena.playerSpawn.y * arena.height,
      rotation: 0,
      maxHealth: config.player.maxHealth,
      maxSpeed: config.player.motion.maxSpeed,
      hull: config.player.hull,
    });
    this.playerTargets = [this.player];
  }

  step(dt: number, input: InputSnapshot): void {
    rememberPreviousState(this.player);
    stepShipMotion(this.player, toMotionControls(input), this.config.player.motion, dt);
    this.resolveStaticCollisions(this.player);

    stepProjectiles(this.projectiles, this.projectileWorld, dt, this.events);
    this.firePlayerWeapons(input, dt);

    this.elapsedSeconds += dt;
  }

  /** Returns and clears the events recorded since the previous call. */
  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /** Cooldowns tick every step; holding a fire key shoots whenever its weapon is ready. */
  private firePlayerWeapons(input: InputSnapshot, dt: number): void {
    const { front, broadside } = this.config.player.weapons;
    const cooldowns = this.playerCooldowns;

    if (tickCooldown(cooldowns.front, dt) && input.fireFront) {
      cooldowns.front.remaining = front.cooldownSeconds;
      this.spawn([frontShot(this.player, 'player', front)], front.projectile);
    }
    if (tickCooldown(cooldowns.left, dt) && input.fireLeft) {
      cooldowns.left.remaining = broadside.cooldownSeconds;
      this.spawn(broadsideShots(this.player, 'player', broadside, -1), broadside.projectile);
    }
    if (tickCooldown(cooldowns.right, dt) && input.fireRight) {
      cooldowns.right.remaining = broadside.cooldownSeconds;
      this.spawn(broadsideShots(this.player, 'player', broadside, 1), broadside.projectile);
    }
  }

  private spawn(shots: readonly ShotRequest[], projectile: ProjectileConfig): void {
    for (const shot of shots) {
      this.projectiles.push(
        createProjectile(
          this.nextEntityId++,
          shot.faction,
          shot.x,
          shot.y,
          shot.direction,
          projectile,
        ),
      );
      this.events.push({ type: 'shot', ...shot });
    }
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
