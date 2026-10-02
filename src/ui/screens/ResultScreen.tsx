import type { MatchResult } from '@/game/matchResult';
import { formatClock } from '@/ui/format';

interface ResultScreenProps {
  readonly result: MatchResult;
  readonly onPlayAgain: () => void;
  readonly onMenu: () => void;
}

export function ResultScreen({ result, onPlayAgain, onMenu }: ResultScreenProps) {
  return (
    <main className="app" aria-labelledby="result-title">
      <h1 id="result-title">
        {result.outcome === 'destroyed' ? 'Your ship was sunk!' : "Time's up!"}
      </h1>
      <p>
        Score: <strong data-testid="result-score">{result.score}</strong>
      </p>
      <p>Time survived: {formatClock(Math.floor(result.survivedSeconds))}</p>
      <div className="match__actions">
        <button type="button" onClick={onPlayAgain} autoFocus>
          Play again
        </button>
        <button type="button" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </main>
  );
}
