import { queryOptions } from '@tanstack/react-query';
import type {
  MatchHistoryParams,
  MatchHistoryEntry,
  MatchSubmission,
  MatchSubmissionResponse,
  Page,
  RankingEntry,
  RankingParams,
} from './contracts';
import { apiClient } from './client';

export const recordsQueryKeys = {
  all: ['records'] as const,
  ranking: (params: RankingParams) => [...recordsQueryKeys.all, 'ranking', params] as const,
  history: (params: MatchHistoryParams) => [...recordsQueryKeys.all, 'history', params] as const,
};

export function hasSameRecordsFilter(
  queryKey: readonly unknown[] | undefined,
  recordType: 'ranking' | 'history',
  filterValue: string,
  pageSize: number,
): boolean {
  if (!queryKey || queryKey[0] !== 'records' || queryKey[1] !== recordType) return false;
  const params = queryKey[2];
  if (typeof params !== 'object' || params === null) return false;
  const queryParams = params as Record<string, unknown>;
  const filterName = recordType === 'ranking' ? 'configKey' : 'playerId';
  return queryParams[filterName] === filterValue && queryParams.pageSize === pageSize;
}

export async function submitMatch(
  submission: MatchSubmission,
): Promise<MatchSubmissionResponse> {
  const response = await apiClient.post<MatchSubmissionResponse>('/matches', submission);
  return response.data;
}

export async function getRanking(
  params: RankingParams,
  signal?: AbortSignal,
): Promise<Page<RankingEntry>> {
  const response = await apiClient.get<Page<RankingEntry>>('/ranking', {
    params,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}

export async function getMatchHistory(
  params: MatchHistoryParams,
  signal?: AbortSignal,
): Promise<Page<MatchHistoryEntry>> {
  const response = await apiClient.get<Page<MatchHistoryEntry>>('/history', {
    params,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}

/** Mock-only: restores the mock API fixtures. */
export async function resetMockApiData(): Promise<void> {
  await apiClient.post('/__mock/reset');
}

/**
 * Records are always stale, so showing a tab again (or remounting the screen) refetches
 * in the background while the cached page stays on screen.
 */
const RECORDS_STALE_TIME = 0;

export const rankingQueryOptions = (params: RankingParams) =>
  queryOptions({
    queryKey: recordsQueryKeys.ranking(params),
    queryFn: ({ signal }) => getRanking(params, signal),
    staleTime: RECORDS_STALE_TIME,
  });

export const matchHistoryQueryOptions = (params: MatchHistoryParams) =>
  queryOptions({
    queryKey: recordsQueryKeys.history(params),
    queryFn: ({ signal }) => getMatchHistory(params, signal),
    staleTime: RECORDS_STALE_TIME,
  });
