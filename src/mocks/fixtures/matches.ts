import { createMatchConfig, DEFAULT_OPTIONS } from '@/config/gameConfig';
import type { MatchHistoryEntry } from '@/api/contracts';

const defaultConfig = createMatchConfig(DEFAULT_OPTIONS);
const quickConfig = createMatchConfig({ matchDurationSeconds: 60, enemySpawnSeconds: 1 });

export const matchFixtures: readonly MatchHistoryEntry[] = [
  {
    matchId: 'fixture-match-001',
    playerId: 'fixture-player-ada',
    nickname: 'Ada',
    outcome: 'timeout',
    score: 12,
    survivedSeconds: 120,
    seed: 101,
    config: defaultConfig,
    endedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    matchId: 'fixture-match-002',
    playerId: 'fixture-player-grace',
    nickname: 'Grace',
    outcome: 'destroyed',
    score: 12,
    survivedSeconds: 94,
    seed: 202,
    config: defaultConfig,
    endedAt: '2026-10-01T12:05:00.000Z',
  },
  {
    matchId: 'fixture-match-003',
    playerId: 'fixture-player-ada',
    nickname: 'Ada',
    outcome: 'destroyed',
    score: 7,
    survivedSeconds: 60,
    seed: 303,
    config: quickConfig,
    endedAt: '2026-10-01T12:10:00.000Z',
  },
  {
    matchId: 'fixture-match-004',
    playerId: 'fixture-player-lin',
    nickname: 'Lin',
    outcome: 'destroyed',
    score: 5,
    survivedSeconds: 83,
    seed: 404,
    config: defaultConfig,
    endedAt: '2026-10-01T12:15:00.000Z',
  },
  {
    matchId: 'fixture-match-005',
    playerId: 'fixture-player-ada',
    nickname: 'Ada',
    outcome: 'timeout',
    score: 4,
    survivedSeconds: 120,
    seed: 505,
    config: defaultConfig,
    endedAt: '2026-10-01T12:20:00.000Z',
  },
];
