import { createMatchConfig, DEFAULT_OPTIONS, type GameConfig } from '@/config/gameConfig';
import type { MatchHistoryEntry } from '@/api/contracts';
import type { MatchOutcome } from '@/game/core/events';

const defaultConfig = createMatchConfig(DEFAULT_OPTIONS);
const quickConfig = createMatchConfig({ matchDurationSeconds: 60, enemySpawnSeconds: 1 });
const longConfig = createMatchConfig({ matchDurationSeconds: 180, enemySpawnSeconds: 4 });

const PLAYERS = {
  ada: 'Ada',
  grace: 'Grace',
  lin: 'Lin',
  anne: 'Anne Bonny',
  calico: 'Calico Jack',
  mary: 'Mary Read',
  blackbeard: 'Blackbeard',
  zheng: 'Zheng Yi Sao',
  morgan: 'Henry Morgan',
  low: 'Edward Low',
} as const;

type FixtureRow = readonly [
  id: number,
  player: keyof typeof PLAYERS,
  outcome: MatchOutcome,
  score: number,
  survivedSeconds: number,
  config: GameConfig,
  endedAt: string,
];

/**
 * Other captains' matches. The default settings fill three ranking pages, and Ada (the
 * captain used by the E2E records tests) has two pages of history.
 */
const ROWS: readonly FixtureRow[] = [
  [1, 'ada', 'timeout', 12, 120, defaultConfig, '2026-10-01T12:00:00.000Z'],
  [2, 'grace', 'destroyed', 12, 94, defaultConfig, '2026-10-01T12:05:00.000Z'],
  [3, 'ada', 'destroyed', 7, 60, quickConfig, '2026-10-01T12:10:00.000Z'],
  [4, 'lin', 'destroyed', 5, 83, defaultConfig, '2026-10-01T12:15:00.000Z'],
  [5, 'ada', 'timeout', 4, 120, defaultConfig, '2026-10-01T12:20:00.000Z'],
  [6, 'anne', 'timeout', 10, 120, defaultConfig, '2026-10-01T13:00:00.000Z'],
  [7, 'calico', 'destroyed', 9, 101, defaultConfig, '2026-10-01T13:10:00.000Z'],
  [8, 'mary', 'destroyed', 9, 88, defaultConfig, '2026-10-01T13:20:00.000Z'],
  [9, 'blackbeard', 'timeout', 8, 120, defaultConfig, '2026-10-01T13:30:00.000Z'],
  [10, 'zheng', 'destroyed', 7, 77, defaultConfig, '2026-10-01T13:40:00.000Z'],
  [11, 'ada', 'destroyed', 6, 70, defaultConfig, '2026-10-02T09:00:00.000Z'],
  [12, 'morgan', 'timeout', 6, 120, defaultConfig, '2026-10-02T09:15:00.000Z'],
  [13, 'low', 'destroyed', 3, 45, defaultConfig, '2026-10-02T09:30:00.000Z'],
  [14, 'grace', 'destroyed', 2, 31, defaultConfig, '2026-10-02T09:45:00.000Z'],
  [15, 'ada', 'destroyed', 1, 22, defaultConfig, '2026-10-02T10:00:00.000Z'],
  [16, 'grace', 'timeout', 9, 60, quickConfig, '2026-10-02T10:15:00.000Z'],
  [17, 'lin', 'destroyed', 6, 48, quickConfig, '2026-10-02T10:30:00.000Z'],
  [18, 'ada', 'timeout', 5, 60, quickConfig, '2026-10-02T11:00:00.000Z'],
  [19, 'ada', 'destroyed', 3, 95, longConfig, '2026-10-02T11:30:00.000Z'],
];

export const matchFixtures: readonly MatchHistoryEntry[] = ROWS.map(
  ([id, player, outcome, score, survivedSeconds, config, endedAt]) => ({
    matchId: `fixture-match-${String(id).padStart(3, '0')}`,
    playerId: `fixture-player-${player}`,
    nickname: PLAYERS[player],
    outcome,
    score,
    survivedSeconds,
    seed: id * 101,
    config,
    endedAt,
  }),
);

const GENERATED_COUNT = 60;

/**
 * Extra entries for the "many-pages" scenario, shaped to match whichever ranking or
 * history filter is being requested. Deterministic, so page contents are reproducible.
 */
export function generatedMatches(
  template: Pick<MatchHistoryEntry, 'config'> & Partial<Pick<MatchHistoryEntry, 'playerId' | 'nickname'>>,
): MatchHistoryEntry[] {
  return Array.from({ length: GENERATED_COUNT }, (_, index) => {
    const number = index + 1;
    const duration = template.config.match.durationSeconds;
    return {
      matchId: `generated-match-${String(number).padStart(3, '0')}`,
      playerId: template.playerId ?? `generated-player-${number}`,
      nickname: template.nickname ?? `Deckhand ${number}`,
      outcome: number % 3 === 0 ? 'timeout' : 'destroyed',
      score: (number * 7) % 15,
      survivedSeconds: number % 3 === 0 ? duration : 20 + ((number * 13) % (duration - 20)),
      seed: 10_000 + number,
      config: template.config,
      endedAt: new Date(Date.UTC(2026, 8, 1, 0, number)).toISOString(),
    };
  });
}
