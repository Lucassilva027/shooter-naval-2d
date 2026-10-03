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
