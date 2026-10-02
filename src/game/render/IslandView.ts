import { Sprite, type Texture } from 'pixi.js';
import type { IslandArt } from '@/config/gameConfig';
import type { Island } from '../entities/island';

/** Fraction of each artwork's frame covered by the visible island, so the colliders hug the coast. */
const VISIBLE_FILL: Readonly<Record<IslandArt, number>> = {
  sandIsland: 0.94,
  grassIsland: 0.94,
  rock: 0.72,
};

export function createIslandSprite(island: Island, texture: Texture): Sprite {
  const size = (island.radius * 2) / VISIBLE_FILL[island.art];
  return new Sprite({
    texture,
    anchor: 0.5,
    x: island.x,
    y: island.y,
    width: size,
    height: size,
  });
}
