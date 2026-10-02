/** Continuous actions sampled every simulation step. */
export type HeldAction =
  | 'forward'
  | 'brake'
  | 'turnLeft'
  | 'turnRight'
  | 'fireFront'
  | 'fireLeft'
  | 'fireRight';

/** One-shot commands handled outside the simulation step. */
export type InputCommand = 'pause';

export type InputSnapshot = Readonly<Record<HeldAction, boolean>>;

export const HELD_ACTIONS: readonly HeldAction[] = [
  'forward',
  'brake',
  'turnLeft',
  'turnRight',
  'fireFront',
  'fireLeft',
  'fireRight',
];

export const EMPTY_INPUT: InputSnapshot = Object.freeze({
  forward: false,
  brake: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
});

export interface InputSource {
  read(): InputSnapshot;
  /** Forgets every held key/touch, e.g. after pausing or losing focus. */
  clear(): void;
}

/** Merges several sources (keyboard + touch) so they can be used simultaneously. */
export function mergeInputs(sources: readonly InputSource[]): InputSource {
  return {
    read() {
      const merged: Record<HeldAction, boolean> = { ...EMPTY_INPUT };
      for (const source of sources) {
        const snapshot = source.read();
        for (const action of HELD_ACTIONS) merged[action] ||= snapshot[action];
      }
      return merged;
    },
    clear() {
      for (const source of sources) source.clear();
    },
  };
}
