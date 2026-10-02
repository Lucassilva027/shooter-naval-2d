import { configKey, type MatchResult } from '@/game/matchResult';
import { readStored, writeStored } from './localStore';

const LAST_RESULT_KEY = 'last-result';
const BEST_SCORES_KEY = 'best-scores';

/** Personal bests per match configuration (see `configKey`). */
type BestScores = Readonly<Record<string, number>>;

export interface CompletedMatch {
  readonly result: MatchResult;
  /** Best score for this configuration before this match, if any. */
  readonly previousBest: number | null;
  readonly isNewBest: boolean;
}

/** Persists a completed match locally: it becomes the last result and may set a new best. */
export function recordCompletedMatch(result: MatchResult): CompletedMatch {
  const key = configKey(result.config);
  const bests = readStored(BEST_SCORES_KEY, parseBestScores) ?? {};
  const previousBest = bests[key] ?? null;
  const isNewBest = result.score > 0 && (previousBest === null || result.score > previousBest);

  writeStored(LAST_RESULT_KEY, result);
  if (isNewBest) writeStored(BEST_SCORES_KEY, { ...bests, [key]: result.score });
  return { result, previousBest, isNewBest };
}

export function loadLastResult(): MatchResult | null {
  return readStored(LAST_RESULT_KEY, parseResult);
}

function parseBestScores(raw: unknown): BestScores | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0,
  );
  return Object.fromEntries(entries);
}

function parseResult(raw: unknown): MatchResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const valid =
    (r.outcome === 'timeout' || r.outcome === 'destroyed') &&
    typeof r.score === 'number' &&
    typeof r.survivedSeconds === 'number' &&
    typeof r.seed === 'number' &&
    typeof r.endedAt === 'string' &&
    typeof r.config === 'object' &&
    r.config !== null;
  return valid ? (raw as MatchResult) : null;
}
