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

export interface PlayerConfig {
  readonly maxHealth: number;
  /** Collision radius. */
  readonly radius: number;
  readonly motion: ShipMotionConfig;
}

export interface GameConfig {
  readonly simulation: SimulationConfig;
  readonly world: WorldConfig;
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
  player: {
    maxHealth: 100,
    radius: 28,
    motion: {
      maxSpeed: 220,
      acceleration: 160,
      brakeDeceleration: 160,
      drag: 45,
      turnSpeed: Math.PI * 0.85,
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
