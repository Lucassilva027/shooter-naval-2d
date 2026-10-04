import type { Size } from '../core/worldSize';
import type { Circle, Island } from '../entities/island';
import type { Ship } from '../entities/ship';

const EPSILON = 1e-6;
/** Extra separation applied when pushing out, so resolved shapes end up clearly apart. */
const CONTACT_SLOP = 0.01;

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const reach = ar + br;
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < reach * reach;
}

/** True when any hull circle of the ship overlaps the given circle. */
export function shipOverlapsCircle(ship: Ship, circle: Circle): boolean {
  if (!circlesOverlap(ship.x, ship.y, ship.boundingRadius, circle.x, circle.y, circle.radius)) {
    return false;
  }
  const cos = Math.cos(ship.rotation);
  const sin = Math.sin(ship.rotation);
  for (const hull of ship.hull) {
    const hx = ship.x + cos * hull.offset;
    const hy = ship.y + sin * hull.offset;
    if (circlesOverlap(hx, hy, hull.radius, circle.x, circle.y, circle.radius)) return true;
  }
  return false;
}

/** True when any hull circle of `a` overlaps any hull circle of `b`. */
export function shipsOverlap(a: Ship, b: Ship): boolean {
  if (!circlesOverlap(a.x, a.y, a.boundingRadius, b.x, b.y, b.boundingRadius)) return false;
  const cosA = Math.cos(a.rotation);
  const sinA = Math.sin(a.rotation);
  const cosB = Math.cos(b.rotation);
  const sinB = Math.sin(b.rotation);
  for (const hullA of a.hull) {
    for (const hullB of b.hull) {
      if (
        circlesOverlap(
          a.x + cosA * hullA.offset,
          a.y + sinA * hullA.offset,
          hullA.radius,
          b.x + cosB * hullB.offset,
          b.y + sinB * hullB.offset,
          hullB.radius,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function shipOverlapsIsland(ship: Ship, island: Island): boolean {
  if (
    !circlesOverlap(ship.x, ship.y, ship.boundingRadius, island.x, island.y, island.boundingRadius)
  ) {
    return false;
  }
  return island.colliders.some((collider) => shipOverlapsCircle(ship, collider));
}

/** True when any hull circle is within `margin` of the island's coast. */
export function shipNearIsland(ship: Ship, island: Island, margin: number): boolean {
  if (
    !circlesOverlap(
      ship.x,
      ship.y,
      ship.boundingRadius + margin,
      island.x,
      island.y,
      island.boundingRadius,
    )
  ) {
    return false;
  }
  return island.colliders.some((collider) =>
    shipOverlapsCircle(ship, { ...collider, radius: collider.radius + margin }),
  );
}

/**
 * Pushes the hull out of every island collider it overlaps and removes the part of its
 * speed that points into the coast: a head-on hit stops the ship, a glancing one lets it
 * slide along. Returns true when a collision was resolved.
 */
export function resolveShipVsIsland(ship: Ship, island: Island): boolean {
  if (
    !circlesOverlap(ship.x, ship.y, ship.boundingRadius, island.x, island.y, island.boundingRadius)
  ) {
    return false;
  }

  let hit = false;
  for (const collider of island.colliders) {
    for (const hull of ship.hull) {
      const cos = Math.cos(ship.rotation);
      const sin = Math.sin(ship.rotation);
      const dx = ship.x + cos * hull.offset - collider.x;
      const dy = ship.y + sin * hull.offset - collider.y;
      const reach = hull.radius + collider.radius;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= reach * reach) continue;

      const distance = Math.sqrt(distanceSq);
      // A hull circle exactly on a collider centre is pushed straight back.
      const nx = distance > EPSILON ? dx / distance : -cos;
      const ny = distance > EPSILON ? dy / distance : -sin;
      ship.x += nx * (reach - distance + CONTACT_SLOP);
      ship.y += ny * (reach - distance + CONTACT_SLOP);
      absorbImpact(ship, nx, ny);
      hit = true;
    }
  }
  return hit;
}

/** Keeps the whole hull inside the arena, with the same speed loss as a coast hit. */
export function confineToArena(ship: Ship, arena: Size): boolean {
  const cos = Math.cos(ship.rotation);
  const sin = Math.sin(ship.rotation);
  let pushX = 0;
  let pushY = 0;

  for (const hull of ship.hull) {
    const hx = ship.x + cos * hull.offset;
    const hy = ship.y + sin * hull.offset;
    pushX = largestPush(pushX, hull.radius - hx, arena.width - hull.radius - hx);
    pushY = largestPush(pushY, hull.radius - hy, arena.height - hull.radius - hy);
  }
  if (pushX === 0 && pushY === 0) return false;

  ship.x += pushX;
  ship.y += pushY;
  const length = Math.hypot(pushX, pushY);
  absorbImpact(ship, pushX / length, pushY / length);
  return true;
}

/** Separates two overlapping ships by moving each half of every hull overlap apart. */
export function separateShips(a: Ship, b: Ship): boolean {
  if (!circlesOverlap(a.x, a.y, a.boundingRadius, b.x, b.y, b.boundingRadius)) return false;

  let hit = false;
  for (const hullA of a.hull) {
    for (const hullB of b.hull) {
      const ax = a.x + Math.cos(a.rotation) * hullA.offset;
      const ay = a.y + Math.sin(a.rotation) * hullA.offset;
      const dx = b.x + Math.cos(b.rotation) * hullB.offset - ax;
      const dy = b.y + Math.sin(b.rotation) * hullB.offset - ay;
      const reach = hullA.radius + hullB.radius;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= reach * reach) continue;

      const distance = Math.sqrt(distanceSq);
      const nx = distance > EPSILON ? dx / distance : 1;
      const ny = distance > EPSILON ? dy / distance : 0;
      const half = (reach - distance + CONTACT_SLOP) / 2;
      a.x -= nx * half;
      a.y -= ny * half;
      b.x += nx * half;
      b.y += ny * half;
      hit = true;
    }
  }
  return hit;
}

/** `minPush` > 0 means the circle sticks out of the low edge, `maxPush` < 0 the high edge. */
function largestPush(current: number, minPush: number, maxPush: number): number {
  if (minPush > 0) return Math.max(current, minPush);
  if (maxPush < 0) return Math.min(current, maxPush);
  return current;
}

/**
 * `(nx, ny)` is the unit normal pointing away from the surface that was hit. Caps the
 * speed by how directly the bow points into the surface; a cap (rather than a per-step
 * multiplier) keeps a ship in sustained contact from grinding to a halt while sliding.
 */
function absorbImpact(ship: Ship, nx: number, ny: number): void {
  const into = -(Math.cos(ship.rotation) * nx + Math.sin(ship.rotation) * ny);
  if (into > 0) ship.speed = Math.min(ship.speed, ship.maxSpeed * (1 - into));
}
