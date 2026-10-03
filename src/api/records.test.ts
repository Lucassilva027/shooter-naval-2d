import { QueryClient } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultGameConfig } from '@/config/gameConfig';
import { apiClient } from './client';
import {
  matchHistoryQueryOptions,
  matchSubmissionMutationOptions,
  hasSameRecordsFilter,
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

  it('does not let a slower page response replace a newer page cache entry', async () => {
    server.use(
      http.get('*/api/ranking', async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        if (page === 1) await delay(100);
        return HttpResponse.json({
          items: [
            {
              rank: page,
              matchId: `match-page-${page}`,
              playerId: 'player-1',
              nickname: 'Tester',
              score: page,
              survivedSeconds: 60,
              endedAt: '2026-10-01T12:00:00.000Z',
            },
          ],
          page,
          pageSize: 1,
          total: 2,
          totalPages: 2,
        });
      }),
    );
    const olderPageOptions = rankingQueryOptions({
      configKey: 'd120-s3',
      page: 1,
      pageSize: 1,
    });
    const currentPageOptions = rankingQueryOptions({
      configKey: 'd120-s3',
      page: 2,
      pageSize: 1,
    });

    const olderRequest = queryClient.fetchQuery(olderPageOptions);
    const currentPage = await queryClient.fetchQuery(currentPageOptions);
    await olderRequest;

    expect(currentPage.page).toBe(2);
    expect(queryClient.getQueryData(currentPageOptions.queryKey)).toMatchObject({
      page: 2,
      items: [{ matchId: 'match-page-2' }],
    });
    expect(queryClient.getQueryData(olderPageOptions.queryKey)).toMatchObject({
      page: 1,
      items: [{ matchId: 'match-page-1' }],
    });
  });

  it('keeps placeholder pages only while their filter and page size stay the same', () => {
    const rankingKey = rankingQueryOptions({
      configKey: 'd120-s3',
      page: 1,
      pageSize: 2,
    }).queryKey;
    const historyKey = matchHistoryQueryOptions({
      playerId: 'player-1',
      page: 1,
      pageSize: 2,
    }).queryKey;

    expect(hasSameRecordsFilter(rankingKey, 'ranking', 'd120-s3', 2)).toBe(true);
    expect(hasSameRecordsFilter(rankingKey, 'ranking', 'd60-s1', 2)).toBe(false);
    expect(hasSameRecordsFilter(rankingKey, 'ranking', 'd120-s3', 10)).toBe(false);
    expect(hasSameRecordsFilter(historyKey, 'history', 'player-1', 2)).toBe(true);
    expect(hasSameRecordsFilter(historyKey, 'history', 'player-2', 2)).toBe(false);
    expect(hasSameRecordsFilter(rankingKey, 'history', 'player-1', 2)).toBe(false);
  });
});
