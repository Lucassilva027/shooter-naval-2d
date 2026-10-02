import type { ShooterConfig, SteeringConfig } from '@/config/gameConfig';
import { wrapAngle } from '../core/math';
import type { Size } from '../core/worldSize';
import type { Island } from '../entities/island';
import type { Ship } from '../entities/ship';
import { circlesOverlap } from './collision';
import type { MotionControls } from './shipMotion';

export interface Surroundings {
  readonly arena: Size;
  readonly islands: readonly Island[];
}

/** Chasers sail flat out towards the player, steering around islands. */
export function chaserControls(
  self: Ship,
  target: Ship,
  steering: SteeringConfig,
  world: Surroundings,
): MotionControls {
  const heading = avoidObstacles(self, angleTo(self, target), steering, world);
  return { throttle: true, brake: false, turn: turnTowards(self, heading, steering) };
}

/** Shooters close in to their hold distance, then stop and keep their bow on the player. */
export function shooterControls(
  self: Ship,
  target: Ship,
  config: ShooterConfig,
  steering: SteeringConfig,
  world: Surroundings,
): MotionControls {
  const distance = Math.hypot(target.x - self.x, target.y - self.y);
  const approaching = distance > config.attackRange * config.holdDistanceRatio;
  const desired = angleTo(self, target);
  const heading = approaching ? avoidObstacles(self, desired, steering, world) : desired;
  return {
    throttle: approaching,
    brake: !approaching,
    turn: turnTowards(self, heading, steering),
  };
}

/** True when a Shooter is in range, aimed, and has a clear line of fire. */
export function shooterCanFire(
  self: Ship,
  target: Ship,
  config: ShooterConfig,
  islands: readonly Island[],
): boolean {
  const distance = Math.hypot(target.x - self.x, target.y - self.y);
  if (distance > config.attackRange) return false;
  if (Math.abs(wrapAngle(angleTo(self, target) - self.rotation)) > config.aimTolerance)
    return false;
  return !islands.some((island) => segmentHitsIsland(self.x, self.y, target.x, target.y, island));
}

function angleTo(self: Ship, target: Ship): number {
  return Math.atan2(target.y - self.y, target.x - self.x);
}

function turnTowards(
  self: Ship,
  heading: number,
  steering: SteeringConfig,
): MotionControls['turn'] {
  const error = wrapAngle(heading - self.rotation);
  if (Math.abs(error) <= steering.turnDeadZone) return 0;
  return error > 0 ? 1 : -1;
}

/**
 * Probes ahead along the desired heading and two "whiskers" either side. When the path
 * is blocked by an island, veers towards the clearer side.
 */
function avoidObstacles(
  self: Ship,
  desired: number,
  steering: SteeringConfig,
  world: Surroundings,
): number {
  const clearance = hullHalfWidth(self);
  const blocked = (angle: number) =>
    probeBlocked(self, angle, steering.lookAhead, clearance, world);

  if (!blocked(desired)) return desired;
  const leftBlocked = blocked(desired - steering.whiskerAngle);
  const rightBlocked = blocked(desired + steering.whiskerAngle);
  if (leftBlocked && !rightBlocked) return desired + steering.avoidAngle;
  if (rightBlocked && !leftBlocked) return desired - steering.avoidAngle;
  // Both or neither side blocked: keep turning the way the ship is already facing.
  return wrapAngle(self.rotation - desired) >= 0
    ? desired + steering.avoidAngle
    : desired - steering.avoidAngle;
}

const PROBE_SAMPLES = 3;

function probeBlocked(
  self: Ship,
  angle: number,
  lookAhead: number,
  clearance: number,
  world: Surroundings,
): boolean {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let i = 1; i <= PROBE_SAMPLES; i++) {
    const distance = (lookAhead * i) / PROBE_SAMPLES;
    const x = self.x + cos * distance;
    const y = self.y + sin * distance;
    for (const island of world.islands) {
      if (!circlesOverlap(x, y, clearance, island.x, island.y, island.boundingRadius)) continue;
      if (island.colliders.some((c) => circlesOverlap(x, y, clearance, c.x, c.y, c.radius))) {
        return true;
      }
    }
  }
  return false;
}

function hullHalfWidth(ship: Ship): number {
  return Math.max(...ship.hull.map((circle) => circle.radius));
}

function segmentHitsIsland(ax: number, ay: number, bx: number, by: number, island: Island) {
  return island.colliders.some((c) => segmentHitsCircle(ax, ay, bx, by, c.x, c.y, c.radius));
}

function segmentHitsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSq));
  const px = ax + dx * t - cx;
  const py = ay + dy * t - cy;
  return px * px + py * py < radius * radius;
}
