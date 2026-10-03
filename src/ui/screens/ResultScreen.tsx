import type { CompletedMatch } from '@/storage/results';
import type { MatchSubmissionStatus } from '@/api/pendingSubmissions';
import { Scene } from '@/ui/components/Scene';
import { formatClock, outcomeLabel } from '@/ui/format';

interface ResultScreenProps {
  readonly completed: CompletedMatch;
  readonly submissionStatus: MatchSubmissionStatus | null;
  readonly onRetrySubmission: () => void;
  readonly onPlayAgain: () => void;
  readonly onMenu: () => void;
}

export function ResultScreen({
  completed,
  submissionStatus,
  onRetrySubmission,
  onPlayAgain,
  onMenu,
}: ResultScreenProps) {
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
        {submissionStatus && (
          <p
            className="panel__muted"
            role="status"
            aria-live="polite"
            data-testid="submission-status"
          >
            {submissionStatus === 'sending' && 'Sending your result…'}
            {submissionStatus === 'submitted' && 'Result submitted.'}
            {submissionStatus === 'queued' &&
              'Saved on this device. It will be sent when the connection is available.'}
            {submissionStatus === 'failed' && 'Could not queue your result for submission.'}
          </p>
        )}
        {(submissionStatus === 'queued' || submissionStatus === 'failed') && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onRetrySubmission}
          >
            Retry submission
          </button>
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
