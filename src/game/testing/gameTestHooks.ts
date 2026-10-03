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
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
  };
  readonly enemies: readonly {
    readonly kind: string;
    readonly x: number;
    readonly y: number;
    readonly health: number;
  }[];
  readonly projectileCount: number;
}

export interface GameTestHooks {
  advanceTime(milliseconds: number): void;
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
