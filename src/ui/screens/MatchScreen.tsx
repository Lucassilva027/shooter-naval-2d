import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { createMatchConfig } from '@/config/gameConfig';
import { createGameStore } from '@/game/bridge/gameStore';
import { GameController } from '@/game/GameController';
import { CONTROL_LEGEND } from '@/game/input/keyboardBindings';
import { TouchInput } from '@/game/input/TouchInput';
import type { MatchResult } from '@/game/matchResult';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { HealthReadout, HudAnnouncements, ScoreReadout, TimerReadout } from '@/ui/components/Hud';
import { MuteButton } from '@/ui/components/MuteButton';
import { TouchControls } from '@/ui/components/TouchControls';
import './MatchScreen.css';

interface MatchScreenProps {
  readonly onExit: () => void;
  readonly onFinish: (result: MatchResult) => void;
}

export function MatchScreen({ onExit, onFinish }: MatchScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const [store] = useState(createGameStore);
  const [touch] = useState(() => new TouchInput());
  const [attempt, setAttempt] = useState(0);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const finish = useEffectEvent(onFinish);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new GameController({
      host,
      config: createMatchConfig(),
      store,
      touch,
      onFinish: (result) => finish(result),
    });
    controllerRef.current = controller;
    void controller.start();
    return () => {
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [store, touch, attempt]);

  const playing = ui.phase === 'running' || ui.phase === 'ending';

  // Leaving only needs confirming while there is a battle to lose.
  const requestLeave = () => {
    if (ui.phase !== 'running') {
      onExit();
      return;
    }
    controllerRef.current?.setSuspended(true);
    setConfirmingLeave(true);
  };

  const stay = () => {
    setConfirmingLeave(false);
    controllerRef.current?.setSuspended(false);
  };

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

      {ui.phase === 'running' && <TouchControls touch={touch} />}

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
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {ui.phase === 'ending' && (
        <p className="match__banner" aria-hidden="true" data-testid="match-banner">
          {ui.outcome === 'destroyed' ? 'Your ship was sunk!' : "Time's up!"}
        </p>
      )}

      {/* Last in the DOM so it stays clickable above the overlays. */}
      <header className="match__topbar">
        <div className="match__slot match__slot--start">{playing && <HealthReadout ui={ui} />}</div>
        <div className="match__slot match__slot--center">{playing && <TimerReadout ui={ui} />}</div>
        <div className="match__slot match__slot--end">
          {playing && <ScoreReadout ui={ui} />}
          <MuteButton className="btn btn--secondary match__tool" />
          <button type="button" className="btn btn--secondary match__tool" onClick={requestLeave}>
            Main Menu
          </button>
        </div>
      </header>
      {playing && <HudAnnouncements ui={ui} />}

      <ConfirmDialog
        open={confirmingLeave}
        title="Leave battle?"
        message="This match will end and won't be recorded."
        cancelLabel="Keep fighting"
        confirmLabel="Leave"
        onCancel={stay}
        onConfirm={onExit}
      />
    </section>
  );
}
