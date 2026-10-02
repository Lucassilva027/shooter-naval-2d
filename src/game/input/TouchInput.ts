import { EMPTY_INPUT, type HeldAction, type InputSnapshot, type InputSource } from './actions';

/** Fraction of the stick radius that must be exceeded before an axis counts as pressed. */
const STICK_DEAD_ZONE = 0.35;

export type TouchButtonAction = Extract<HeldAction, 'fireFront' | 'fireLeft' | 'fireRight'>;

/**
 * Held state from the on-screen controls. The UI layer reports raw stick/button changes;
 * this class turns them into the same snapshot the keyboard produces.
 * Stick: up = sail forward, down = brake, left/right = turn.
 */
export class TouchInput implements InputSource {
  private stickX = 0;
  private stickY = 0;
  private readonly buttons = new Set<TouchButtonAction>();
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  /** Normalised stick position, each axis in [-1, 1] (y grows downwards). */
  setStick(x: number, y: number): void {
    this.stickX = x;
    this.stickY = y;
  }

  setButton(action: TouchButtonAction, pressed: boolean): void {
    if (pressed) this.buttons.add(action);
    else this.buttons.delete(action);
  }

  clear(): void {
    this.stickX = 0;
    this.stickY = 0;
    this.buttons.clear();
  }

  read(): InputSnapshot {
    if (!this.enabled) return EMPTY_INPUT;
    return {
      forward: this.stickY < -STICK_DEAD_ZONE,
      brake: this.stickY > STICK_DEAD_ZONE,
      turnLeft: this.stickX < -STICK_DEAD_ZONE,
      turnRight: this.stickX > STICK_DEAD_ZONE,
      fireFront: this.buttons.has('fireFront'),
      fireLeft: this.buttons.has('fireLeft'),
      fireRight: this.buttons.has('fireRight'),
    };
  }
}
