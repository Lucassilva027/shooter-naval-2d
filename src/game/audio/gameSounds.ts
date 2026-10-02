import type { GameEvent } from '../core/events';
import { audio } from './AudioManager';

/** Maps simulation events to sound effects. */
export function playEventSounds(events: readonly GameEvent[]): void {
  for (const event of events) {
    if (event.type === 'shot') {
      if (event.weapon === 'broadside') audio.play('broadside', 0.8);
      else audio.playOneOf(['cannonFire1', 'cannonFire2', 'cannonFire3'], 0.7);
    } else if (event.surface === 'ship') {
      audio.playOneOf(['woodHit1', 'woodHit2'], 0.9);
    } else {
      audio.playOneOf(['waterHit1', 'waterHit2'], event.surface === 'water' ? 0.35 : 0.5);
    }
  }
}
