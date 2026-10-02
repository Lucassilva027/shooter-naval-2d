import type { HeldAction, InputCommand } from './actions';

/** Bound by `KeyboardEvent.code`, so the layout (QWERTY/AZERTY...) does not matter. */
export const HELD_KEY_BINDINGS: Readonly<Record<string, HeldAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
};

export const COMMAND_KEY_BINDINGS: Readonly<Record<string, InputCommand>> = {
  KeyP: 'pause',
  Escape: 'pause',
};

/** Human-readable labels used by the controls legend. */
export const CONTROL_LEGEND: readonly { readonly keys: string; readonly action: string }[] = [
  { keys: 'W / ↑', action: 'Sail forward' },
  { keys: 'S / ↓', action: 'Brake' },
  { keys: 'A D / ← →', action: 'Turn' },
  { keys: 'Space', action: 'Front cannon' },
  { keys: 'Q / E', action: 'Left / right broadside' },
  { keys: 'P / Esc', action: 'Pause' },
];
