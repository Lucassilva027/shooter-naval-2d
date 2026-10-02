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
  readonly islands: readonly IslandPreset[];
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

export interface GameConfig {
  readonly simulation: SimulationConfig;
  readonly world: WorldConfig;
  readonly arena: ArenaConfig;
  readonly player: PlayerConfig;
}

export const defaultGameConfig: GameConfig = {
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
    islands: [
      { art: 'grassIsland', x: 0.24, y: 0.32, radius: 105 },
      { art: 'sandIsland', x: 0.74, y: 0.7, radius: 80 },
      { art: 'rock', x: 0.66, y: 0.24, radius: 34 },
    ],
    playerSpawn: { x: 0.5, y: 0.5 },
  },
  player: {
    maxHealth: 100,
    hull: [
      { offset: 30, radius: 22 },
      { offset: 0, radius: 27 },
      { offset: -30, radius: 22 },
    ],
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
};

/** Immutable copy used by a single match; later option changes only affect new matches. */
export function createMatchConfig(base: GameConfig = defaultGameConfig): GameConfig {
  return deepFreeze(structuredClone(base));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
