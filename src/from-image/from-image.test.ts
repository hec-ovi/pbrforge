import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/Database.js';
import { FromImage } from './FromImage.js';

async function albedo(path: string, width = 64, height = 64): Promise<void> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const tone = x < width / 2 ? 40 : 200;
      pixels.set([tone, tone - 8, tone - 16], i);
    }
  }
  writeFileSync(path, await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer());
}

describe('from-image', () => {
  it('derives a dry PBR set from one opaque exact face with no seam gate', async () => {
    const themesDir = mkdtempSync(join(tmpdir(), 'from-image-'));
    const png = join(themesDir, 'face.png');
    await albedo(png);
    const entry = await new FromImage(new Database(themesDir)).run({
      key: 'test/ac-face/mid',
      path: png,
      alignment: 'exact',
      aspect: [1, 1],
      description: 'asymmetric condenser face',
      resolution: [64, 64],
      variantId: 'damaged',
      physical: { metallicFactor: 0, roughnessFactor: 0.65 },
      finish: { roughness: [0.55, 0.75], grain: 0.2, relief: 1.5 },
    });
    expect(entry.alignment).toBe('exact');
    expect(entry.aspect).toEqual([1, 1]);
    expect(entry.tiling).toBeUndefined();
    const variant = entry.variants[0];
    expect(variant.class).toBe('image');
    expect(variant.maps.emission).toBeUndefined();
    expect(variant.maps.opacity).toBeUndefined();
    const theme = join(themesDir, 'test');
    for (const name of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao', 'metallicRoughness'] as const) {
      const rel = variant.maps[name];
      expect(rel).toBeTruthy();
      expect(readFileSync(join(theme, rel as string)).length).toBeGreaterThan(8);
    }
    const height = await sharp(join(theme, variant.maps.height as string)).raw().toBuffer();
    expect(new Set(height).size).toBeGreaterThan(1);
    const metallic = [...new Set(await sharp(join(theme, variant.maps.metallic as string)).raw().toBuffer())];
    expect(metallic).toEqual([0]);
  });

  it('reads a jpeg source', async () => {
    const themesDir = mkdtempSync(join(tmpdir(), 'from-image-jpeg-'));
    const png = join(themesDir, 'face.png');
    const jpeg = join(themesDir, 'face.jpg');
    await albedo(png);
    await sharp(png).jpeg().toFile(jpeg);
    const entry = await new FromImage(new Database(themesDir)).run({
      key: 'test/jpeg-face/mid',
      path: jpeg,
      alignment: 'exact',
      aspect: [1, 1],
      description: 'jpeg condenser face',
      resolution: [64, 64],
      physical: { metallicFactor: 0, roughnessFactor: 0.65 },
    });
    expect(entry.variants[0].maps.basecolor).toBeTruthy();
  });

  it('accepts an unwrapped tile without a seam check', async () => {
    const themesDir = mkdtempSync(join(tmpdir(), 'from-image-tile-'));
    const png = join(themesDir, 'brick.png');
    await albedo(png);
    const entry = await new FromImage(new Database(themesDir)).run({
      key: 'test/brick/mid',
      path: png,
      alignment: 'tile',
      tiling: { worldSize: [1, 1] },
      description: 'asymmetric brick albedo',
      resolution: [64, 64],
      physical: { metallicFactor: 0, roughnessFactor: 0.7 },
    });
    expect(entry.alignment).toBe('tile');
    expect(entry.variants[0].maps.basecolor).toBeTruthy();
  });

  it('appends a second face onto an existing key', async () => {
    const themesDir = mkdtempSync(join(tmpdir(), 'from-image-append-'));
    const front = join(themesDir, 'front.png');
    const side = join(themesDir, 'side.png');
    await albedo(front);
    await albedo(side);
    const box = new FromImage(new Database(themesDir));
    await box.run({
      key: 'test/cabinet/mid',
      path: front,
      alignment: 'exact',
      aspect: [1, 1],
      description: 'cabinet door',
      resolution: [64, 64],
      variantId: 'face',
      physical: { metallicFactor: 0, roughnessFactor: 0.65 },
    });
    const entry = await box.run({
      key: 'test/cabinet/mid',
      path: side,
      append: true,
      variantId: 'side',
      description: 'cabinet side',
      resolution: [64, 64],
    });
    expect(entry.alignment).toBe('exact');
    expect(entry.variants.map((variant) => variant.id)).toEqual(['face', 'side']);
    expect(entry.variants[1].maps.emission).toBeUndefined();
  });
});
