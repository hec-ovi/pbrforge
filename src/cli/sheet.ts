import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type OverlayOptions } from 'sharp';
import { Database } from '../db/Database.js';
import { MaterialsError } from '../db/errors.js';
import type { MapName } from '../db/types.js';
import { decodeRgb, encodeRgbPng } from '../gen/pixels.js';
import { stampBrand } from '../gen/text.js';

/**
 * Contact sheet: every variant of a kind side by side, one row each, so a
 * family is checked as a family (do the variants read apart? is the gloss map
 * calm?) instead of one sphere at a time.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [kind, tier] = process.argv.slice(2);
if (!kind) {
  console.error('usage: npm run sheet -- <kind> [tier]');
  process.exit(2);
}

const CELL = 200;
const GAP = 6;
const COLUMNS: MapName[] = ['basecolor', 'roughness', 'normal'];

const db = new Database(join(root, 'themes'));

try {
  const rows: { label: string; maps: Partial<Record<MapName, string>>; theme: string }[] = [];
  for (const key of db.list({ kind, tier })) {
    const entry = db.resolve(key);
    const [theme, , entryTier] = key.split('/');
    for (const variant of entry.variants) {
      rows.push({ label: `${entryTier}-${variant.id}`, maps: variant.maps, theme });
    }
  }
  if (!rows.length) throw new MaterialsError('E_KEY_NOT_FOUND', `no entries for kind ${kind}`);

  const width = COLUMNS.length * CELL + (COLUMNS.length + 1) * GAP;
  const height = rows.length * CELL + (rows.length + 1) * GAP;
  const tiles: OverlayOptions[] = [];
  for (const [row, { label, maps, theme }] of rows.entries()) {
    for (const [column, name] of COLUMNS.entries()) {
      const path = maps[name];
      if (!path) continue;
      let cell: Buffer = await sharp(readFileSync(join(db.themeDir(theme), path)))
        .resize(CELL, CELL, { fit: 'fill' })
        .toColourspace('srgb')
        .png()
        .toBuffer();
      if (name === 'basecolor') cell = await encodeRgbPng(stampBrand(await decodeRgb(cell), label));
      tiles.push({ input: cell, left: GAP + column * (CELL + GAP), top: GAP + row * (CELL + GAP) });
    }
  }

  const sheet = await sharp({
    create: { width, height, channels: 3, background: { r: 24, g: 24, b: 26 } },
  })
    .composite(tiles)
    .png()
    .toBuffer();

  mkdirSync(join(root, 'out'), { recursive: true });
  const file = join(root, 'out', `${kind}${tier ? `-${tier}` : ''}.png`);
  writeFileSync(file, sheet);
  console.log(`${file}  ${rows.length} variants, columns: ${COLUMNS.join(' | ')}`);
} catch (e) {
  if (e instanceof MaterialsError) {
    console.error(`${e.code}: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
