import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, refinish, resolve, type CreateRequest } from '../src/index.js';
import { run } from '../src/cli/router.js';

const offline = async (): Promise<never> => { throw new Error('a source lane must stay local'); };
const comfy = { ready: offline, render: offline, upload: offline };

function periodicPixels(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width * Math.PI * 2;
    const v = y / height * Math.PI * 2;
    pixels.set([90 + Math.round(12 * Math.sin(u)), 110 + Math.round(15 * Math.cos(v)),
      70 + Math.round(8 * Math.sin(u + v))], (y * width + x) * 3);
  }
  return pixels;
}

it('imports a source albedo tile as dry derived maps, downsampling the whole image', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-'));
  const path = join(themesDir, 'oriented.png');
  writeFileSync(path, await sharp(periodicPixels(256, 128), { raw: { width: 256, height: 128, channels: 3 } })
    .ensureAlpha().withMetadata({ orientation: 6 }).png().toBuffer());
  const request: CreateRequest = {
    key: 'test/albedo/mid', aliases: ['test/albedo/poor'], alignment: 'tile',
    description: 'continuous source albedo', sourceAlbedo: { path }, variantId: 'clean',
    tiling: { worldSize: [1, 2] }, resolution: [64, 128],
    physical: { metallicFactor: 0, roughnessFactor: 0.65 },
    finish: { roughness: [0.6, 0.7], grain: 0.2, relief: 1.2 },
  };
  const requestPath = join(themesDir, 'request.json');
  writeFileSync(requestPath, JSON.stringify([request]));
  expect(await run(['create', requestPath, '--themes', themesDir]))
    .toMatchObject({ ok: true, data: { created: [{ key: 'test/albedo/mid', variants: 1 }] } });

  const theme = join(themesDir, 'test');
  const entry = resolve('test/albedo/poor', { themesDir });
  const variant = entry.variants[0];
  expect(entry.tiling?.worldSize).toEqual([1, 2]);
  expect(entry.finish).toEqual(request.finish);
  expect(variant.class).toBe('image');
  expect(variant.maps.emission).toBeUndefined();
  expect(readFileSync(join(theme, 'theme.json'), 'utf8')).not.toContain(path);

  const expected = await sharp(path).rotate().toColourspace('srgb').removeAlpha()
    .resize(64, 128, { kernel: 'lanczos3' }).raw().toBuffer();
  expect(await sharp(join(theme, variant.maps.basecolor)).raw().toBuffer()).toEqual(expected);
  const roughness = await sharp(join(theme, variant.maps.roughness)).extractChannel(0).raw().toBuffer();
  expect(Math.min(...roughness)).toBeGreaterThanOrEqual(Math.round(0.6 * 255));
  expect(Math.max(...roughness)).toBeLessThanOrEqual(Math.round(0.7 * 255));
  expect([...new Set(await sharp(join(theme, variant.maps.metallic)).raw().toBuffer())]).toEqual([0]);
  expect(new Set(await sharp(join(theme, variant.maps.height!)).raw().toBuffer()).size).toBeGreaterThan(1);
  for (const map of Object.values(variant.maps)) {
    const metadata = await sharp(join(theme, map)).metadata();
    expect([metadata.width, metadata.height], map).toEqual([64, 128]);
  }
});

it('imports an exact plate with baked emission, flat response maps and a reproducible append', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'image-plate-'));
  const path = join(themesDir, 'source.png');
  const pixels = Buffer.alloc(128 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) pixels.set([x * 2, y * 4, 50], (y * 128 + x) * 3);
  writeFileSync(path, await sharp(pixels, { raw: { width: 128, height: 64, channels: 3 } }).png().toBuffer());
  const request: CreateRequest = {
    key: 'test/window-room/mid', aliases: ['test/window-room/poor'],
    alignment: 'exact', aspect: [1, 1], description: 'baked room plate',
    sourceImage: { path }, variantId: 'office', resolution: [64, 64],
    physical: { metallicFactor: 0, roughnessFactor: 1, emissiveStrength: 1 },
  };
  const options = { themesDir, comfy };
  const entry = await create(request, options);
  expect(entry.aspect).toEqual([1, 1]);
  expect(entry.finish).toBeUndefined();
  const variant = entry.variants[0];
  expect(variant.class).toBe('plate');
  expect(variant.resolution).toEqual([64, 64]);
  const file = (name: keyof typeof variant.maps) => join(themesDir, 'test', variant.maps[name]!);
  const base = readFileSync(file('basecolor'));
  expect(readFileSync(file('emission'))).toEqual(base);
  const raw = await sharp(base).raw().toBuffer();
  expect([...raw.subarray(0, 3)]).toEqual([64, 0, 50]);
  expect([...raw.subarray(-3)]).toEqual([190, 252, 50]);
  for (const [name, values] of Object.entries({ normal: [128, 255], roughness: [255], metallic: [0], height: [128], ao: [255] })) {
    const decoded = await sharp(file(name as keyof typeof variant.maps)).raw().toBuffer({ resolveWithObject: true });
    expect([decoded.info.width, decoded.info.height]).toEqual([64, 64]);
    expect([...new Set(decoded.data)].sort((a, b) => a - b)).toEqual(values);
  }
  await create({ ...request, append: true, variantId: 'apartment' }, options);
  expect(resolve('test/window-room/poor', options).variants.map(v => v.id)).toEqual(['office', 'apartment']);
  await create({ ...request, overwrite: true }, options);
  expect(readFileSync(file('basecolor'))).toEqual(base);
  await expect(refinish({ key: request.key }, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});
