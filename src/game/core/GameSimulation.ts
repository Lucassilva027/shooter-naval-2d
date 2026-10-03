import type { EnemyKind, GameConfig, ProjectileConfig } from '@/config/gameConfig';
import type { InputSnapshot } from '../input/actions';
import { createEnemy, type Enemy } from '../entities/enemy';
import { placeIslands, selectIslandLayout, type Island } from '../entities/island';
import { createProjectile, type Projectile } from '../entities/projectile';
import { createShip, hullBoundingRadius, rememberPreviousState, type Ship } from '../entities/ship';
import {
  confineToArena,
  resolveShipVsIsland,
  separateShips,
  shipsOverlap,
} from '../systems/collision';
import { chaserControls, shooterCanFire, shooterControls } from '../systems/enemyAi';
import { stepProjectiles, type ProjectileWorld } from '../systems/projectiles';
import { stepShipMotion, type MotionControls } from '../systems/shipMotion';
import { createSpawnerState, stepSpawner, type SpawnerState } from '../systems/spawner';
import {
  broadsideShots,
  createCooldown,
  frontShot,
  tickCooldown,
  type ShotRequest,
} from '../systems/weapons';
import type { GameEvent, MatchOutcome } from './events';
import { createRandom, type Random } from './random';
import type { Size } from './worldSize';

const STATIC_RESOLVE_PASSES = 3;
const PLAYER_ID = 0;
/** Absorbs floating-point drift from summing thousands of fixed steps. */
const TIME_EPSILON = 1e-6;

/**
 * Owns all continuous match state and advances it by fixed steps. Has no knowledge of
 * PixiJS, the DOM or React, so it can be unit-tested and driven by any clock. All
 * randomness comes from the seeded generator, so a seed reproduces a match exactly.
 */
export class GameSimulation {
  readonly player: Ship;
  readonly islands: readonly Island[];
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  /** Enemies sunk by the player's cannons. */
  score = 0;
  elapsedSeconds = 0;
  /** Set once the match ends; from then on `step` is a no-op and the score is final. */
  outcome: MatchOutcome | null = null;

  private readonly random: Random;
  private readonly events: GameEvent[] = [];
  private readonly rockContacts = new WeakMap<Ship, ReadonlySet<Island>>();
  private nextEntityId = PLAYER_ID + 1;
  private readonly playerTargets: readonly Ship[];
  private readonly spawner: SpawnerState;
  private readonly enemyRadius: number;
  private readonly projectileWorld: ProjectileWorld;
  private readonly playerCooldowns = {
    front: createCooldown(),
    left: createCooldown(),
    right: createCooldown(),
  };

  constructor(
    readonly config: GameConfig,
    readonly arena: Size,
    readonly seed = 1,
  ) {
    this.random = createRandom(seed);
    this.islands = placeIslands(selectIslandLayout(config.arena.layouts, seed), arena);
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
    this.spawner = createSpawnerState(config.enemies.spawn);
    this.enemyRadius = Math.max(
      hullBoundingRadius(config.enemies.chaser.hull),
      hullBoundingRadius(config.enemies.shooter.hull),
    );
    this.projectileWorld = {
      arena,
      islands: this.islands,
      targetsFor: (projectile) =>
        projectile.faction === 'enemy' ? this.playerTargets : this.enemies,
      onShipHit: (ship, projectile) => {
        if (ship !== this.player && ship.health <= 0) {
          this.destroyEnemy(ship as Enemy, projectile.faction === 'player' ? 'player' : 'enemy');
        }
      },
    };
  }

  get remainingSeconds(): number {
    return Math.max(0, this.config.match.durationSeconds - this.elapsedSeconds);
  }

  step(dt: number, input: InputSnapshot): void {
    if (this.outcome) return;

    rememberPreviousState(this.player);
    for (const enemy of this.enemies) rememberPreviousState(enemy);

    stepShipMotion(this.player, toMotionControls(input), this.config.player.motion, dt);
    for (const enemy of this.enemies) this.steerEnemy(enemy, dt);

    this.resolveShipContacts();
    if (this.endIfPlayerSunk('collision')) return;
    this.resolveStaticCollisions(this.player);
    if (this.endIfPlayerSunk('collision')) return;
    for (const enemy of this.enemies) this.resolveStaticCollisions(enemy);
    this.removeSunkEnemies();

    stepProjectiles(this.projectiles, this.projectileWorld, dt, this.events);
    this.removeSunkEnemies();
    if (this.endIfPlayerSunk('enemy')) return;

    this.firePlayerWeapons(input, dt);
    this.fireEnemyWeapons(dt);
    this.spawnEnemies(dt);

    this.elapsedSeconds += dt;
    if (this.remainingSeconds <= TIME_EPSILON) {
      this.elapsedSeconds = this.config.match.durationSeconds;
      this.end('timeout');
    }
  }

  private endIfPlayerSunk(cause: 'enemy' | 'collision'): boolean {
    if (this.player.health > 0) return false;
    this.events.push({
      type: 'shipDestroyed',
      shipId: this.player.id,
      x: this.player.x,
      y: this.player.y,
      rotation: this.player.rotation,
      cause,
    });
    this.end('destroyed');
    return true;
  }

  private end(outcome: MatchOutcome): void {
    this.outcome = outcome;
    this.events.push({ type: 'matchEnded', outcome });
  }

  /** Returns and clears the events recorded since the previous call. */
  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private steerEnemy(enemy: Enemy, dt: number): void {
    const { chaser, shooter, steering } = this.config.enemies;
    const controls =
      enemy.kind === 'chaser'
        ? chaserControls(enemy, this.player, steering, this)
        : shooterControls(enemy, this.player, shooter, steering, this);
    stepShipMotion(enemy, controls, enemy.kind === 'chaser' ? chaser.motion : shooter.motion, dt);
  }

  /** Chasers explode on contact with the player; every other overlap just pushes apart. */
  private resolveShipContacts(): void {
    const { contactDamage } = this.config.enemies.chaser;
    for (const enemy of this.enemies) {
      if (enemy.health <= 0) continue;
      if (enemy.kind === 'chaser' && this.player.health > 0 && shipsOverlap(enemy, this.player)) {
        this.player.health = Math.max(0, this.player.health - contactDamage);
        this.events.push({
          type: 'impact',
          surface: 'ship',
          x: (enemy.x + this.player.x) / 2,
          y: (enemy.y + this.player.y) / 2,
          shipId: this.player.id,
        });
        enemy.health = 0;
        this.destroyEnemy(enemy, 'collision');
        continue;
      }
      separateShips(this.player, enemy);
    }
    this.removeSunkEnemies();

    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        separateShips(this.enemies[i] as Enemy, this.enemies[j] as Enemy);
      }
    }
  }

  private destroyEnemy(enemy: Enemy, cause: 'player' | 'enemy' | 'collision'): void {
    if (cause === 'player') this.score++;
    this.rockContacts.delete(enemy);
    this.events.push({
      type: 'shipDestroyed',
      shipId: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
      rotation: enemy.rotation,
      cause,
    });
  }

  /** Sunk enemies leave the simulation at once: no more damage, shots or collisions. */
  private removeSunkEnemies(): void {
    let write = 0;
    for (const enemy of this.enemies) {
      if (enemy.health > 0) this.enemies[write++] = enemy;
    }
    this.enemies.length = write;
  }

  /** Cooldowns tick every step; holding a fire key shoots whenever its weapon is ready. */
  private firePlayerWeapons(input: InputSnapshot, dt: number): void {
    const { front, broadside } = this.config.player.weapons;
    const cooldowns = this.playerCooldowns;

    if (tickCooldown(cooldowns.front, dt) && input.fireFront) {
      cooldowns.front.remaining = front.cooldownSeconds;
      this.spawnProjectiles([frontShot(this.player, 'player', front)], front.projectile);
    }
    if (tickCooldown(cooldowns.left, dt) && input.fireLeft) {
      cooldowns.left.remaining = broadside.cooldownSeconds;
      this.spawnProjectiles(
        broadsideShots(this.player, 'player', broadside, -1),
        broadside.projectile,
      );
    }
    if (tickCooldown(cooldowns.right, dt) && input.fireRight) {
      cooldowns.right.remaining = broadside.cooldownSeconds;
      this.spawnProjectiles(
        broadsideShots(this.player, 'player', broadside, 1),
        broadside.projectile,
      );
    }
  }

  private fireEnemyWeapons(dt: number): void {
    const { shooter } = this.config.enemies;
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'shooter') continue;
      if (!tickCooldown(enemy.weaponCooldown, dt)) continue;
      if (!shooterCanFire(enemy, this.player, shooter, this.islands)) continue;
      enemy.weaponCooldown.remaining = shooter.weapon.cooldownSeconds;
      this.spawnProjectiles([frontShot(enemy, 'enemy', shooter.weapon)], shooter.weapon.projectile);
    }
  }

  private spawnEnemies(dt: number): void {
    const plan = stepSpawner(
      this.spawner,
      this.config.enemies.spawn,
      {
        arena: this.arena,
        islands: this.islands,
        player: this.player,
        ships: this.enemies,
        enemyRadius: this.enemyRadius,
      },
      this.enemies.length,
      this.random,
      dt,
    );
    if (!plan) return;

    const id = this.nextEntityId++;
    const config = this.enemyConfig(plan.kind);
    this.enemies.push(createEnemy(id, plan.kind, config, plan.x, plan.y, plan.rotation));
    this.events.push({ type: 'enemySpawned', shipId: id, kind: plan.kind });
  }

  private enemyConfig(kind: EnemyKind) {
    return kind === 'chaser' ? this.config.enemies.chaser : this.config.enemies.shooter;
  }

  private spawnProjectiles(shots: readonly ShotRequest[], projectile: ProjectileConfig): void {
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
    const rockHits = new Set<Island>();
    for (let pass = 0; pass < STATIC_RESOLVE_PASSES; pass++) {
      let hit = confineToArena(ship, this.arena);
      for (const island of this.islands) {
        const islandHit = resolveShipVsIsland(ship, island);
        if (islandHit && island.art === 'rock') rockHits.add(island);
        hit = islandHit || hit;
      }
      if (!hit) break;
    }

    const previousContacts = this.rockContacts.get(ship);
    for (const rock of rockHits) {
      if (previousContacts?.has(rock) || ship.health <= 0) continue;
      ship.health = Math.max(0, ship.health - this.config.rockImpactDamage);
      this.events.push({ type: 'impact', surface: 'island', x: ship.x, y: ship.y });
      if (ship !== this.player && ship.health <= 0) {
        this.destroyEnemy(ship as Enemy, 'collision');
      }
    }
    if (rockHits.size > 0 && ship.health > 0) this.rockContacts.set(ship, rockHits);
    else this.rockContacts.delete(ship);
  }
}

function toMotionControls(input: InputSnapshot): MotionControls {
  const turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  return { throttle: input.forward, brake: input.brake, turn: turn as MotionControls['turn'] };
}
