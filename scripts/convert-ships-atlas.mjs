// Converts the Starling/Sparrow XML atlases shipped in assets/spritesheet into
// PixiJS spritesheet JSON. Run with `npm run assets:atlas`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const SHEET_DIR = 'public/assets/spritesheet';
const SHEETS = [
  { xml: 'ships_miscellaneous_sheet.xml', scale: 1 },
  { xml: 'ships_miscellaneous_sheet_retina.xml', scale: 2 },
];

function readPngSize(path) {
  const buffer = readFileSync(path);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

for (const { xml, scale } of SHEETS) {
  const { TextureAtlas: atlas } = parser.parse(readFileSync(join(SHEET_DIR, xml), 'utf8'));
  const subTextures = Array.isArray(atlas.SubTexture) ? atlas.SubTexture : [atlas.SubTexture];

  const frames = {};
  for (const sub of subTextures) {
    const w = Number(sub.width);
    const h = Number(sub.height);
    frames[sub.name.replace(/\.png$/, '')] = {
      frame: { x: Number(sub.x), y: Number(sub.y), w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    };
  }

  const output = {
    frames,
    meta: {
      image: atlas.imagePath,
      format: 'RGBA8888',
      size: readPngSize(join(SHEET_DIR, atlas.imagePath)),
      scale: String(scale),
    },
  };

  const target = join(SHEET_DIR, xml.replace(/\.xml$/, '.json'));
  writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`${target}: ${subTextures.length} frames`);
}
