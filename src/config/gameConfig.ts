/**
 * Single source of truth for gameplay tuning. Systems read their parameters from a
 * `GameConfig` snapshot taken when a match starts, so balancing never requires
 * touching system logic.
 *
 * Units: distances in world units (1 unit = 1 CSS pixel at scale 1), time in seconds,
 * angles in radians, speeds in units/second, angular speeds in radians/second.
 */

export interface SimulationConfig {
  /** Duration of one fixed simulation step. */
  readonly fixedStepSeconds: number;
  /** Upper bound for a single frame delta; longer stalls are dropped, not replayed. */
  readonly maxFrameSeconds: number;
}

/**
 * The world size is derived from the viewport when a match starts and stays fixed for
 * the whole match; later resizes only change the render scale.
 */
export interface WorldConfig {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
}

export type IslandArt = 'sandIsland' | 'grassIsland' | 'rock';

export interface IslandPreset {
  readonly art: IslandArt;
  /** Centre as a fraction of the arena size (0-1), so the layout scales with the world. */
  readonly x: number;
  readonly y: number;
  /** Half of the island's visible extent in world units; colliders scale with it. */
  readonly radius: number;
}

export interface ArenaConfig {
  /** Each match picks a layout reproducibly from its seed. */
  readonly layouts: readonly (readonly IslandPreset[])[];
  /** Player spawn as a fraction of the arena size; must stay clear of every island. */
  readonly playerSpawn: { readonly x: number; readonly y: number };
}

export interface ShipMotionConfig {
  readonly maxSpeed: number;
  /** Speed gained per second while the throttle is held. */
  readonly acceleration: number;
  /** Speed lost per second while braking. */
  readonly brakeDeceleration: number;
  /** Speed lost per second when neither throttle nor brake is held. */
  readonly drag: number;
  readonly turnSpeed: number;
}

/** A collision circle centred on the ship's bow-stern axis (positive offset = towards the bow). */
export interface HullCircle {
  readonly offset: number;
  readonly radius: number;
}

export interface ProjectileConfig {
  readonly speed: number;
  /** Range is `speed * lifetimeSeconds`. */
  readonly lifetimeSeconds: number;
  readonly damage: number;
  readonly radius: number;
}

export interface FrontWeaponConfig {
  readonly cooldownSeconds: number;
  /** Distance ahead of the ship centre where the shot spawns. */
  readonly muzzleOffset: number;
  readonly projectile: ProjectileConfig;
}

export interface BroadsideWeaponConfig {
  /** Each side has its own cooldown of this length. */
  readonly cooldownSeconds: number;
  /** Bow-stern positions of the parallel shots, relative to the ship centre. */
  readonly shotOffsets: readonly number[];
  /** Distance to the side of the ship centre where the shots spawn. */
  readonly muzzleOffset: number;
  readonly projectile: ProjectileConfig;
}

export interface PlayerConfig {
  readonly maxHealth: number;
  /** Circles approximating the elongated hull, used for every collision test. */
  readonly hull: readonly HullCircle[];
  readonly motion: ShipMotionConfig;
  readonly weapons: {
    readonly front: FrontWeaponConfig;
    readonly broadside: BroadsideWeaponConfig;
  };
}

export type EnemyKind = 'chaser' | 'shooter';

export interface SpawnConfig {
  /** Seconds between spawns; exposed in Options as "Enemy spawn time". */
  readonly intervalSeconds: number;
  /** Delay before the first spawn of a match. */
  readonly initialDelaySeconds: number;
  /** When this many enemies are alive, the next spawn waits for a free slot. */
  readonly maxAlive: number;
  /** Kinds spawned first, in order, so both types appear early in every match. */
  readonly openingOrder: readonly EnemyKind[];
  /** Probability (0-1) that a spawn after the opening order is a Chaser. */
  readonly chaserWeight: number;
  /** Spawn points are at least this far from the player. */
  readonly minDistanceFromPlayer: number;
  /** Extra clearance around islands and other ships at the spawn point. */
  readonly clearance: number;
  /** Random positions tried per spawn before giving up until the next step. */
  readonly maxAttempts: number;
}

export interface SteeringConfig {
  /** How far ahead enemies probe for islands. */
  readonly lookAhead: number;
  /** Angle of the side probes relative to the heading. */
  readonly whiskerAngle: number;
  /** Heading change applied to steer around a blocked path. */
  readonly avoidAngle: number;
  /** Heading error below which the ship stops turning (prevents jitter). */
  readonly turnDeadZone: number;
}

export interface EnemyShipConfig {
  readonly maxHealth: number;
  readonly hull: readonly HullCircle[];
  readonly motion: ShipMotionConfig;
}

export interface ChaserConfig extends EnemyShipConfig {
  /** Damage dealt to the player on impact; the Chaser explodes. */
  readonly contactDamage: number;
}

export interface ShooterConfig extends EnemyShipConfig {
  /** Fires only when the player is within this distance. */
  readonly attackRange: number;
  /** Stops approaching at `attackRange * holdDistanceRatio`. */
  readonly holdDistanceRatio: number;
  /** Fires only when its bow points within this angle of the player. */
  readonly aimTolerance: number;
  readonly weapon: FrontWeaponConfig;
}

export interface EnemiesConfig {
  readonly spawn: SpawnConfig;
  readonly steering: SteeringConfig;
  readonly chaser: ChaserConfig;
  readonly shooter: ShooterConfig;
}

export interface MatchRulesConfig {
  /** Match length; exposed in Options as "Match duration". */
  readonly durationSeconds: number;
  /** Real seconds the final scene plays (sinking ship / "Time's up!") before the result. */
  readonly outroSeconds: number;
  /** The timer turns into a warning (red, pulsing, ticking) at this many seconds left. */
  readonly lowTimeSeconds: number;
  /** Health at or below this fraction of max counts as "low" (warning sound, announcement). */
  readonly lowHealthRatio: number;
}

export interface GameConfig {
  readonly match: MatchRulesConfig;
  readonly simulation: SimulationConfig;
  readonly world: WorldConfig;
  readonly arena: ArenaConfig;
  readonly player: PlayerConfig;
  readonly enemies: EnemiesConfig;
}

/** Settings the player can change in Options. */
export interface GameOptions {
  readonly matchDurationSeconds: number;
  readonly enemySpawnSeconds: number;
}

export interface OptionLimit {
  readonly min: number;
  readonly max: number;
  /** Values are always `min + k * step`. */
  readonly step: number;
  readonly default: number;
}

/** Documented limits for the values exposed in Options. */
export const OPTION_LIMITS: Readonly<Record<keyof GameOptions, OptionLimit>> = {
  matchDurationSeconds: { min: 60, max: 180, step: 10, default: 120 },
  enemySpawnSeconds: { min: 1, max: 15, step: 1, default: 4 },
};

export const DEFAULT_OPTIONS: GameOptions = {
  matchDurationSeconds: OPTION_LIMITS.matchDurationSeconds.default,
  enemySpawnSeconds: OPTION_LIMITS.enemySpawnSeconds.default,
};

/** Clamps into the limits and snaps to the step grid; non-numbers fall back to the default. */
export function normalizeOption(value: unknown, limit: OptionLimit): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return limit.default;
  const clamped = Math.min(limit.max, Math.max(limit.min, value));
  const snapped = limit.min + Math.round((clamped - limit.min) / limit.step) * limit.step;
  return Math.min(limit.max, snapped);
}

const SHIP_HULL: readonly HullCircle[] = [
  { offset: 30, radius: 22 },
  { offset: 0, radius: 27 },
  { offset: -30, radius: 22 },
];

export const defaultGameConfig: GameConfig = {
  match: {
    durationSeconds: OPTION_LIMITS.matchDurationSeconds.default,
    outroSeconds: 1.5,
    lowTimeSeconds: 10,
    lowHealthRatio: 0.25,
  },
  simulation: {
    fixedStepSeconds: 1 / 60,
    maxFrameSeconds: 0.25,
  },
  world: {
    minWidth: 1024,
    minHeight: 576,
    maxWidth: 1920,
    maxHeight: 1080,
  },
  arena: {
    layouts: [
      [
        { art: 'grassIsland', x: 0.24, y: 0.32, radius: 105 },
        { art: 'sandIsland', x: 0.74, y: 0.7, radius: 80 },
        { art: 'rock', x: 0.66, y: 0.24, radius: 34 },
        { art: 'sandIsland', x: 0.3, y: 0.78, radius: 54 },
      ],
      [
        { art: 'grassIsland', x: 0.2, y: 0.23, radius: 92 },
        { art: 'sandIsland', x: 0.82, y: 0.28, radius: 90 },
        { art: 'rock', x: 0.5, y: 0.13, radius: 26 },
        { art: 'grassIsland', x: 0.75, y: 0.78, radius: 82 },
      ],
      [
        { art: 'sandIsland', x: 0.18, y: 0.38, radius: 82 },
        { art: 'grassIsland', x: 0.78, y: 0.62, radius: 112 },
        { art: 'rock', x: 0.48, y: 0.14, radius: 34 },
        { art: 'sandIsland', x: 0.53, y: 0.85, radius: 60 },
      ],
    ],
    playerSpawn: { x: 0.5, y: 0.5 },
  },
  player: {
    maxHealth: 100,
    hull: SHIP_HULL,
    motion: {
      maxSpeed: 220,
      acceleration: 160,
      brakeDeceleration: 160,
      drag: 45,
      turnSpeed: Math.PI * 0.85,
    },
    weapons: {
      front: {
        cooldownSeconds: 0.4,
        muzzleOffset: 58,
        projectile: { speed: 420, lifetimeSeconds: 1.2, damage: 20, radius: 6 },
      },
      broadside: {
        cooldownSeconds: 1.5,
        shotOffsets: [26, 0, -26],
        muzzleOffset: 32,
        projectile: { speed: 420, lifetimeSeconds: 1.2, damage: 15, radius: 6 },
      },
    },
  },
  enemies: {
    spawn: {
      intervalSeconds: OPTION_LIMITS.enemySpawnSeconds.default,
      initialDelaySeconds: 4,
      maxAlive: 8,
      openingOrder: ['chaser', 'shooter'],
      chaserWeight: 0.6,
      minDistanceFromPlayer: 380,
      clearance: 24,
      maxAttempts: 60,
    },
    steering: {
      lookAhead: 150,
      whiskerAngle: 0.45,
      avoidAngle: 1.1,
      turnDeadZone: 0.05,
    },
    chaser: {
      maxHealth: 40,
      hull: SHIP_HULL,
      contactDamage: 20,
      motion: {
        maxSpeed: 130,
        acceleration: 200,
        brakeDeceleration: 200,
        drag: 45,
        turnSpeed: Math.PI * 0.72,
      },
    },
    shooter: {
      maxHealth: 60,
      hull: SHIP_HULL,
      attackRange: 380,
      holdDistanceRatio: 0.8,
      aimTolerance: 0.2,
      motion: {
        maxSpeed: 120,
        acceleration: 120,
        brakeDeceleration: 160,
        drag: 45,
        turnSpeed: Math.PI * 0.7,
      },
      weapon: {
        cooldownSeconds: 1.6,
        muzzleOffset: 58,
        projectile: { speed: 340, lifetimeSeconds: 1.3, damage: 10, radius: 6 },
      },
    },
  },
};

/**
 * Immutable snapshot used by a single match, with the player's options applied. Later
 * option changes only affect new matches.
 */
export function createMatchConfig(
  options: GameOptions = DEFAULT_OPTIONS,
  base: GameConfig = defaultGameConfig,
): GameConfig {
  const config = structuredClone(base);
  return deepFreeze({
    ...config,
    match: {
      ...config.match,
      durationSeconds: normalizeOption(
        options.matchDurationSeconds,
        OPTION_LIMITS.matchDurationSeconds,
      ),
    },
    enemies: {
      ...config.enemies,
      spawn: {
        ...config.enemies.spawn,
        intervalSeconds: normalizeOption(
          options.enemySpawnSeconds,
          OPTION_LIMITS.enemySpawnSeconds,
        ),
      },
    },
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
