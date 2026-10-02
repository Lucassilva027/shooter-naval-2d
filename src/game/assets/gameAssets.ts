import { Assets, Rectangle, Texture, type Spritesheet } from 'pixi.js';
import type { IslandArt } from '@/config/gameConfig';

export type ShipSkin = 'player' | 'chaser' | 'shooter';

export interface GameTextures {
  /** Hull textures per skin, ordered from intact to wrecked. */
  readonly ships: Readonly<Record<ShipSkin, readonly Texture[]>>;
  readonly water: Texture;
  readonly islands: Readonly<Record<IslandArt, Texture>>;
  readonly cannonBall: Texture;
  /** Ordered from largest to smallest. */
  readonly explosions: readonly Texture[];
  readonly flames: readonly Texture[];
  readonly debris: readonly Texture[];
}

/** Base hull index per skin in the ships atlas (ship_1..ship_6 are the six colours). */
const SHIP_BASE_INDEX: Readonly<Record<ShipSkin, number>> = {
  player: 5, // blue
  chaser: 3, // red
  shooter: 2, // black
};
/** The atlas stores each damage stage 6 frames apart: intact, damaged, heavily damaged, wreck. */
const DAMAGE_STAGE_OFFSET = 6;
const DAMAGE_STAGES = 4;

/** Regions of tiles_sheet.png in logical (1x) pixels; the sheet is a 64px grid. */
const ISLAND_FRAMES: Readonly<Record<IslandArt, Rectangle>> = {
  sandIsland: new Rectangle(0, 0, 192, 192),
  grassIsland: new Rectangle(320, 0, 256, 256),
  rock: new Rectangle(64, 192, 64, 64),
};

const ALIAS = {
  ships: 'pirate-battle/ships',
  water: 'pirate-battle/water',
  tiles: 'pirate-battle/tiles',
} as const;

export class AssetLoadError extends Error {
  override readonly name = 'AssetLoadError';
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}

/** Sub-textures are cached per atlas source so every match reuses the same objects. */
const islandTextureCache = new WeakMap<Texture, Record<IslandArt, Texture>>();

/**
 * Loads (or reuses from the Assets cache) every texture a match needs. Textures are
 * shared across matches and are intentionally not unloaded when a match ends.
 */
export async function loadGameTextures(
  onProgress: (progress: number) => void,
): Promise<GameTextures> {
  const retina = window.devicePixelRatio >= 1.5;
  const density = retina ? 'retina' : 'default';
  const suffix = retina ? '_retina' : '';
  const resolution = retina ? 2 : 1;

  try {
    const loaded = await Assets.load<Spritesheet | Texture>(
      [
        {
          alias: ALIAS.ships,
          src: assetUrl(`spritesheet/ships_miscellaneous_sheet${suffix}.json`),
        },
        {
          alias: ALIAS.water,
          src: assetUrl(`png/${density}/tiles/tile_73.png`),
          data: { resolution },
        },
        {
          alias: ALIAS.tiles,
          src: assetUrl(`tilesheet/tiles_sheet${suffix}.png`),
          data: { resolution },
        },
      ],
      { onProgress, strategy: 'retry', retryCount: 2, retryDelay: 400 },
    );

    const sheet = loaded[ALIAS.ships] as Spritesheet;
    return {
      ships: {
        player: hullStages(sheet, SHIP_BASE_INDEX.player),
        chaser: hullStages(sheet, SHIP_BASE_INDEX.chaser),
        shooter: hullStages(sheet, SHIP_BASE_INDEX.shooter),
      },
      water: loaded[ALIAS.water] as Texture,
      islands: islandTextures(loaded[ALIAS.tiles] as Texture),
      cannonBall: frame(sheet, 'cannon_ball'),
      explosions: ['explosion_1', 'explosion_2', 'explosion_3'].map((name) => frame(sheet, name)),
      flames: ['fire_1', 'fire_2'].map((name) => frame(sheet, name)),
      debris: ['wood_1', 'wood_2', 'wood_3', 'wood_4'].map((name) => frame(sheet, name)),
    };
  } catch (error) {
    throw new AssetLoadError('Could not load the game assets.', { cause: error });
  }
}

function hullStages(sheet: Spritesheet, baseIndex: number): Texture[] {
  return Array.from({ length: DAMAGE_STAGES }, (_, stage) =>
    frame(sheet, `ship_${baseIndex + stage * DAMAGE_STAGE_OFFSET}`),
  );
}

function frame(sheet: Spritesheet, name: string): Texture {
  const texture = sheet.textures[name];
  if (!texture) throw new AssetLoadError(`Missing frame "${name}" in ships atlas`);
  return texture;
}

function islandTextures(tiles: Texture): Record<IslandArt, Texture> {
  let textures = islandTextureCache.get(tiles);
  if (!textures) {
    const cut = (art: IslandArt) =>
      new Texture({ source: tiles.source, frame: ISLAND_FRAMES[art] });
    textures = {
      sandIsland: cut('sandIsland'),
      grassIsland: cut('grassIsland'),
      rock: cut('rock'),
    };
    islandTextureCache.set(tiles, textures);
  }
  return textures;
}
