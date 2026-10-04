interface ShipState {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly speed: number;
  readonly health: number;
}

export interface GameTestState {
  readonly phase: 'loading' | 'running' | 'ending' | 'error';
  readonly paused: boolean;
  readonly pauseReason: 'manual' | 'focus' | null;
  readonly seed: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly score: number;
  readonly health: number;
  readonly outcome: 'timeout' | 'destroyed' | null;
  readonly arena: { readonly width: number; readonly height: number };
  readonly islands: readonly {
    readonly art: string;
    readonly colliders: readonly { readonly x: number; readonly y: number; readonly radius: number }[];
  }[];
  /** Hull collision circles of the player, in world coordinates. */
  readonly playerHull: readonly { readonly x: number; readonly y: number; readonly radius: number }[];
  readonly player: ShipState;
  readonly enemies: readonly (ShipState & { readonly id: number; readonly kind: string })[];
  readonly projectiles: readonly {
    readonly id: number;
    readonly faction: 'player' | 'enemy';
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
  }[];
  readonly projectileCount: number;
  readonly weaponsReady: { readonly front: boolean; readonly left: boolean; readonly right: boolean };
  readonly stats: {
    readonly shotsFired: { readonly player: number; readonly enemy: number };
    readonly spawns: readonly {
      readonly kind: string;
      readonly atSeconds: number;
      readonly distanceFromPlayer: number;
    }[];
    readonly peakEnemies: number;
    readonly peakProjectiles: number;
  };
  /** Display objects currently in the Pixi scene. */
  readonly sceneCounts: { readonly ships: number; readonly projectiles: number; readonly effects: number };
}

export interface GameTestHooks {
  /** Only in E2E mode, where the game runs on a manual clock. */
  advanceTime?(milliseconds: number): void;
  setPlayerHealth(health: number): void;
  readState(): GameTestState | null;
}

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: GameTestHooks;
  }
}

export class ManualGameClock {
  private pendingSeconds = 0;

  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError('Test clock advancement must be a finite, non-negative number.');
    }
    this.pendingSeconds += milliseconds / 1000;
  }

  consumeFrame(): number {
    const frameSeconds = this.pendingSeconds;
    this.pendingSeconds -= frameSeconds;
    return frameSeconds;
  }

  reset(): void {
    this.pendingSeconds = 0;
  }
}
