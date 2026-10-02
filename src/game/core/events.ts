import type { EnemyKind } from '@/config/gameConfig';
import type { Faction } from '../entities/projectile';

export type WeaponKind = 'front' | 'broadside';
export type ImpactSurface = 'water' | 'island' | 'ship';

/**
 * Things that happened during a simulation step. The simulation only records them;
 * rendering effects, audio and UI consume them afterwards.
 */
export type GameEvent =
  | {
      readonly type: 'shot';
      readonly faction: Faction;
      readonly weapon: WeaponKind;
      readonly x: number;
      readonly y: number;
      readonly direction: number;
    }
  | {
      readonly type: 'impact';
      readonly surface: ImpactSurface;
      readonly x: number;
      readonly y: number;
      /** Ship that was hit, when `surface` is 'ship'. */
      readonly shipId?: number;
    }
  | {
      readonly type: 'enemySpawned';
      readonly shipId: number;
      readonly kind: EnemyKind;
    }
  | {
      readonly type: 'shipDestroyed';
      readonly shipId: number;
      /** Undefined for the player. */
      readonly kind?: EnemyKind;
      readonly x: number;
      readonly y: number;
      readonly rotation: number;
      /** 'player' when sunk by the player's cannons (scores a point), 'collision' for a Chaser ramming. */
      readonly cause: 'player' | 'enemy' | 'collision';
    };
