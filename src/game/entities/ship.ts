/**
 * Mutable ship state owned by the simulation. Angles use the math convention:
 * rotation 0 points along +x and positive values turn clockwise on screen (y grows down).
 */
export interface Ship {
  x: number;
  y: number;
  rotation: number;
  speed: number;
  health: number;
  readonly maxHealth: number;
  readonly radius: number;
  /** State at the start of the latest step, used for render interpolation. */
  prevX: number;
  prevY: number;
  prevRotation: number;
}

export interface ShipSpawn {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly maxHealth: number;
  readonly radius: number;
}

export function createShip(spawn: ShipSpawn): Ship {
  return {
    x: spawn.x,
    y: spawn.y,
    rotation: spawn.rotation,
    speed: 0,
    health: spawn.maxHealth,
    maxHealth: spawn.maxHealth,
    radius: spawn.radius,
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
