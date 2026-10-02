const EPSILON = 1e-9;

/**
 * Converts variable frame deltas into a whole number of fixed simulation steps, so the
 * simulation produces identical results at any frame rate. The remainder is returned as
 * an interpolation factor for rendering between the last two simulated states.
 */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(
    private readonly stepSeconds: number,
    private readonly maxFrameSeconds: number,
  ) {
    if (stepSeconds <= 0) throw new RangeError('stepSeconds must be positive');
  }

  /** Runs every due step and returns the render interpolation factor in [0, 1). */
  advance(frameSeconds: number, step: (dt: number) => void): number {
    const safeDelta = Number.isFinite(frameSeconds) ? frameSeconds : 0;
    this.accumulator += Math.min(Math.max(safeDelta, 0), this.maxFrameSeconds);

    while (this.accumulator + EPSILON >= this.stepSeconds) {
      step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
    }
    if (this.accumulator < 0) this.accumulator = 0;

    return this.accumulator / this.stepSeconds;
  }

  /** Drops any partially accumulated time (e.g. when resuming from pause). */
  reset(): void {
    this.accumulator = 0;
  }
}
