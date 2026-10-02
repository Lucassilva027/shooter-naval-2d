import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './FixedStepLoop';

const STEP = 1 / 60;

function countSteps(loop: FixedStepLoop, frames: number, frameSeconds: number): number {
  let steps = 0;
  for (let i = 0; i < frames; i++) loop.advance(frameSeconds, () => steps++);
  return steps;
}

describe('FixedStepLoop', () => {
  it('runs the same number of steps for one second at any frame rate', () => {
    for (const fps of [30, 60, 75, 144, 240]) {
      expect(countSteps(new FixedStepLoop(STEP, 0.25), fps, 1 / fps)).toBe(60);
    }
  });

  it('returns an interpolation factor for the leftover time', () => {
    const loop = new FixedStepLoop(STEP, 0.25);
    const alpha = loop.advance(STEP * 1.5, () => undefined);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('drops time beyond maxFrameSeconds instead of replaying it', () => {
    const loop = new FixedStepLoop(STEP, 0.25);
    expect(countSteps(loop, 1, 10)).toBe(15);
  });

  it('ignores negative and non-finite deltas', () => {
    const loop = new FixedStepLoop(STEP, 0.25);
    expect(countSteps(loop, 1, -1) + countSteps(loop, 1, Number.NaN)).toBe(0);
  });

  it('reset discards partial time', () => {
    const loop = new FixedStepLoop(STEP, 0.25);
    loop.advance(STEP * 0.9, () => undefined);
    loop.reset();
    expect(countSteps(loop, 1, STEP * 0.5)).toBe(0);
  });
});
