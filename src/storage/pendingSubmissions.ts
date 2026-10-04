import type { MatchSubmission } from '@/api/contracts';
import type { MatchOutcome } from '@/game/core/events';
import type { MatchResult } from '@/game/matchResult';

const STORAGE_KEY = 'pirate-battle:pending-submissions';

export type PendingSubmissionsRead =
  | { readonly ok: true; readonly submissions: readonly MatchSubmission[] }
  | { readonly ok: false; readonly error: Error };

export function readPendingSubmissions(): PendingSubmissionsRead {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return { ok: true, submissions: [] };

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isMatchSubmission)) {
      throw new Error('Stored pending match submissions are invalid.');
    }
    return { ok: true, submissions: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('Could not read pending match submissions.'),
    };
  }
}

export function enqueuePendingSubmission(submission: MatchSubmission): boolean {
  const stored = readPendingSubmissions();
  if (!stored.ok) return false;
  if (stored.submissions.some((entry) => entry.matchId === submission.matchId)) return true;
  return writePendingSubmissions([...stored.submissions, submission]);
}

/** Removes only the acknowledged item, preserving submissions queued while a request was in flight. */
export function removePendingSubmission(matchId: string): boolean {
  const stored = readPendingSubmissions();
  if (!stored.ok) return false;
  return writePendingSubmissions(stored.submissions.filter((entry) => entry.matchId !== matchId));
}

export function createMatchSubmission(
  playerId: string,
  nickname: string,
  result: MatchResult,
): MatchSubmission {
  return {
    matchId: crypto.randomUUID(),
    playerId,
    nickname,
    result,
  };
}

const listeners = new Set<() => void>();

/** Notifies on queue changes from this tab and from other tabs. */
export function subscribePendingSubmissions(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function countPendingSubmissions(): number {
  const stored = readPendingSubmissions();
  return stored.ok ? stored.submissions.length : 0;
}

function writePendingSubmissions(submissions: readonly MatchSubmission[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch {
    return false;
  }
  for (const listener of listeners) listener();
  return true;
}

function isMatchSubmission(value: unknown): value is MatchSubmission {
  if (!isRecord(value)) return false;
  const submission = value;
  const result = submission.result;
  if (!isRecord(result)) return false;
  const matchResult = result;
  const config = matchResult.config;
  if (!isRecord(config)) return false;
  const gameConfig = config;
  const outcome = matchResult.outcome;
  return (
    typeof submission.matchId === 'string' &&
    submission.matchId.length > 0 &&
    typeof submission.playerId === 'string' &&
    submission.playerId.length > 0 &&
    typeof submission.nickname === 'string' &&
    (outcome === 'timeout' || outcome === 'destroyed') &&
    isNonNegativeFinite(matchResult.score) &&
    isNonNegativeFinite(matchResult.survivedSeconds) &&
    typeof matchResult.seed === 'number' &&
    Number.isSafeInteger(matchResult.seed) &&
    typeof matchResult.endedAt === 'string' &&
    Number.isFinite(Date.parse(matchResult.endedAt)) &&
    isMatchOutcome(outcome) &&
    isGameConfig(gameConfig)
  );
}

function isGameConfig(value: Record<string, unknown>): boolean {
  const match = value.match;
  const enemies = value.enemies;
  if (!isRecord(match) || !isRecord(enemies)) return false;
  const spawn = enemies.spawn;
  if (!isRecord(spawn)) return false;
  const durationSeconds = match.durationSeconds;
  const intervalSeconds = spawn.intervalSeconds;
  return (
    typeof durationSeconds === 'number' &&
    Number.isFinite(durationSeconds) &&
    typeof intervalSeconds === 'number' &&
    Number.isFinite(intervalSeconds)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMatchOutcome(value: unknown): value is MatchOutcome {
  return value === 'timeout' || value === 'destroyed';
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
