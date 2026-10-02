import type { BroadsideWeaponConfig, FrontWeaponConfig } from '@/config/gameConfig';
import type { Ship } from '../entities/ship';
import type { Faction } from '../entities/projectile';
import type { WeaponKind } from '../core/events';

const READY_EPSILON = 1e-9;

export interface Cooldown {
  remaining: number;
}

export function createCooldown(): Cooldown {
  return { remaining: 0 };
}

/** Advances a cooldown and returns true when it is ready to fire. */
export function tickCooldown(cooldown: Cooldown, dt: number): boolean {
  cooldown.remaining = Math.max(0, cooldown.remaining - dt);
  return cooldown.remaining <= READY_EPSILON;
}

export interface ShotRequest {
  readonly faction: Faction;
  readonly weapon: WeaponKind;
  readonly x: number;
  readonly y: number;
  readonly direction: number;
}

export function frontShot(ship: Ship, faction: Faction, weapon: FrontWeaponConfig): ShotRequest {
  return {
    faction,
    weapon: 'front',
    x: ship.x + Math.cos(ship.rotation) * weapon.muzzleOffset,
    y: ship.y + Math.sin(ship.rotation) * weapon.muzzleOffset,
    direction: ship.rotation,
  };
}

/** Parallel shots fired perpendicular to the hull; side -1 is port (left), 1 is starboard. */
export function broadsideShots(
  ship: Ship,
  faction: Faction,
  weapon: BroadsideWeaponConfig,
  side: -1 | 1,
): ShotRequest[] {
  const direction = ship.rotation + (side * Math.PI) / 2;
  const forwardX = Math.cos(ship.rotation);
  const forwardY = Math.sin(ship.rotation);
  const sideX = Math.cos(direction);
  const sideY = Math.sin(direction);

  return weapon.shotOffsets.map((offset) => ({
    faction,
    weapon: 'broadside',
    x: ship.x + forwardX * offset + sideX * weapon.muzzleOffset,
    y: ship.y + forwardY * offset + sideY * weapon.muzzleOffset,
    direction,
  }));
}
