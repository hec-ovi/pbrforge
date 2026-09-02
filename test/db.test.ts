import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import { MaterialsError } from '../src/db/errors.js';
import type { MaterialEntry } from '../src/db/types.js';

function entryFixture(key: string, aliases: string[] = []): MaterialEntry {
  return {
    key,
    ...(aliases.length ? { aliases } : {}),
    alignment: 'tile',
    tiling: { worldSize: [3, 3] },
    physical: { breakable: false },
    variants: [
      {
        id: '1',
        resolution: [64, 64],
        maps: {
          basecolor: 'assets/wall/poor/1/basecolor.png',
          normal: 'assets/wall/poor/1/normal.png',
          roughness: 'assets/wall/poor/1/roughness.png',
          metallic: 'assets/wall/poor/1/metallic.png',
        },
      },
    ],
  };
}

describe('database contract', () => {
  let themesDir: string;
  let db: Database;

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), 'materials-'));
    db = new Database(themesDir);
    db.ensureTheme('cyberpunk');
    mkdirSync(join(themesDir, 'cyberpunk/assets/wall/poor/1'), { recursive: true });
    for (const map of ['basecolor', 'normal', 'roughness', 'metallic']) {
      writeFileSync(join(themesDir, `cyberpunk/assets/wall/poor/1/${map}.png`), 'png');
    }
    db.write(entryFixture('cyberpunk/wall/poor', ['cyberpunk/wall-trim/poor']));
  });

  it('resolves a key to its entry', () => {
    const entry = db.resolve('cyberpunk/wall/poor');
    expect(entry.alignment).toBe('tile');
    expect(entry.tiling?.worldSize).toEqual([3, 3]);
    expect(entry.variants[0].maps.basecolor).toBe('assets/wall/poor/1/basecolor.png');
  });

  it('resolves an alias to the same entry', () => {
    expect(db.resolve('cyberpunk/wall-trim/poor').key).toBe('cyberpunk/wall/poor');
  });

  it('throws E_KEY_NOT_FOUND for an unknown key', () => {
    expect(() => db.resolve('cyberpunk/wall/high_rich')).toThrowError(
      expect.objectContaining({ code: 'E_KEY_NOT_FOUND' }),
    );
  });

  it('throws E_THEME_NOT_FOUND for a missing theme', () => {
    expect(() => db.resolve('medieval/wall/poor')).toThrowError(
      expect.objectContaining({ code: 'E_THEME_NOT_FOUND' }),
    );
  });

  it('throws E_SCHEMA for a malformed key', () => {
    expect(() => db.resolve('not-a-key')).toThrowError(expect.objectContaining({ code: 'E_SCHEMA' }));
  });

  it('lists keys sorted with filters applied', () => {
    expect(db.list()).toEqual(['cyberpunk/wall/poor']);
    expect(db.list({ theme: 'cyberpunk', kind: 'wall', tier: 'poor' })).toEqual(['cyberpunk/wall/poor']);
    expect(db.list({ tier: 'rich' })).toEqual([]);
  });

  it('refuses to overwrite an existing key without overwrite', () => {
    expect(() => db.write(entryFixture('cyberpunk/wall/poor'))).toThrowError(
      expect.objectContaining({ code: 'E_KEY_EXISTS' }),
    );
    db.write(entryFixture('cyberpunk/wall/poor'), true);
  });

  it('refuses an entry whose map files are not on disk', () => {
    const entry = entryFixture('cyberpunk/roof/poor');
    entry.variants[0].maps.basecolor = 'assets/roof/poor/1/basecolor.png';
    expect(() => db.write(entry)).toThrowError(expect.objectContaining({ code: 'E_SCHEMA' }));
  });

  it('typed error carries the closed-set code', () => {
    try {
      db.resolve('cyberpunk/none/none');
    } catch (e) {
      expect(e).toBeInstanceOf(MaterialsError);
      return;
    }
    expect.unreachable();
  });
});

/** The kind vocabulary the contract guarantees, aliases included. */
const KINDS = [
  'wall', 'wall-trim', 'column', 'window-glass', 'window-frame', 'curtain', 'door', 'door-glass',
  'balcony-slab', 'balcony-rail', 'roof', 'floor-slab', 'parapet', 'signage', 'ad-screen',
  'light-fixture', 'fire-escape', 'aperture-frame', 'roof-artifact',
  'plaster', 'tile', 'ceiling', 'wood', 'carpet', 'rubber', 'concrete', 'metal', 'elevator_door', 'fabric', 'glass',
  'sidewalk', 'road', 'curb', 'plastic', 'ad-screen-tall', 'letter-atlas', 'ac-unit',
];

describe('shipped cyberpunk coverage', () => {
  const db = new Database(join(dirname(fileURLToPath(import.meta.url)), '..', 'themes'));

  it('resolves every guaranteed kind at all four tiers', () => {
    const missing = KINDS.flatMap((kind) =>
      ['poor', 'mid', 'rich', 'high_rich']
        .map((tier) => `cyberpunk/${kind}/${tier}`)
        .filter((key) => {
          try {
            return db.resolve(key).variants.length === 0;
          } catch {
            return true;
          }
        }),
    );
    expect(missing).toEqual([]);
  });

  it('ships every non-emissive entry matte: metallic 0 or 1, roughness never below 0.45 except glass', async () => {
    const floor = Math.floor(0.45 * 255);
    const themeDir = db.themeDir('cyberpunk');
    const offences: string[] = [];
    for (const key of db.list({ theme: 'cyberpunk' })) {
      const entry = db.resolve(key);
      const glass = (entry.physical.transmission ?? 0) > 0;
      const lit = entry.variants.some((v) => v.maps.emission);
      if (glass || lit) continue;
      const metallic = entry.physical.metallicFactor ?? 0;
      if (metallic !== 0 && metallic !== 1) offences.push(`${key} metallic ${metallic}`);
      if ((entry.physical.roughnessFactor ?? 1) < 0.45) offences.push(`${key} roughness factor`);
      if (entry.finish && entry.finish.roughness[0] < 0.45) offences.push(`${key} finish band`);
      for (const variant of entry.variants) {
        const gloss = (await sharp(join(themeDir, variant.maps.roughness)).stats()).channels[0];
        if (gloss.min < floor) offences.push(`${key}:${variant.id} roughness map ${gloss.min}`);
        const fill = (await sharp(join(themeDir, variant.maps.metallic)).stats()).channels[0];
        if (fill.min !== fill.max || fill.min !== Math.round(metallic * 255)) offences.push(`${key}:${variant.id} metallic map`);
      }
    }
    expect(offences).toEqual([]);
  }, 120_000);
});
