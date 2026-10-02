import type { WorldConfig } from '@/config/gameConfig';
import { clamp } from './math';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Picks a world size that follows the viewport's aspect ratio while staying within the
 * configured limits. Called once per match; the result never changes mid-match.
 */
export function resolveWorldSize(viewport: Size, limits: WorldConfig): Size {
  const viewWidth = Math.max(viewport.width, 1);
  const viewHeight = Math.max(viewport.height, 1);

  const grow = Math.max(1, limits.minWidth / viewWidth, limits.minHeight / viewHeight);
  let width = viewWidth * grow;
  let height = viewHeight * grow;

  const shrink = Math.min(1, limits.maxWidth / width, limits.maxHeight / height);
  width *= shrink;
  height *= shrink;

  return {
    width: Math.round(clamp(width, limits.minWidth, limits.maxWidth)),
    height: Math.round(clamp(height, limits.minHeight, limits.maxHeight)),
  };
}
