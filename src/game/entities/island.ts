import type { IslandArt, IslandPreset } from '@/config/gameConfig';
import type { Size } from '../core/worldSize';

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Static obstacle that blocks ships and projectiles, described as a union of circles. */
export interface Island {
  readonly x: number;
  readonly y: number;
  /** Half of the visible extent. */
  readonly radius: number;
  /** Encloses every collider; used for broad checks. */
  readonly boundingRadius: number;
  readonly art: IslandArt;
  readonly colliders: readonly Circle[];
}

export function selectIslandLayout(
  layouts: readonly (readonly IslandPreset[])[],
  seed: number,
): readonly IslandPreset[] {
  if (layouts.length === 0) throw new RangeError('At least one island layout is required.');
  const index = ((seed >>> 0) % layouts.length + layouts.length - 1) % layouts.length;
  const layout = layouts[index];
  if (!layout) throw new Error('Could not select an island layout for the match seed.');
  return layout;
}

/** Collider layout per artwork, in units of the island radius. */
const SHAPES: Readonly<Record<IslandArt, readonly Circle[]>> = {
  // Rounded squares: a central circle plus one circle filling each corner.
  sandIsland: roundedSquare(),
  grassIsland: roundedSquare(),
  rock: [{ x: 0, y: 0, radius: 1 }],
};

function roundedSquare(): Circle[] {
  const c = 0.58;
  const r = 0.42;
  return [
    { x: 0, y: 0, radius: 1 },
    { x: -c, y: -c, radius: r },
    { x: c, y: -c, radius: r },
    { x: -c, y: c, radius: r },
    { x: c, y: c, radius: r },
  ];
}

export function placeIslands(presets: readonly IslandPreset[], arena: Size): Island[] {
  return presets.map((preset) => {
    const x = preset.x * arena.width;
    const y = preset.y * arena.height;
    const colliders = SHAPES[preset.art].map((shape) => ({
      x: x + shape.x * preset.radius,
      y: y + shape.y * preset.radius,
      radius: shape.radius * preset.radius,
    }));
    const boundingRadius = Math.max(
      ...colliders.map((c) => Math.hypot(c.x - x, c.y - y) + c.radius),
    );
    return { x, y, radius: preset.radius, boundingRadius, art: preset.art, colliders };
  });
}
