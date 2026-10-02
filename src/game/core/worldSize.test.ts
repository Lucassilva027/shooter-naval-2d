import { describe, expect, it } from 'vitest';
import { resolveWorldSize } from './worldSize';

const LIMITS = { minWidth: 1024, minHeight: 576, maxWidth: 1920, maxHeight: 1080 };

describe('resolveWorldSize', () => {
  it('uses the viewport size when it is within limits', () => {
    expect(resolveWorldSize({ width: 1440, height: 800 }, LIMITS)).toEqual({
      width: 1440,
      height: 800,
    });
  });

  it('grows small (mobile) viewports while keeping their aspect ratio', () => {
    const size = resolveWorldSize({ width: 844, height: 390 }, LIMITS);
    expect(size.height).toBeGreaterThanOrEqual(576);
    expect(size.width / size.height).toBeCloseTo(844 / 390, 1);
  });

  it('caps very large viewports', () => {
    expect(resolveWorldSize({ width: 3840, height: 2160 }, LIMITS)).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});
