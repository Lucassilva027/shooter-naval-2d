import type { GameEvent } from '../core/events';
import type { Size } from '../core/worldSize';
import type { Island } from '../entities/island';
import type { Projectile } from '../entities/projectile';
import type { Ship } from '../entities/ship';
import { circlesOverlap, shipOverlapsCircle } from './collision';

export interface ProjectileWorld {
  readonly arena: Size;
  readonly islands: readonly Island[];
  /** Ships a projectile of the given faction can damage. */
  targetsFor(projectile: Projectile): readonly Ship[];
  /** Called exactly once per hit, after damage has been applied. */
  onShipHit(ship: Ship, projectile: Projectile): void;
}

/**
 * Moves projectiles and resolves what they hit. A projectile is marked dead on the step
 * it hits anything, so it can never apply damage twice. Dead projectiles are removed
 * from the array in place.
 */
export function stepProjectiles(
  projectiles: Projectile[],
  world: ProjectileWorld,
  dt: number,
  events: GameEvent[],
): void {
  for (const projectile of projectiles) {
    if (!projectile.alive) continue;

    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.remainingSeconds -= dt;

    if (isOutsideArena(projectile, world.arena)) {
      projectile.alive = false;
      continue;
    }

    if (world.islands.some((island) => projectileHitsIsland(projectile, island))) {
      projectile.alive = false;
      events.push({ type: 'impact', surface: 'island', x: projectile.x, y: projectile.y });
      continue;
    }

    const target = world
      .targetsFor(projectile)
      .find((ship) => ship.health > 0 && shipOverlapsCircle(ship, projectile));
    if (target) {
      projectile.alive = false;
      target.health = Math.max(0, target.health - projectile.damage);
      events.push({
        type: 'impact',
        surface: 'ship',
        x: projectile.x,
        y: projectile.y,
        shipId: target.id,
      });
      world.onShipHit(target, projectile);
      continue;
    }

    if (projectile.remainingSeconds <= 0) {
      projectile.alive = false;
      events.push({ type: 'impact', surface: 'water', x: projectile.x, y: projectile.y });
    }
  }

  removeDead(projectiles);
}

function isOutsideArena(projectile: Projectile, arena: Size): boolean {
  const r = projectile.radius;
  return (
    projectile.x < -r ||
    projectile.y < -r ||
    projectile.x > arena.width + r ||
    projectile.y > arena.height + r
  );
}

function projectileHitsIsland(projectile: Projectile, island: Island): boolean {
  const { x, y, radius } = projectile;
  if (!circlesOverlap(x, y, radius, island.x, island.y, island.boundingRadius)) return false;
  return island.colliders.some((c) => circlesOverlap(x, y, radius, c.x, c.y, c.radius));
}

function removeDead(projectiles: Projectile[]): void {
  let write = 0;
  for (const projectile of projectiles) {
    if (projectile.alive) projectiles[write++] = projectile;
  }
  projectiles.length = write;
}
