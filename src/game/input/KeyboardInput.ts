import {
  EMPTY_INPUT,
  type HeldAction,
  type InputCommand,
  type InputSnapshot,
  type InputSource,
} from './actions';
import { COMMAND_KEY_BINDINGS, HELD_KEY_BINDINGS } from './keyboardBindings';

/**
 * Tracks held keys on `window`. Game keys are only captured (and their default browser
 * behaviour prevented) while `enabled` is true, i.e. while gameplay is active.
 */
export class KeyboardInput implements InputSource {
  private readonly held = new Set<string>();
  private enabled = false;

  constructor(
    private readonly target: Window,
    private readonly onCommand: (command: InputCommand) => void,
  ) {}

  attach(): void {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.held.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.held.clear();
  }

  clear(): void {
    this.held.clear();
  }

  read(): InputSnapshot {
    if (this.held.size === 0) return EMPTY_INPUT;
    const snapshot: Record<HeldAction, boolean> = { ...EMPTY_INPUT };
    for (const code of this.held) {
      const action = HELD_KEY_BINDINGS[code];
      if (action) snapshot[action] = true;
    }
    return snapshot;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || isEditableTarget(event.target)) return;

    const command = COMMAND_KEY_BINDINGS[event.code];
    if (command) {
      event.preventDefault();
      if (!event.repeat) this.onCommand(command);
      return;
    }

    if (HELD_KEY_BINDINGS[event.code]) {
      event.preventDefault();
      this.held.add(event.code);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.held.clear();
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
