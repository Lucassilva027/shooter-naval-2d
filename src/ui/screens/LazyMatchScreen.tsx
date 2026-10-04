import { Component, lazy, Suspense, useState, type ComponentProps, type ReactNode } from 'react';
import type { MatchScreen as EagerMatchScreen } from './MatchScreen';
import './MatchScreen.css';

type MatchScreenProps = ComponentProps<typeof EagerMatchScreen>;

const loadMatchScreen = () =>
  import('./MatchScreen').then((module) => ({ default: module.MatchScreen }));

/**
 * The battle screen (and PixiJS with it) is a separate chunk, so the menus load fast. A
 * failed chunk download can be retried: `lazy` caches rejections, so each retry needs a
 * fresh lazy component.
 */
export function LazyMatchScreen(props: MatchScreenProps) {
  const [MatchScreen, setMatchScreen] = useState(() => lazy(loadMatchScreen));
  return (
    <ChunkErrorBoundary
      onRetry={() => setMatchScreen(() => lazy(loadMatchScreen))}
      onExit={props.onExit}
    >
      <Suspense
        fallback={
          <section className="match" aria-label="Battle">
            <div className="match__overlay" role="status" aria-live="polite">
              <p>Preparing the battle…</p>
            </div>
          </section>
        }
      >
        <MatchScreen {...props} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

interface ChunkErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onRetry: () => void;
  readonly onExit: () => void;
}

class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn('[PirateBattle] Failed to load the battle screen', error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="match" aria-label="Battle">
        <div className="match__overlay" role="alert">
          <p>The battle could not be loaded. Check your connection and try again.</p>
          <div className="match__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
            >
              Try again
            </button>
            <button type="button" className="btn btn--secondary" onClick={this.props.onExit}>
              Main Menu
            </button>
          </div>
        </div>
      </section>
    );
  }
}
