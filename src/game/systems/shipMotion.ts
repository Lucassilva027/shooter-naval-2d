import type { ShipMotionConfig } from '@/config/gameConfig';
import { wrapAngle } from '../core/math';
import type { Ship } from '../entities/ship';

export interface MotionControls {
  readonly throttle: boolean;
  readonly brake: boolean;
  /** -1 turns left (counter-clockwise on screen), 1 turns right. */
  readonly turn: -1 | 0 | 1;
}

/** Ships only sail forward: throttle accelerates, brake and drag slow down to a stop. */
export function stepShipMotion(
  ship: Ship,
  controls: MotionControls,
  motion: ShipMotionConfig,
  dt: number,
): void {
  if (controls.brake) {
    ship.speed = Math.max(0, ship.speed - motion.brakeDeceleration * dt);
  } else if (controls.throttle) {
    ship.speed = Math.min(motion.maxSpeed, ship.speed + motion.acceleration * dt);
  } else {
    ship.speed = Math.max(0, ship.speed - motion.drag * dt);
  }

  ship.rotation = wrapAngle(ship.rotation + controls.turn * motion.turnSpeed * dt);
  ship.x += Math.cos(ship.rotation) * ship.speed * dt;
  ship.y += Math.sin(ship.rotation) * ship.speed * dt;
}
