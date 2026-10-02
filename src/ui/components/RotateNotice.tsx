import './RotateNotice.css';

/** Covers the app on touch devices held in portrait; the game is landscape only. */
export function RotateNotice() {
  return (
    <div className="rotate-notice" role="alert" data-testid="rotate-notice">
      <div className="rotate-notice__phone" aria-hidden="true" />
      <p>Rotate your device to landscape to play.</p>
    </div>
  );
}
