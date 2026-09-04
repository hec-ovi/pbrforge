import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, refinish, resolve, type CreateRequest } from '../src/index.js';

it('imports an exact image locally with aligned baked emission, flat maps and reproducible append', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'image-plate-'));
  const path = join(themesDir, 'source.png');
  const pixels = Buffer.alloc(128 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    pixels.set([x * 2, y * 4, 50], (y * 128 + x) * 3);
  }
  writeFileSync(path, await sharp(pixels, { raw: { width: 128, height: 64, channels: 3 } }).png().toBuffer());
  const request: CreateRequest = {
    key: 'cyberpunk/window-room/mid', aliases: ['cyberpunk/window-room/poor'],
    alignment: 'exact', aspect: [1, 1], description: 'baked room plate',
    sourceImage: { path }, variantId: 'office', resolution: [64, 64],
    physical: { metallicFactor: 0, roughnessFactor: 1, emissiveStrength: 1 },
  };
  const offline = async (): Promise<never> => { throw new Error('plate must stay local'); };
  const options = { themesDir, comfy: { ready: offline, render: offline, upload: offline } };
  const entry = await create(request, options);
  expect(entry.alignment).toBe('exact');
  expect(entry.aspect).toEqual([1, 1]);
  expect(entry.finish).toBeUndefined();
  const variant = entry.variants[0];
  expect(variant.class).toBe('plate');
  expect(variant.screen).toBeUndefined();
  expect(variant.resolution).toEqual([64, 64]);
  const file = (name: keyof typeof variant.maps) => join(themesDir, 'cyberpunk', variant.maps[name]!);
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
  expect(resolve('cyberpunk/window-room/poor', options).variants.map(v => v.id)).toEqual(['office', 'apartment']);
  await create({ ...request, overwrite: true }, options);
  expect(readFileSync(file('basecolor'))).toEqual(base);
  await expect(refinish({ key: request.key }, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});

it('rejects invalid source paths, unreadable or undersized sources and incompatible plate requests', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'image-plate-invalid-'));
  const path = join(themesDir, 'source.png');
  const request: CreateRequest = {
    key: 'cyberpunk/window-room/mid', alignment: 'exact', aspect: [1, 1],
    description: 'baked room plate', sourceImage: { path }, resolution: [64, 64],
  };
  const options = { themesDir };
  await expect(create(request, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  writeFileSync(path, 'invalid image');
  await expect(create(request, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  writeFileSync(path, await sharp({ create: { width: 32, height: 32, channels: 3, background: '#555555' } }).png().toBuffer());
  await expect(create(request, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  for (const invalid of [
    { alignment: 'tile', tiling: { worldSize: [1, 1] } },
    { flatColor: '#555555' }, { emission: 'luminance' }, { variants: 2 },
    { resolution: [2048, 2048] }, { finish: { grain: 0 } },
  ]) {
    await expect(create({ ...request, ...invalid } as CreateRequest, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  }
});
