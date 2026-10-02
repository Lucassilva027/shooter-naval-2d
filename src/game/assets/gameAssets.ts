import { Assets, type Spritesheet, type Texture } from 'pixi.js';

export type ShipSkin = 'player' | 'chaser' | 'shooter';

export interface GameTextures {
  /** Hull textures per skin, ordered from intact to wrecked. */
  readonly ships: Readonly<Record<ShipSkin, readonly Texture[]>>;
  readonly water: Texture;
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

const ALIAS = {
  ships: 'pirate-battle/ships',
  water: 'pirate-battle/water',
} as const;

export class AssetLoadError extends Error {
  override readonly name = 'AssetLoadError';
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}

/**
 * Loads (or reuses from the Assets cache) every texture a match needs. Textures are
 * shared across matches and are intentionally not unloaded when a match ends.
 */
export async function loadGameTextures(
  onProgress: (progress: number) => void,
): Promise<GameTextures> {
  const retina = window.devicePixelRatio >= 1.5;
  const density = retina ? 'retina' : 'default';

  try {
    const loaded = await Assets.load<Spritesheet | Texture>(
      [
        {
          alias: ALIAS.ships,
          src: assetUrl(`spritesheet/ships_miscellaneous_sheet${retina ? '_retina' : ''}.json`),
        },
        {
          alias: ALIAS.water,
          src: assetUrl(`png/${density}/tiles/tile_73.png`),
          data: { resolution: retina ? 2 : 1 },
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
