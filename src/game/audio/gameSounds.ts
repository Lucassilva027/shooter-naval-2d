import type { GameEvent } from '../core/events';
import { audio } from './AudioManager';

/** Maps simulation events to sound effects. */
export function playEventSounds(events: readonly GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'shot':
        if (event.weapon === 'broadside') audio.play('broadside', 0.8);
        else
          audio.playOneOf(
            ['cannonFire1', 'cannonFire2', 'cannonFire3'],
            event.faction === 'enemy' ? 0.45 : 0.7,
          );
        break;
      case 'impact':
        if (event.surface === 'ship') audio.playOneOf(['woodHit1', 'woodHit2'], 0.9);
        else audio.playOneOf(['waterHit1', 'waterHit2'], event.surface === 'water' ? 0.35 : 0.5);
        break;
      case 'shipDestroyed':
        audio.playOneOf(['explosion1', 'explosion2'], 0.9);
        if (event.kind === undefined) audio.play('shipSinking', 0.9);
        break;
      case 'matchEnded':
        audio.play(event.outcome === 'timeout' ? 'gameComplete' : 'gameOver', 0.9);
        break;
      case 'enemySpawned':
        break;
    }
  }
}
