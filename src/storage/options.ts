import {
  DEFAULT_OPTIONS,
  normalizeOption,
  OPTION_LIMITS,
  type GameOptions,
} from '@/config/gameConfig';
import { readStored, removeStored, writeStored } from './localStore';

const KEY = 'options';

/** Each field is repaired on its own, so one bad value never discards the other. */
export function parseOptions(raw: unknown): GameOptions {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    matchDurationSeconds: normalizeOption(
      record.matchDurationSeconds,
      OPTION_LIMITS.matchDurationSeconds,
    ),
    enemySpawnSeconds: normalizeOption(record.enemySpawnSeconds, OPTION_LIMITS.enemySpawnSeconds),
  };
}

export function loadOptions(): GameOptions {
  return readStored(KEY, parseOptions) ?? DEFAULT_OPTIONS;
}

export function saveOptions(options: GameOptions): GameOptions {
  const normalized = parseOptions(options);
  writeStored(KEY, normalized);
  return normalized;
}

export function resetOptions(): GameOptions {
  removeStored(KEY);
  return DEFAULT_OPTIONS;
}
