import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultGameConfig } from '@/config/gameConfig';
import { apiClient } from './client';
import {
  matchHistoryQueryOptions,
  matchSubmissionMutationOptions,
  rankingQueryOptions,
} from './records';
import { server } from '@/mocks/node';

describe('record query options', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const originalBaseUrl = apiClient.defaults.baseURL ?? '/api';

  beforeEach(() => {
    apiClient.defaults.baseURL = 'http://localhost/api';
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    apiClient.defaults.baseURL = originalBaseUrl;
  });

  it('invalidates cached ranking and history data after a match is submitted', async () => {
    server.use(
      http.post('*/api/matches', () =>
        HttpResponse.json({ matchId: 'match-1', status: 'created' }, { status: 201 }),
      ),
    );
    const rankingOptions = rankingQueryOptions({
      configKey: 'd120-s3',
      page: 1,
      pageSize: 2,
    });
    const historyOptions = matchHistoryQueryOptions({
      playerId: 'player-1',
      page: 1,
      pageSize: 2,
    });
    queryClient.setQueryData(rankingOptions.queryKey, {
      items: [],
      page: 1,
      pageSize: 2,
      total: 0,
      totalPages: 0,
    });
    queryClient.setQueryData(historyOptions.queryKey, {
      items: [],
      page: 1,
      pageSize: 2,
      total: 0,
      totalPages: 0,
    });
    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, matchSubmissionMutationOptions(queryClient));

    const response = await mutation.execute({
      matchId: 'match-1',
      playerId: 'player-1',
      nickname: 'Tester',
      result: {
        outcome: 'timeout',
        score: 2,
        survivedSeconds: 120,
        seed: 42,
        config: defaultGameConfig,
        endedAt: '2026-10-01T12:00:00.000Z',
      },
    });

    expect(response).toEqual({ matchId: 'match-1', status: 'created' });
    expect(queryClient.getQueryState(rankingOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(historyOptions.queryKey)?.isInvalidated).toBe(true);
  });
});
