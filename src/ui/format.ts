import type { MatchOutcome } from '@/game/core/events';

/** `125` → `"2:05"`. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function outcomeLabel(outcome: MatchOutcome): string {
  return outcome === 'timeout' ? 'Time up' : 'Ship sunk';
}
