import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchHistoryEntry } from '@/api/contracts';
import { configKey } from '@/game/matchResult';
import { matchFixtures } from './fixtures/matches';
import { createApiHandlers } from './handlers';
import { server } from './node';
import { resetNetworkScenario, setNetworkScenario } from './scenarios/network';

class MemoryMatchesDatabase {
  entries = [...matchFixtures];

  async get(matchId: string): Promise<MatchHistoryEntry | undefined> {
    return this.entries.find((entry) => entry.matchId === matchId);
  }

  async getAll(): Promise<MatchHistoryEntry[]> {
    return [...this.entries];
  }

  async add(entry: MatchHistoryEntry): Promise<boolean> {
    if (this.entries.some((match) => match.matchId === entry.matchId)) return false;
    this.entries.push(entry);
    return true;
  }

  async reset(): Promise<void> {
    this.entries = [...matchFixtures];
  }
}

const DEFAULT_KEY = 'd120-s4';

describe('mock match API', () => {
  const database = new MemoryMatchesDatabase();

  beforeEach(() => {
    database.entries = [...matchFixtures];
    resetNetworkScenario();
    server.use(...createApiHandlers(database));
  });

  it('records a match idempotently', async () => {
    const fixture = matchFixtures[0];
    if (!fixture) throw new Error('Expected a match fixture.');
    const submission = {
      matchId: 'submitted-match',
      playerId: fixture.playerId,
      nickname: fixture.nickname,
      result: {
        outcome: fixture.outcome,
        score: fixture.score,
        survivedSeconds: fixture.survivedSeconds,
        seed: fixture.seed,
        config: fixture.config,
        endedAt: fixture.endedAt,
      },
    };

    const firstResponse = await fetch('http://localhost/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    const secondResponse = await fetch('http://localhost/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });

    expect(firstResponse.status).toBe(201);
    expect(await firstResponse.json()).toEqual({
      matchId: 'submitted-match',
      status: 'created',
    });
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual({
      matchId: 'submitted-match',
      status: 'already-recorded',
    });
    expect(database.entries.filter((entry) => entry.matchId === 'submitted-match')).toHaveLength(1);
  });

  it('filters ranking by configuration, ranks ties deterministically, and paginates', async () => {
    const fixture = matchFixtures[0];
    if (!fixture) throw new Error('Expected a match fixture.');
    const key = configKey(fixture.config);
    const response = await fetch(
      `http://localhost/api/ranking?configKey=${key}&page=2&pageSize=1`,
    );
    const page = await response.json();

    expect(response.status).toBe(200);
    expect(key).toBe(DEFAULT_KEY);
    expect(page).toMatchObject({ page: 2, pageSize: 1, total: 14, totalPages: 14 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      matchId: 'fixture-match-002',
      rank: 2,
      score: 12,
    });
  });

  it('paginates a player history in reverse chronological order', async () => {
    const response = await fetch(
      'http://localhost/api/history?playerId=fixture-player-ada&page=1&pageSize=1',
    );
    const page = await response.json();

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ page: 1, pageSize: 1, total: 7, totalPages: 7 });
    expect(page.items[0]).toMatchObject({ matchId: 'fixture-match-019' });
  });

  it('rejects malformed submissions and invalid pagination', async () => {
    const submissionResponse = await fetch('http://localhost/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: 'invalid' }),
    });
    const pageResponse = await fetch(
      'http://localhost/api/history?playerId=fixture-player-ada&page=0',
    );

    expect(submissionResponse.status).toBe(400);
    expect(pageResponse.status).toBe(400);
  });

  it('switches records requests into and out of the server-error scenario', async () => {
    setNetworkScenario('server-error');
    const failedResponse = await fetch(
      'http://localhost/api/ranking?configKey=d120-s3&page=1&pageSize=2',
    );
    expect(failedResponse.status).toBe(503);
    expect(await failedResponse.json()).toEqual({
      message: 'The mock records service is temporarily unavailable.',
    });

    resetNetworkScenario();
    const recoveredResponse = await fetch(
      'http://localhost/api/ranking?configKey=d120-s3&page=1&pageSize=2',
    );
    expect(recoveredResponse.status).toBe(200);
  });

  it('returns empty pages and generated extra pages on demand', async () => {
    setNetworkScenario('empty');
    const empty = await (await fetch(rankingUrl(1, 5))).json();
    expect(empty).toMatchObject({ items: [], total: 0, totalPages: 0 });

    setNetworkScenario('many-pages');
    const many = await (await fetch(rankingUrl(3, 10))).json();
    expect(many).toMatchObject({ page: 3, total: 74, totalPages: 8 });
    expect(many.items).toHaveLength(10);
    const history = await (
      await fetch('http://localhost/api/history?playerId=fixture-player-ada&page=1&pageSize=5')
    ).json();
    expect(history).toMatchObject({ total: 67, totalPages: 14 });
  });

  it('fails only the endpoint selected by the ranking and history error scenarios', async () => {
    const historyUrl = 'http://localhost/api/history?playerId=fixture-player-ada&page=1&pageSize=5';
    setNetworkScenario('ranking-error');
    expect((await fetch(rankingUrl(1, 5))).status).toBe(500);
    expect((await fetch(historyUrl)).status).toBe(200);

    setNetworkScenario('history-error');
    expect((await fetch(rankingUrl(1, 5))).status).toBe(200);
    expect((await fetch(historyUrl)).status).toBe(500);

    setNetworkScenario('client-error');
    expect((await fetch(rankingUrl(1, 5))).status).toBe(429);
  });

  it('fails every request with a network error during a connection failure', async () => {
    setNetworkScenario('connection-failure');
    await expect(fetch(rankingUrl(1, 5))).rejects.toThrow();
    await expect(
      fetch('http://localhost/api/matches', { method: 'POST', body: '{}' }),
    ).rejects.toThrow();
  });

  it('answers earlier requests later in the out-of-order scenario', async () => {
    setNetworkScenario('out-of-order');
    const finished: number[] = [];
    await Promise.all(
      [1, 2, 3].map((page) => fetch(rankingUrl(page, 5)).then(() => finished.push(page))),
    );
    expect(finished).toEqual([3, 2, 1]);
  }, 10_000);

  it('reproduces the same variable latency for the same scenario seed', async () => {
    const { nextRecordsDelayMs } = await import('./scenarios/network');
    setNetworkScenario('variable-latency', 42);
    const first = [nextRecordsDelayMs(), nextRecordsDelayMs(), nextRecordsDelayMs()];
    setNetworkScenario('variable-latency', 42);
    const second = [nextRecordsDelayMs(), nextRecordsDelayMs(), nextRecordsDelayMs()];
    expect(second).toEqual(first);
    expect(first.every((delay) => delay >= 100 && delay <= 2_500)).toBe(true);
  });

  it('restores the fixtures when the mock data is reset', async () => {
    const fixture = matchFixtures[0];
    if (!fixture) throw new Error('Expected a match fixture.');
    database.entries.push({ ...fixture, matchId: 'extra-match' });
    const response = await fetch('http://localhost/api/__mock/reset', { method: 'POST' });
    expect(response.status).toBe(204);
    expect(database.entries).toHaveLength(matchFixtures.length);
  });
});

function rankingUrl(page: number, pageSize: number): string {
  return `http://localhost/api/ranking?configKey=${DEFAULT_KEY}&page=${page}&pageSize=${pageSize}`;
}
