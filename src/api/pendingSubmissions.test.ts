import { QueryClient } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultGameConfig } from '@/config/gameConfig';
import type { MatchSubmission } from './contracts';
import { apiClient } from './client';
import { flushPendingSubmissions, queueMatchSubmission } from './pendingSubmissions';
import { server } from '@/mocks/node';
import {
  enqueuePendingSubmission,
  readPendingSubmissions,
} from '@/storage/pendingSubmissions';

class MemoryStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

const storage = new MemoryStorage();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});
const originalBaseUrl = apiClient.defaults.baseURL ?? '/api';

function submission(matchId: string): MatchSubmission {
  return {
    matchId,
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
  };
}

beforeEach(() => {
  storage.clear();
  queryClient.clear();
  server.resetHandlers();
  apiClient.defaults.baseURL = 'http://localhost/api';
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  server.resetHandlers();
  apiClient.defaults.baseURL = originalBaseUrl;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pending match submissions', () => {
  it('reports a local persistence failure without sending the submission', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Storage is unavailable.');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = vi.spyOn(apiClient, 'post');

    await expect(queueMatchSubmission(submission('match-storage-failure'), queryClient)).resolves.toBe(
      'failed',
    );
    expect(request).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('persists before sending and removes the queue entry after acknowledgement', async () => {
    server.use(
      http.post('*/api/matches', async ({ request }) => {
        const body = (await request.json()) as { matchId: string };
        return HttpResponse.json({ matchId: body.matchId, status: 'created' }, { status: 201 });
      }),
    );

    await expect(queueMatchSubmission(submission('match-1'), queryClient)).resolves.toBe(
      'submitted',
    );
    expect(readPendingSubmissions()).toEqual({ ok: true, submissions: [] });
  });

  it('keeps failed submissions for a later retry', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const receivedIds: string[] = [];
    server.use(
      http.post('*/api/matches', async ({ request }) => {
        const body = (await request.json()) as { matchId: string };
        receivedIds.push(body.matchId);
        return HttpResponse.json({ message: 'Unavailable' }, { status: 503 });
      }),
    );

    await expect(queueMatchSubmission(submission('match-retry'), queryClient)).resolves.toBe(
      'queued',
    );
    expect(readPendingSubmissions()).toMatchObject({
      ok: true,
      submissions: [{ matchId: 'match-retry' }],
    });
    expect(warning).toHaveBeenCalledOnce();

    server.use(
      http.post('*/api/matches', async ({ request }) => {
        const body = (await request.json()) as { matchId: string };
        receivedIds.push(body.matchId);
        return HttpResponse.json(
          { matchId: body.matchId, status: 'already-recorded' },
          { status: 200 },
        );
      }),
    );
    await flushPendingSubmissions(queryClient);

    expect(receivedIds).toEqual(['match-retry', 'match-retry']);
    expect(readPendingSubmissions()).toEqual({ ok: true, submissions: [] });
  });

  it('preserves and sends new queue entries added while an older request is in flight', async () => {
    const received: string[] = [];
    server.use(
      http.post('*/api/matches', async ({ request }) => {
        const body = (await request.json()) as { matchId: string };
        received.push(body.matchId);
        if (body.matchId === 'match-slow') await delay(50);
        return HttpResponse.json({ matchId: body.matchId, status: 'created' }, { status: 201 });
      }),
    );

    const firstFlush = queueMatchSubmission(submission('match-slow'), queryClient);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(readPendingSubmissions()).toMatchObject({
      ok: true,
      submissions: [{ matchId: 'match-slow' }],
    });
    expect(enqueuePendingSubmission(submission('match-new'))).toBe(true);

    await firstFlush;

    expect(received).toEqual(['match-slow', 'match-new']);
    expect(readPendingSubmissions()).toEqual({ ok: true, submissions: [] });
  });
});
