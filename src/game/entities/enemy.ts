import type { EnemyKind, EnemyShipConfig } from '@/config/gameConfig';
import { createCooldown, type Cooldown } from '../systems/weapons';
import { createShip, type Ship } from './ship';

export interface Enemy extends Ship {
  readonly kind: EnemyKind;
  readonly weaponCooldown: Cooldown;
}

export function createEnemy(
  id: number,
  kind: EnemyKind,
  config: EnemyShipConfig,
  x: number,
  y: number,
  rotation: number,
): Enemy {
  return {
    ...createShip({
      id,
      x,
      y,
      rotation,
      maxHealth: config.maxHealth,
      maxSpeed: config.motion.maxSpeed,
      hull: config.hull,
    }),
    kind,
    weaponCooldown: createCooldown(),
  };
}
