import type { GameConfig } from '@/config/gameConfig';
import type { MatchOutcome } from './core/events';

/** Summary of a completed match, handed to the result screen (and later the ranking API). */
export interface MatchResult {
  readonly outcome: MatchOutcome;
  readonly score: number;
  /** Seconds actually played (equals the duration on timeout). */
  readonly survivedSeconds: number;
  readonly seed: number;
  /** The config snapshot the match was played with. */
  readonly config: GameConfig;
  /** ISO timestamp. */
  readonly endedAt: string;
}

/**
 * Identifies the player-adjustable settings a match was played with. Scores are only
 * compared (personal best, ranking) between matches with the same key.
 */
export function configKey(config: GameConfig): string {
  return `d${config.match.durationSeconds}-s${config.enemies.spawn.intervalSeconds}`;
}
