import { configKey } from '@/game/matchResult';
import { delay, http, HttpResponse } from 'msw';
import type {
  MatchHistoryEntry,
  MatchSubmission,
  Page,
  PageParams,
  RankingEntry,
} from '@/api/contracts';
import type { MatchOutcome } from '@/game/core/events';
import { validateNickname } from '@/storage/profile';
import type { MatchesDatabase } from './db';
import { createMatchesDatabase } from './db';
import { getNetworkScenario } from './scenarios/network';

const API_ROOT = '*/api';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export function createApiHandlers(database: MatchesDatabase = createMatchesDatabase()) {
  const timedOutMatchIds = new Set<string>();
  return [
    httpPostMatches(database, timedOutMatchIds),
    httpGetRanking(database),
    httpGetHistory(database),
  ];
}

function httpPostMatches(database: MatchesDatabase, timedOutMatchIds: Set<string>) {
  return http.post(`${API_ROOT}/matches`, async ({ request }) => {
    const body: unknown = await request.json();
    if (!isMatchSubmission(body)) {
      return HttpResponse.json({ message: 'Invalid match submission.' }, { status: 400 });
    }
    const scenario = getNetworkScenario();
    if (scenario === 'submission-error') {
      return HttpResponse.json(
        { message: 'The mock match submission service is temporarily unavailable.' },
        { status: 503 },
      );
    }

    const entry: MatchHistoryEntry = {
      matchId: body.matchId,
      playerId: body.playerId,
      nickname: body.nickname,
      outcome: body.result.outcome,
      score: body.result.score,
      survivedSeconds: body.result.survivedSeconds,
      seed: body.result.seed,
      config: body.result.config,
      endedAt: body.result.endedAt,
    };
    const inserted = await database.add(entry);
    if (scenario === 'submission-timeout' && !timedOutMatchIds.has(body.matchId)) {
      timedOutMatchIds.add(body.matchId);
      await delay(15_000);
    }
    return HttpResponse.json(
      { matchId: body.matchId, status: inserted ? 'created' : 'already-recorded' },
      { status: inserted ? 201 : 200 },
    );
  });
}

async function applyNetworkScenario(): Promise<Response | null> {
  switch (getNetworkScenario()) {
    case 'normal':
      return null;
    case 'slow':
      await delay(1_500);
      return null;
    case 'server-error':
      return HttpResponse.json(
        { message: 'The mock records service is temporarily unavailable.' },
        { status: 503 },
      );
    case 'submission-error':
    case 'submission-timeout':
      return null;
  }
}

function httpGetRanking(database: MatchesDatabase) {
  return http.get(`${API_ROOT}/ranking`, async ({ request }) => {
    const scenarioResponse = await applyNetworkScenario();
    if (scenarioResponse) return scenarioResponse;

    const url = new URL(request.url);
    const key = url.searchParams.get('configKey');
    const page = parsePageParams(url);
    if (!key || !page) {
      return HttpResponse.json(
        { message: 'A configKey and valid page parameters are required.' },
        { status: 400 },
      );
    }

    const entries = (await database.getAll())
      .filter((entry) => configKey(entry.config) === key)
      .sort(compareRanking);
    const ranked: RankingEntry[] = entries.map((entry, index) => ({
      rank: index + 1,
      matchId: entry.matchId,
      playerId: entry.playerId,
      nickname: entry.nickname,
      score: entry.score,
      survivedSeconds: entry.survivedSeconds,
      endedAt: entry.endedAt,
    }));

    return HttpResponse.json(toPage(ranked, page));
  });
}

function httpGetHistory(database: MatchesDatabase) {
  return http.get(`${API_ROOT}/history`, async ({ request }) => {
    const scenarioResponse = await applyNetworkScenario();
    if (scenarioResponse) return scenarioResponse;

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    const page = parsePageParams(url);
    if (!playerId || !page) {
      return HttpResponse.json(
        { message: 'A playerId and valid page parameters are required.' },
        { status: 400 },
      );
    }

    const entries = (await database.getAll())
      .filter((entry) => entry.playerId === playerId)
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt) || b.matchId.localeCompare(a.matchId));
    return HttpResponse.json(toPage(entries, page));
  });
}

function parsePageParams(url: URL): PageParams | null {
  const page = parsePositiveInteger(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
  if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) return null;
  return { page, pageSize };
}

function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toPage<T>(items: readonly T[], { page, pageSize }: PageParams): Page<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function compareRanking(a: MatchHistoryEntry, b: MatchHistoryEntry): number {
  return (
    b.score - a.score ||
    b.survivedSeconds - a.survivedSeconds ||
    a.endedAt.localeCompare(b.endedAt) ||
    a.playerId.localeCompare(b.playerId) ||
    a.matchId.localeCompare(b.matchId)
  );
}

function isMatchSubmission(value: unknown): value is MatchSubmission {
  if (!isRecord(value)) return false;
  const result = value.result;
  if (!isRecord(result)) return false;
  const config = result.config;
  if (!isRecord(config)) return false;
  const { matchId, playerId, nickname } = value;
  const validNickname = typeof nickname === 'string' && validateNickname(nickname).ok;
  const validOutcome: (outcome: unknown) => outcome is MatchOutcome = (outcome) =>
    outcome === 'timeout' || outcome === 'destroyed';
  return (
    isNonEmptyString(matchId) &&
    isNonEmptyString(playerId) &&
    validNickname &&
    validOutcome(result.outcome) &&
    isNonNegativeFinite(result.score) &&
    isNonNegativeFinite(result.survivedSeconds) &&
    Number.isSafeInteger(result.seed) &&
    typeof result.endedAt === 'string' &&
    Number.isFinite(Date.parse(result.endedAt)) &&
    isRecord(config.match) &&
    isNonNegativeFinite(config.match.durationSeconds) &&
    isRecord(config.enemies) &&
    isRecord(config.enemies.spawn) &&
    isNonNegativeFinite(config.enemies.spawn.intervalSeconds)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
