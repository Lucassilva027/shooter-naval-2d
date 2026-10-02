import type { HullCircle } from '@/config/gameConfig';

/**
 * Mutable ship state owned by the simulation. Angles use the math convention:
 * rotation 0 points along +x and positive values turn clockwise on screen (y grows down).
 */
export interface Ship {
  readonly id: number;
  x: number;
  y: number;
  rotation: number;
  speed: number;
  health: number;
  readonly maxHealth: number;
  readonly maxSpeed: number;
  readonly hull: readonly HullCircle[];
  /** Radius of a circle around (x, y) that encloses the whole hull; used for broad checks. */
  readonly boundingRadius: number;
  /** State at the start of the latest step, used for render interpolation. */
  prevX: number;
  prevY: number;
  prevRotation: number;
}

export interface ShipSpawn {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly maxHealth: number;
  readonly maxSpeed: number;
  readonly hull: readonly HullCircle[];
}

export function createShip(spawn: ShipSpawn): Ship {
  if (spawn.hull.length === 0) throw new RangeError('A ship needs at least one hull circle');
  return {
    id: spawn.id,
    x: spawn.x,
    y: spawn.y,
    rotation: spawn.rotation,
    speed: 0,
    health: spawn.maxHealth,
    maxHealth: spawn.maxHealth,
    maxSpeed: spawn.maxSpeed,
    hull: spawn.hull,
    boundingRadius: Math.max(...spawn.hull.map((c) => Math.abs(c.offset) + c.radius)),
    prevX: spawn.x,
    prevY: spawn.y,
    prevRotation: spawn.rotation,
  };
}

export function rememberPreviousState(ship: Ship): void {
  ship.prevX = ship.x;
  ship.prevY = ship.y;
  ship.prevRotation = ship.rotation;
}
