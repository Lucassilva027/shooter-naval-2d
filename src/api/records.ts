import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
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

export const matchSubmissionMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: submitMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recordsQueryKeys.all }),
  });

export const rankingQueryOptions = (params: RankingParams) =>
  queryOptions({
    queryKey: recordsQueryKeys.ranking(params),
    queryFn: ({ signal }) => getRanking(params, signal),
  });

export const matchHistoryQueryOptions = (params: MatchHistoryParams) =>
  queryOptions({
    queryKey: recordsQueryKeys.history(params),
    queryFn: ({ signal }) => getMatchHistory(params, signal),
  });
