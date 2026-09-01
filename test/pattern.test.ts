import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';
import { buildPattern } from '../src/gen/pattern/build.js';
import { CHARSET, GRID } from '../src/gen/pattern/GlyphAtlas.js';
import type { CreateRequest, PatternSpec } from '../src/db/types.js';

/** Nothing in this lane reaches ComfyUI: a generator pointed at a dead port proves it. */
const offline = (db: Database) => new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));

const wall: CreateRequest = {
  key: 'cyberpunk/plaster/mid',
  alignment: 'tile',
  description: 'hexagon printed wall panel',
  tiling: { worldSize: [3, 3] },
  physical: { roughnessFactor: 0.8, metallicFactor: 0 },
  resolution: [128, 128],
  pattern: { kind: 'hexagon', colors: ['#b9bcbb'], cells: [7, 4], sheen: 0.16, joint: 0.12 },
};

/** One spec per kind of the library, each with the parameters that kind reads. */
const kinds: PatternSpec[] = [
  { kind: 'hexagon', colors: ['#b9bcbb'], cells: [7, 4], sheen: 0.16 },
  { kind: 'panel-grid', colors: ['#aab1b5'], cells: [2, 2], bevel: 0.035 },
  { kind: 'slab', colors: ['#8d8f8a'], cells: [3, 4], bond: 'running' },
  { kind: 'stripe', colors: ['#eef2f2', '#23262a'], cells: [1, 2], split: 0.34 },
  { kind: 'two-tone', colors: ['#2e6b73', '#b9bcbb', '#cfe9ee'], split: 0.42 },
  { kind: 'noise', colors: ['#26282a', '#33363a'], cells: [8, 8], octaves: 4 },
  { kind: 'puddle', colors: ['#202225', '#2e3134', '#0d0f12'], cells: [8, 8], octaves: 3, wet: 0.42 },
  { kind: 'glyph-atlas', colors: ['#eafcff', '#7fe8ff', '#10161a'], line: 0.045, bevel: 0.05 },
];

/** The road the puddle variant is drawn on: dry asphalt is the base, the mask floods part of it. */
const road: CreateRequest = {
  key: 'cyberpunk/road/poor',
  alignment: 'tile',
  description: 'wet asphalt with standing puddles',
  tiling: { worldSize: [6, 6] },
  physical: { roughnessFactor: 0.95, metallicFactor: 0 },
  resolution: [128, 128],
  pattern: { kind: 'puddle', colors: ['#202225', '#2e3134', '#0d0f12'], cells: [8, 8], octaves: 3, wet: 0.42 },
};

describe('pattern class', () => {
  let themesDir: string;
  let db: Database;

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), 'materials-'));
    db = new Database(themesDir);
  });

  it('writes a pattern entry with the full map set and no ComfyUI', async () => {
    const entry = await offline(db).create(wall);
    const variant = entry.variants[0];
    expect(variant.class).toBe('pattern');
    for (const name of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao'] as const) {
      expect(existsSync(join(themesDir, 'cyberpunk', variant.maps[name]!)), name).toBe(true);
    }
    // the same shape an image entry has: consumers read it without knowing which class it is
    const resolved = db.resolve('cyberpunk/plaster/mid');
    expect(resolved.tiling?.worldSize).toEqual([3, 3]);
    expect(resolved.variants[0].resolution).toEqual([128, 128]);
  });

  it('draws the same maps twice from the same parameters', async () => {
    const first = await offline(db).create(wall);
    const second = await offline(db).create({ ...wall, overwrite: true });
    const read = (file: string) => readFileSync(join(themesDir, 'cyberpunk', file));
    expect(read(second.variants[0].maps.basecolor)).toEqual(read(first.variants[0].maps.basecolor));
    expect(read(second.variants[0].maps.roughness)).toEqual(read(first.variants[0].maps.roughness));
  });

  it('is periodic over one tile, in every kind', () => {
    for (const spec of kinds) {
      const pattern = buildPattern(spec, [3, 3], 0.8, 99);
      for (let i = 0; i < 64; i++) {
        const u = (i + 0.5) / 64;
        const v = (i * 7 + 0.5) / 64;
        expect(pattern.sample(u + 1, v, 1 / 64, 1 / 64), `${spec.kind} across x`).toEqual(
          pattern.sample(u, v, 1 / 64, 1 / 64),
        );
        expect(pattern.sample(u, v + 1, 1 / 64, 1 / 64), `${spec.kind} across y`).toEqual(
          pattern.sample(u, v, 1 / 64, 1 / 64),
        );
      }
    }
  });

  it('throws E_SCHEMA on parameters that cannot wrap or cannot be drawn', async () => {
    const generator = offline(db);
    await expect(
      generator.create({ ...wall, pattern: { kind: 'slab', colors: ['#8d8f8a'], cells: [3, 3], bond: 'running' } }),
    ).rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(
      generator.create({ ...wall, pattern: { kind: 'stripe', colors: ['#8d8f8a'] } }),
    ).rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(generator.create({ ...wall, variants: 2 })).rejects.toMatchObject({ code: 'E_SCHEMA' });
  });

  it('appends a variant to an existing entry, which keeps its tiling and physical', async () => {
    const generator = offline(db);
    await generator.create(wall);
    const entry = await generator.create({
      key: 'cyberpunk/plaster/mid',
      alignment: 'tile',
      append: true,
      variantId: 'two-tone',
      description: 'wainscot panel under a painted wall',
      resolution: [128, 128],
      pattern: { kind: 'two-tone', colors: ['#2e6b73', '#b9bcbb', '#cfe9ee'], split: 0.42 },
    });
    expect(entry.variants.map((v) => v.id)).toEqual(['1', 'two-tone']);
    expect(entry.physical.roughnessFactor).toBe(0.8);
    expect(entry.tiling?.worldSize).toEqual([3, 3]);
    await expect(
      generator.create({
        key: 'cyberpunk/plaster/mid',
        alignment: 'tile',
        append: true,
        variantId: 'two-tone',
        description: 'wainscot panel under a painted wall',
        pattern: { kind: 'two-tone', colors: ['#2e6b73', '#b9bcbb', '#cfe9ee'] },
      }),
    ).rejects.toMatchObject({ code: 'E_KEY_EXISTS' });
  });

  it('draws the letter atlas one glyph to a cell, in the published grid', async () => {
    const entry = await offline(db).create({
      key: 'cyberpunk/letter-atlas/mid',
      alignment: 'exact',
      description: 'neon tube letter sheet',
      aspect: [4, 3],
      physical: { roughnessFactor: 0.3, emissiveStrength: 5 },
      resolution: [256, 192],
      emission: 'luminance',
      variantId: 'neon',
      pattern: { kind: 'glyph-atlas', colors: ['#eafcff', '#7fe8ff', '#10161a'], line: 0.045, bevel: 0.05 },
    });
    expect(entry.alignment).toBe('exact');
    expect(entry.variants[0].maps.emission).toBeDefined();

    const cell = async (index: number) => {
      const width = 256 / GRID.columns;
      const height = 192 / GRID.rows;
      const pixels = await sharp(join(themesDir, 'cyberpunk', entry.variants[0].maps.emission!))
        .extract({
          left: (index % GRID.columns) * width,
          top: Math.floor(index / GRID.columns) * height,
          width,
          height,
        })
        .raw()
        .toBuffer();
      return Math.max(...pixels);
    };
    expect(await cell(CHARSET.indexOf('A'))).toBeGreaterThan(200); // a lit glyph
    expect(await cell(CHARSET.indexOf(' '))).toBe(0); // the blank cell stays dark
  });

  it('floods part of a road with mirror-smooth puddles and leaves the rest dry', async () => {
    const generator = offline(db);
    const share = async (request: CreateRequest, key: string) => {
      const entry = await generator.create({ ...request, key });
      const gloss = await sharp(join(themesDir, 'cyberpunk', entry.variants[0].maps.roughness)).raw().toBuffer();
      return {
        mirror: gloss.filter((v) => v / 255 < 0.1).length / gloss.length,
        dry: gloss.filter((v) => v / 255 > 0.85).length / gloss.length,
      };
    };

    const wet = await share(road, 'cyberpunk/road/poor');
    expect(wet.mirror).toBeGreaterThan(0.1); // water enough to reflect the street back
    expect(wet.dry).toBeGreaterThan(0.3); // over asphalt that is still asphalt

    // the same road with the mask closed: the puddles are the mask's doing, not the asphalt's
    const dry = await share({ ...road, pattern: { ...road.pattern!, wet: 0 } }, 'cyberpunk/road/mid');
    expect(dry.mirror).toBe(0);
  });

  it('appends a tint variant of a variant already in the entry', async () => {
    const generator = offline(db);
    await generator.create({
      key: 'cyberpunk/wall/mid',
      alignment: 'tile',
      description: 'precast concrete wall panels',
      tiling: { worldSize: [3, 3] },
      physical: { roughnessFactor: 0.85 },
      resolution: [64, 64],
      flatColor: '#8a8b88',
    });
    const entry = await generator.create({
      key: 'cyberpunk/wall/mid',
      alignment: 'tile',
      append: true,
      variantId: 'tint-ochre',
      description: 'wall in another paint',
      recolor: { from: '1', color: '#a2683c', strength: 0.4 },
    });
    expect(entry.variants[1].class).toBeUndefined(); // a tinted photograph is still an image variant
    const warmth = async (file: string) => {
      const { channels } = await sharp(join(themesDir, 'cyberpunk', file)).stats();
      return channels[0].mean - channels[2].mean; // red over blue
    };
    expect(await warmth(entry.variants[0].maps.basecolor)).toBeLessThan(5); // the source is near neutral
    expect(await warmth(entry.variants[1].maps.basecolor)).toBeGreaterThan(15);
  });
});

describe('shipped flat upholstery', () => {
  const shipped = new Database(join(dirname(fileURLToPath(import.meta.url)), '..', 'themes'));

  /** How far a normal map leans off flat, on average: what a minified weave aliases on. */
  async function tilt(file: string): Promise<number> {
    const normal = await sharp(join(shipped.themeDir('cyberpunk'), file)).raw().toBuffer();
    const lean = normal.filter((_, i) => i % 3 !== 2).reduce((sum, v) => sum + Math.abs(v - 128), 0);
    return lean / (normal.length / 3) / 2;
  }

  it('gives every fabric tier a flat variant whose normal carries nothing that can alias', async () => {
    for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
      const entry = shipped.resolve(`cyberpunk/fabric/${tier}`);
      const flat = entry.variants.find((v) => v.id === 'flat');
      expect(flat?.class, tier).toBe('pattern');
      // the contract's bound: under one code value of lean, against the tens a photographed weave carries
      expect(await tilt(flat!.maps.normal), tier).toBeLessThan(1);
      expect(entry.variants.filter((v) => v.id !== 'flat').length, tier).toBeGreaterThan(0);
    }
  });
});
