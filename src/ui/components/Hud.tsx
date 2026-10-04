import type { GameUiState } from '@/game/bridge/gameStore';
import { formatClock } from '@/ui/format';
import './Hud.css';

interface HudProps {
  readonly ui: GameUiState;
}

export function HealthReadout({ ui }: HudProps) {
  const percent = ui.maxHealth > 0 ? (ui.health / ui.maxHealth) * 100 : 0;
  return (
    <div className="hud__health" data-low={ui.lowHealth || undefined}>
      <span className="hud__label" id="hud-health-label">
        Health
      </span>
      <div
        className="hud__bar"
        role="meter"
        aria-labelledby="hud-health-label"
        aria-valuemin={0}
        aria-valuemax={ui.maxHealth}
        aria-valuenow={ui.health}
        aria-valuetext={`${ui.health} of ${ui.maxHealth}`}
        data-testid="hud-health"
      >
        <div className="hud__bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="hud__value" aria-hidden="true">
        {ui.health}
      </span>
    </div>
  );
}

export function TimerReadout({ ui }: HudProps) {
  return (
    <div className="hud__timer" data-low={ui.lowTime || undefined}>
      <span className="visually-hidden">Time left </span>
      <span role="timer" data-testid="hud-time">
        {formatClock(ui.timeLeft)}
      </span>
    </div>
  );
}

export function ScoreReadout({ ui }: HudProps) {
  return (
    <div className="hud__score">
      <span className="hud__label">Score</span>{' '}
      <span className="hud__value" data-testid="hud-score">
        {ui.score}
      </span>
    </div>
  );
}

const CANNONS = [
  { key: 'leftReady', label: 'Port' },
  { key: 'frontReady', label: 'Bow' },
  { key: 'rightReady', label: 'Starboard' },
] as const;

/** Reload state of each cannon; decorative, as firing works the same either way. */
export function CannonReadout({ ui }: HudProps) {
  return (
    <ul className="hud__cannons" aria-label="Cannons" data-testid="hud-cannons">
      {CANNONS.map(({ key, label }) => (
        <li key={key} className="hud__cannon" data-ready={ui[key] || undefined}>
          {label}
          <span className="visually-hidden">{ui[key] ? ' ready' : ' reloading'}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Values above stay readable by assistive tech, but only milestones are announced: each
 * live region's text changes only when its threshold is crossed.
 */
export function HudAnnouncements({ ui }: HudProps) {
  return (
    <>
      <p className="visually-hidden" role="status">
        {timeAnnouncement(ui)}
      </p>
      <p className="visually-hidden" role="status">
        {ui.lowHealth && !ui.outcome ? 'Health low.' : ''}
      </p>
      <p className="visually-hidden" role="status">
        {endAnnouncement(ui)}
      </p>
    </>
  );
}

function timeAnnouncement(ui: GameUiState): string {
  if (ui.outcome) return '';
  if (ui.timeLeft <= 10) return '10 seconds left.';
  if (ui.timeLeft <= 30) return '30 seconds left.';
  return '';
}

function endAnnouncement(ui: GameUiState): string {
  if (ui.outcome === 'timeout') return `Time's up! Final score: ${ui.score}.`;
  if (ui.outcome === 'destroyed') return `Your ship was sunk! Final score: ${ui.score}.`;
  return '';
}
