/**
 * Bridge between the game loop and React. The loop may call `publish` every frame, but
 * subscribers are only notified when a value actually changes, so React re-renders at
 * the rate of meaningful UI changes (e.g. once per displayed second), never per frame.
 */

export type GamePhase = 'loading' | 'running' | 'error';

export interface GameUiState {
  readonly phase: GamePhase;
  /** Asset loading progress, 0-100 (integer). */
  readonly loadProgress: number;
  readonly errorMessage: string | null;
}

export const INITIAL_GAME_UI_STATE: GameUiState = {
  phase: 'loading',
  loadProgress: 0,
  errorMessage: null,
};

export interface GameStore {
  getSnapshot(): GameUiState;
  subscribe(listener: () => void): () => void;
  publish(patch: Partial<GameUiState>): void;
  reset(): void;
}

export function createGameStore(): GameStore {
  let state = INITIAL_GAME_UI_STATE;
  const listeners = new Set<() => void>();

  const setState = (next: GameUiState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(patch) {
      let changed = false;
      for (const key of Object.keys(patch) as (keyof GameUiState)[]) {
        if (!Object.is(patch[key], state[key])) {
          changed = true;
          break;
        }
      }
      if (changed) setState({ ...state, ...patch });
    },
    reset() {
      if (state !== INITIAL_GAME_UI_STATE) setState(INITIAL_GAME_UI_STATE);
    },
  };
}
