import { useId, useRef, type KeyboardEvent } from 'react';
import { Scene } from '@/ui/components/Scene';

export type RecordsTab = 'ranking' | 'history';

const TABS: readonly { readonly id: RecordsTab; readonly label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
];

interface RecordsScreenProps {
  readonly tab: RecordsTab;
  readonly onTabChange: (tab: RecordsTab) => void;
  readonly onBack: () => void;
}

/** Ranking and match history share one panel, switched with an ARIA tablist. */
export function RecordsScreen({ tab, onTabChange, onBack }: RecordsScreenProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<RecordsTab, HTMLButtonElement>());

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

        {TABS.map(({ id }) => (
          <div
            key={id}
            role="tabpanel"
            id={`${baseId}-${id}-panel`}
            aria-labelledby={`${baseId}-${id}-tab`}
            hidden={tab !== id}
            className="records__panel"
          >
            <p className="panel__muted">
              {id === 'ranking' ? 'No ranked battles yet.' : 'No battles recorded yet.'}
            </p>
          </div>
        ))}

        <button type="button" className="btn btn--primary" onClick={onBack} autoFocus>
          Back
        </button>
      </section>
    </Scene>
  );
}
