import type { GameConfig } from '@/config/gameConfig';
import type { MatchResult } from '@/game/matchResult';
import type { MatchOutcome } from '@/game/core/events';

export interface MatchSubmission {
  /** Stable client-generated id used to make retries idempotent. */
  readonly matchId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly result: MatchResult;
}

export interface MatchSubmissionResponse {
  readonly matchId: string;
  readonly status: 'created' | 'already-recorded';
}

export interface RankingEntry {
  readonly rank: number;
  readonly matchId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly score: number;
  readonly survivedSeconds: number;
  readonly endedAt: string;
}

export interface MatchHistoryEntry {
  readonly matchId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly outcome: MatchOutcome;
  readonly score: number;
  readonly survivedSeconds: number;
  readonly seed: number;
  readonly config: GameConfig;
  readonly endedAt: string;
}

export interface PageParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface RankingParams extends PageParams {
  readonly configKey: string;
}

export interface MatchHistoryParams extends PageParams {
  readonly playerId: string;
}
