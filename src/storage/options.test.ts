import { describe, expect, it } from 'vitest';
import {
  createMatchConfig,
  DEFAULT_OPTIONS,
  defaultGameConfig,
  normalizeOption,
  OPTION_LIMITS,
} from '@/config/gameConfig';
import { parseOptions } from './options';

const duration = OPTION_LIMITS.matchDurationSeconds;
const spawn = OPTION_LIMITS.enemySpawnSeconds;

describe('normalizeOption', () => {
  it('keeps valid values', () => {
    expect(normalizeOption(90, duration)).toBe(90);
    expect(normalizeOption(7, spawn)).toBe(7);
  });

  it('clamps into the documented limits', () => {
    expect(normalizeOption(10, duration)).toBe(60);
    expect(normalizeOption(999, duration)).toBe(180);
    expect(normalizeOption(0, spawn)).toBe(1);
    expect(normalizeOption(-5, spawn)).toBe(1);
  });

  it('snaps to the step grid', () => {
    expect(normalizeOption(94, duration)).toBe(90);
    expect(normalizeOption(96, duration)).toBe(100);
    expect(normalizeOption(2.6, spawn)).toBe(3);
  });

  it('falls back to the default for anything that is not a finite number', () => {
    for (const bad of ['120', null, undefined, Number.NaN, Infinity, {}]) {
      expect(normalizeOption(bad, duration)).toBe(duration.default);
    }
  });
});

describe('parseOptions', () => {
  it('repairs each field independently', () => {
    expect(parseOptions({ matchDurationSeconds: 'oops', enemySpawnSeconds: 99 })).toEqual({
      matchDurationSeconds: duration.default,
      enemySpawnSeconds: spawn.max,
    });
  });

  it('returns the defaults for non-objects', () => {
    expect(parseOptions('garbage')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
  });
});

describe('createMatchConfig', () => {
  it('applies the options to a frozen snapshot without touching the base config', () => {
    const config = createMatchConfig({ matchDurationSeconds: 60, enemySpawnSeconds: 10 });
    expect(config.match.durationSeconds).toBe(60);
    expect(config.enemies.spawn.intervalSeconds).toBe(10);
    expect(Object.isFrozen(config.enemies.spawn)).toBe(true);
    expect(defaultGameConfig.match.durationSeconds).toBe(duration.default);
  });

  it('normalizes out-of-range options', () => {
    const config = createMatchConfig({ matchDurationSeconds: 5000, enemySpawnSeconds: 0 });
    expect(config.match.durationSeconds).toBe(180);
    expect(config.enemies.spawn.intervalSeconds).toBe(1);
  });
});
