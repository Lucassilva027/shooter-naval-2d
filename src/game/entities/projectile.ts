import type { ProjectileConfig } from '@/config/gameConfig';

export type Faction = 'player' | 'enemy';

export interface Projectile {
  readonly id: number;
  /** Projectiles only damage ships of the other faction. */
  readonly faction: Faction;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  readonly damage: number;
  remainingSeconds: number;
  /** Cleared on the step it hits or expires; dead projectiles never deal damage again. */
  alive: boolean;
}

export function createProjectile(
  id: number,
  faction: Faction,
  x: number,
  y: number,
  direction: number,
  config: ProjectileConfig,
): Projectile {
  return {
    id,
    faction,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(direction) * config.speed,
    vy: Math.sin(direction) * config.speed,
    radius: config.radius,
    damage: config.damage,
    remainingSeconds: config.lifetimeSeconds,
    alive: true,
  };
}
