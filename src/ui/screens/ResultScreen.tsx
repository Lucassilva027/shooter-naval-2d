import type { CompletedMatch } from '@/storage/results';
import { Scene } from '@/ui/components/Scene';
import { formatClock, outcomeLabel } from '@/ui/format';

interface ResultScreenProps {
  readonly completed: CompletedMatch;
  readonly onPlayAgain: () => void;
  readonly onMenu: () => void;
}

export function ResultScreen({ completed, onPlayAgain, onMenu }: ResultScreenProps) {
  const { result, previousBest, isNewBest } = completed;
  const title = result.outcome === 'destroyed' ? 'Ship sunk' : 'Battle complete';

  return (
    <Scene label="Battle result">
      <section className="panel" aria-labelledby="result-title">
        <h1 id="result-title">{title}</h1>
        <p className="result__score">
          <span data-testid="result-score">{result.score}</span>
          <span className="visually-hidden"> points</span>
        </p>
        <p className="panel__tagline">
          Points · {formatClock(Math.floor(result.survivedSeconds))} ·{' '}
          {outcomeLabel(result.outcome)}
        </p>
        {isNewBest ? (
          <p className="result__badge" data-testid="new-best">
            New best!
          </p>
        ) : (
          previousBest !== null && <p className="panel__muted">Your best: {previousBest}</p>
        )}
        <button type="button" className="btn btn--primary" onClick={onPlayAgain} autoFocus>
          Play again
        </button>
        <button type="button" className="btn btn--primary" onClick={onMenu}>
          Main menu
        </button>
      </section>
    </Scene>
  );
}
