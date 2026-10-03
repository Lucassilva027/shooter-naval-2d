import { describe, expect, it } from 'vitest';
import { ManualGameClock } from './gameTestHooks';

describe('ManualGameClock', () => {
  it('returns all queued time once, then clears it', () => {
    const clock = new ManualGameClock();
    clock.advance(250);
    clock.advance(750);

    expect(clock.consumeFrame()).toBe(1);
    expect(clock.consumeFrame()).toBe(0);
  });

  it('discards queued time when reset', () => {
    const clock = new ManualGameClock();
    clock.advance(1_000);
    clock.reset();

    expect(clock.consumeFrame()).toBe(0);
  });

  it('rejects invalid time advances', () => {
    const clock = new ManualGameClock();

    for (const milliseconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => clock.advance(milliseconds)).toThrow(RangeError);
    }
  });
});
