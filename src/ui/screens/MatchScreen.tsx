import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createMatchConfig } from '@/config/gameConfig';
import { createGameStore } from '@/game/bridge/gameStore';
import { GameController } from '@/game/GameController';
import { CONTROL_LEGEND } from '@/game/input/keyboardBindings';
import { MuteButton } from '@/ui/components/MuteButton';
import './MatchScreen.css';

interface MatchScreenProps {
  readonly onExit: () => void;
}

export function MatchScreen({ onExit }: MatchScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [store] = useState(createGameStore);
  const [attempt, setAttempt] = useState(0);
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new GameController({ host, config: createMatchConfig(), store });
    void controller.start();
    return () => controller.destroy();
  }, [store, attempt]);

  return (
    <section className="match" aria-label="Battle">
      <div ref={hostRef} className="match__arena" data-testid="arena" />

      <aside className="match__legend" aria-label="Controls">
        <ul>
          {CONTROL_LEGEND.map(({ keys, action }) => (
            <li key={action}>
              <kbd>{keys}</kbd> {action}
            </li>
          ))}
        </ul>
      </aside>

      {ui.phase === 'loading' && (
        <div className="match__overlay" role="status" aria-live="polite">
          <p>Loading assets… {ui.loadProgress}%</p>
          <progress max={100} value={ui.loadProgress} aria-label="Asset loading progress" />
        </div>
      )}

      {ui.phase === 'error' && (
        <div className="match__overlay" role="alert">
          <p>{ui.errorMessage}</p>
          <div className="match__actions">
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="match__toolbar">
        <MuteButton />
        <button type="button" onClick={onExit}>
          Main Menu
        </button>
      </div>
    </section>
  );
}
