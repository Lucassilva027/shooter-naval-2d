export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Wraps an angle into the range (-PI, PI]. */
export function wrapAngle(angle: number): number {
  const wrapped = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Interpolates along the shortest arc between two angles. */
export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t;
}
