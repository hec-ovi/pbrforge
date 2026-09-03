import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import type { CreateRequest, MaterialEntry } from '../src/db/types.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';

const blood: CreateRequest = {
  key: 'cyberpunk/incident-blood/mid',
  alignment: 'exact',
  aspect: [2, 1],
  decal: { worldSize: [2.4, 1.2], edgeInset: 0.08, surfaceOffset: 0.002, wrapMode: 'clamp', projection: 'surface-fit' },
  description: 'directional incident blood pool fitted to one floor receiver',
  variantId: 'directional-pool',
  physical: { roughnessFactor: 0.62, metallicFactor: 0, alphaMode: 'BLEND' },
  resolution: [256, 128],
  seed: 14873,
  pattern: { kind: 'incident-blood', colors: ['#541014', '#22080a'], grain: 0 },
};

const tyre: CreateRequest = {
  key: 'cyberpunk/incident-tyre/poor',
  alignment: 'exact',
  aspect: [4, 1],
  decal: { worldSize: [3.6, 0.9], edgeInset: 0.06, surfaceOffset: 0.002, wrapMode: 'clamp', projection: 'surface-fit' },
  description: 'directional tyre transfer fitted to one street receiver',
  variantId: 'directional-transfer',
  physical: { roughnessFactor: 0.78, metallicFactor: 0, alphaMode: 'BLEND' },
  resolution: [256, 64],
  seed: 29137,
  pattern: { kind: 'incident-tyre', colors: ['#17191b', '#26282b'], grain: 0 },
};

const offline = (db: Database) => new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));

describe('incident decal generation', () => {
  let themesDir: string;
  let db: Database;

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), 'incident-materials-'));
    db = new Database(themesDir);
  });

  it('writes fitted transparent PBR maps deterministically without ComfyUI', async () => {
    const first = await offline(db).create(blood);
    const variant = first.variants[0];
    expect(first.decal).toEqual(blood.decal);
    expect(first.physical).toMatchObject({ metallicFactor: 0, roughnessFactor: 0.62, alphaMode: 'BLEND' });
    for (const name of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao', 'opacity'] as const) {
      expect(variant.maps[name], name).toBeDefined();
      expect(existsSync(join(themesDir, 'cyberpunk', variant.maps[name]!)), name).toBe(true);
      const image = await sharp(join(themesDir, 'cyberpunk', variant.maps[name]!)).metadata();
      expect([image.width, image.height], name).toEqual([256, 128]);
    }

    const original = readFileSync(join(themesDir, 'cyberpunk', variant.maps.opacity!));
    const second = await offline(db).create({ ...blood, overwrite: true });
    expect(readFileSync(join(themesDir, 'cyberpunk', second.variants[0].maps.opacity!))).toEqual(original);
  });

  it('keeps the blood pool inside a transparent border and narrows along its direction', async () => {
    const entry = await offline(db).create(blood);
    const opacity = await gray(entry, 'opacity', themesDir);
    expect(edgeMax(opacity.data, opacity.width, opacity.height, 6)).toBe(0);
    const covered = opacity.data.filter((value) => value > 8).length / opacity.data.length;
    expect(covered).toBeGreaterThan(0.12);
    expect(covered).toBeLessThan(0.5);
    expect(columnCoverage(opacity, 0.32)).toBeGreaterThan(columnCoverage(opacity, 0.77) * 1.8);
    expect(columnCoverage(opacity, 0.86)).toBeGreaterThan(0);

    const gloss = await gray(entry, 'roughness', themesDir);
    expect(Math.min(...gloss.data) / 255).toBeGreaterThanOrEqual(0.53);
    expect(Math.max(...gloss.data) / 255).toBeLessThanOrEqual(0.63);
  });

  it('draws a dry three-rib tyre transfer that becomes denser in its travel direction', async () => {
    const entry = await offline(db).create(tyre);
    const opacity = await gray(entry, 'opacity', themesDir);
    expect(edgeMax(opacity.data, opacity.width, opacity.height, 3)).toBe(0);
    expect(columnMean(opacity, 0.72)).toBeGreaterThan(columnMean(opacity, 0.26) * 1.5);
    expect(columnCoverage(opacity, 0.5)).toBeGreaterThan(0.06);
    expect(columnCoverage(opacity, 0.5)).toBeLessThan(0.24);

    const normal = await sharp(join(themesDir, 'cyberpunk', entry.variants[0].maps.normal!)).raw().toBuffer();
    expect([...new Set(normal)].sort((a, b) => a - b)).toEqual([128, 255]);
    const gloss = await gray(entry, 'roughness', themesDir);
    expect(Math.min(...gloss.data) / 255).toBeGreaterThanOrEqual(0.77);
  });

  it('rejects tiling, opaque, mismatched and non-incident decal requests', async () => {
    const generator = offline(db);
    await expect(generator.create({ ...blood, alignment: 'tile', tiling: { worldSize: [2.4, 1.2] } })).rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(generator.create({ ...blood, physical: { ...blood.physical, alphaMode: 'OPAQUE' } })).rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(generator.create({ ...blood, decal: { ...blood.decal!, worldSize: [2, 1.2] } })).rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(generator.create({ ...blood, pattern: { kind: 'noise', colors: ['#111111', '#222222'] } })).rejects.toMatchObject({ code: 'E_SCHEMA' });
  });
});

describe('shipped incident decals', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const db = new Database(join(root, 'themes'));

  it('resolves the exact incident keys and their placement envelopes', () => {
    const expected: Array<[string, string, [number, number]]> = [
      ['cyberpunk/incident-blood/mid', 'directional-pool', [2.4, 1.2]],
      ['cyberpunk/incident-tyre/poor', 'directional-transfer', [3.6, 0.9]],
    ];
    for (const [key, id, worldSize] of expected) {
      const entry = db.resolve(key);
      expect(entry.alignment).toBe('exact');
      expect(entry.decal).toMatchObject({ worldSize, wrapMode: 'clamp', projection: 'surface-fit' });
      expect(entry.variants[0].id).toBe(id);
      expect(entry.variants[0].maps.opacity).toBeDefined();
    }
  });
});

async function gray(entry: MaterialEntry, name: 'opacity' | 'roughness', themesDir: string) {
  const path = entry.variants[0].maps[name]!;
  const { data, info } = await sharp(join(themesDir, 'cyberpunk', path)).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

function edgeMax(data: Uint8Array, width: number, height: number, inset: number): number {
  let max = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < inset || x >= width - inset || y < inset || y >= height - inset) max = Math.max(max, data[y * width + x]);
    }
  }
  return max;
}

function columnCoverage(image: { data: Uint8Array; width: number; height: number }, u: number): number {
  const x = Math.min(image.width - 1, Math.floor(u * image.width));
  let count = 0;
  for (let y = 0; y < image.height; y++) if (image.data[y * image.width + x] > 8) count++;
  return count / image.height;
}

function columnMean(image: { data: Uint8Array; width: number; height: number }, u: number): number {
  const x = Math.min(image.width - 1, Math.floor(u * image.width));
  let total = 0;
  for (let y = 0; y < image.height; y++) total += image.data[y * image.width + x];
  return total / image.height;
}
