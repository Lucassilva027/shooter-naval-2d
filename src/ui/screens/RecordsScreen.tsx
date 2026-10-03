import { useState, useId, useRef, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  hasSameRecordsFilter,
  matchHistoryQueryOptions,
  rankingQueryOptions,
} from '@/api/records';
import { formatClock, outcomeLabel } from '@/ui/format';
import { Scene } from '@/ui/components/Scene';

export type RecordsTab = 'ranking' | 'history';

const TABS: readonly { readonly id: RecordsTab; readonly label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
];
const PAGE_SIZE = 2;
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface RecordsScreenProps {
  readonly tab: RecordsTab;
  readonly onTabChange: (tab: RecordsTab) => void;
  readonly onBack: () => void;
  readonly configKey: string;
  readonly playerId: string | null;
}

/** Ranking and match history share one panel, switched with an ARIA tablist. */
export function RecordsScreen({
  tab,
  onTabChange,
  onBack,
  configKey,
  playerId,
}: RecordsScreenProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<RecordsTab, HTMLButtonElement>());
  const [rankingPage, setRankingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Arrow keys move between tabs (roving tabindex), per the ARIA tabs pattern.
  const handleKeyDown = (event: KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    if (!next) return;
    onTabChange(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <Scene label="Records">
      <section className="panel panel--wide" aria-labelledby={`${baseId}-title`}>
        <h1 id={`${baseId}-title`}>Records</h1>
        <div role="tablist" aria-label="Records" className="panel__row" onKeyDown={handleKeyDown}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              ref={(node) => {
                if (node) tabRefs.current.set(id, node);
                else tabRefs.current.delete(id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-${id}-tab`}
              aria-selected={tab === id}
              aria-controls={`${baseId}-${id}-panel`}
              tabIndex={tab === id ? 0 : -1}
              className="btn btn--secondary"
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-ranking-panel`}
          aria-labelledby={`${baseId}-ranking-tab`}
          hidden={tab !== 'ranking'}
          className="records__panel"
        >
          <RankingPanel
            active={tab === 'ranking'}
            configKey={configKey}
            page={rankingPage}
            onPageChange={setRankingPage}
          />
        </div>
        <div
          role="tabpanel"
          id={`${baseId}-history-panel`}
          aria-labelledby={`${baseId}-history-tab`}
          hidden={tab !== 'history'}
          className="records__panel"
        >
          <HistoryPanel
            active={tab === 'history'}
            page={historyPage}
            onPageChange={setHistoryPage}
            playerId={playerId}
          />
        </div>

        <button type="button" className="btn btn--primary" onClick={onBack} autoFocus>
          Back
        </button>
      </section>
    </Scene>
  );
}

function RankingPanel({
  active,
  configKey,
  page,
  onPageChange,
}: {
  readonly active: boolean;
  readonly configKey: string;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
}) {
  const query = useQuery({
    ...rankingQueryOptions({ configKey, page, pageSize: PAGE_SIZE }),
    enabled: active,
    placeholderData: (previousData, previousQuery) =>
      hasSameRecordsFilter(previousQuery?.queryKey, 'ranking', configKey, PAGE_SIZE)
        ? previousData
        : undefined,
  });

  if (query.isPending) return <p className="panel__muted" role="status">Loading ranking…</p>;
  if (query.isError && !query.data) {
    return <QueryError message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  if (!query.data || query.data.items.length === 0) {
    return <p className="panel__muted">No ranked battles for these settings yet.</p>;
  }

  return (
    <div className="records__content" aria-busy={query.isFetching}>
      <h2>Ranking · same settings</h2>
      <table className="records__table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Captain</th>
            <th scope="col">Score</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((entry) => (
            <tr key={entry.matchId}>
              <td>{entry.rank}</td>
              <td>{entry.nickname}</td>
              <td>{entry.score}</td>
              <td>{formatClock(entry.survivedSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={query.data.page}
        totalPages={query.data.totalPages}
        disabled={query.isPlaceholderData}
        onPageChange={onPageChange}
      />
      {query.isError && <p className="records__stale-error" role="status">Refresh failed. Showing saved results.</p>}
    </div>
  );
}

function HistoryPanel({
  active,
  page,
  onPageChange,
  playerId,
}: {
  readonly active: boolean;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly playerId: string | null;
}) {
  const query = useQuery({
    ...matchHistoryQueryOptions({ playerId: playerId ?? '', page, pageSize: PAGE_SIZE }),
    enabled: active && playerId !== null,
    placeholderData: (previousData, previousQuery) =>
      playerId && hasSameRecordsFilter(previousQuery?.queryKey, 'history', playerId, PAGE_SIZE)
        ? previousData
        : undefined,
  });

  if (!playerId) return <p className="panel__muted">Play a battle to start your match history.</p>;
  if (query.isPending) return <p className="panel__muted" role="status">Loading match history…</p>;
  if (query.isError && !query.data) {
    return <QueryError message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  if (!query.data || query.data.items.length === 0) {
    return <p className="panel__muted">No battles recorded yet.</p>;
  }

  return (
    <div className="records__content" aria-busy={query.isFetching}>
      <h2>Match history</h2>
      <table className="records__table">
        <thead>
          <tr>
            <th scope="col">Result</th>
            <th scope="col">Score</th>
            <th scope="col">Time</th>
            <th scope="col">Played</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((entry) => (
            <tr key={entry.matchId}>
              <td>{outcomeLabel(entry.outcome)}</td>
              <td>{entry.score}</td>
              <td>{formatClock(entry.survivedSeconds)}</td>
              <td>{DATE_FORMAT.format(new Date(entry.endedAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={query.data.page}
        totalPages={query.data.totalPages}
        disabled={query.isPlaceholderData}
        onPageChange={onPageChange}
      />
      {query.isError && <p className="records__stale-error" role="status">Refresh failed. Showing saved results.</p>}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly disabled: boolean;
  readonly onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="records__pagination" aria-label="Pages">
      <button
        type="button"
        className="btn btn--secondary records__page-button"
        disabled={page <= 1 || disabled}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite">Page {page} of {totalPages}</span>
      <button
        type="button"
        className="btn btn--secondary records__page-button"
        disabled={page >= totalPages || disabled}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function QueryError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div className="records__error" role="alert">
      <p>Could not load records: {message}</p>
      <button type="button" className="btn btn--secondary records__page-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
