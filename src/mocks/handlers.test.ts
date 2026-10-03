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
}

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
    expect(page).toMatchObject({ page: 2, pageSize: 1, total: 4, totalPages: 4 });
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
    expect(page).toMatchObject({ page: 1, pageSize: 1, total: 3, totalPages: 3 });
    expect(page.items[0]).toMatchObject({ matchId: 'fixture-match-005' });
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
});
