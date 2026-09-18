import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeEach, expect, it } from 'vitest';
import { ComfyClient, create, list, type ComfyRuntime, type CreateRequest } from '../src/index.js';

const request: CreateRequest = {
  key: 'test/wall/mid', alignment: 'tile', description: 'neutral concrete',
  tiling: { worldSize: [1, 1] }, resolution: [64, 64],
};
let themesDir: string;
beforeEach(() => { themesDir = mkdtempSync(join(tmpdir(), 'create-')); });

const backend = (render: ComfyRuntime['render']): ComfyRuntime => ({
  ready: async () => true, upload: async () => 'source.png', render,
});

it('rejects invalid requests before a backend and reports backend failures', async () => {
  const comfy = backend(async () => { throw new Error('invalid request reached generation'); });
  for (const patch of [
    { tiling: undefined }, { resolution: [128, 64] }, { resolution: [2048, 2048] },
    { layout: { family: 'panel', origin: [0, 0], orientation: 'horizontal' } },
  ]) await expect(create({ ...request, ...patch } as CreateRequest, { themesDir, comfy }))
    .rejects.toMatchObject({ code: 'E_SCHEMA' });

  await expect(create(request, { themesDir, comfy: new ComfyClient('http://127.0.0.1:9', 1000) }))
    .rejects.toMatchObject({ code: 'E_COMFY_UNAVAILABLE' });

  const undersized = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#444444' } }).png().toBuffer();
  await expect(create({
    key: 'test/screen/mid', alignment: 'exact', aspect: [1, 1], description: 'screen artwork',
    resolution: [64, 64], emission: 'image', flatColor: '#08080a',
    screens: [{ kind: 'led-dot', description: 'brandless artwork' }],
  }, { themesDir, comfy: backend(async () => undersized) })).rejects.toMatchObject({ code: 'E_GENERATION_FAILED' });
});

it('reports a failed seam without publishing a material or maps', async () => {
  const pixels = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) pixels.fill(x * 4, (y * 64 + x) * 3, (y * 64 + x + 1) * 3);
  const png = await sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer();
  await expect(create(request, { themesDir, comfy: backend(async () => png) }))
    .rejects.toMatchObject({ code: 'E_SEAM_CHECK_FAILED' });
  expect(list({}, { themesDir })).toEqual([]);
  expect(existsSync(join(themesDir, 'test/assets'))).toBe(false);
});

it('creates a flat finish locally and requires explicit overwrite', async () => {
  const input = { ...request, flatColor: '#555555', flatNoise: 0, emission: 'color-mask' as const };
  const options = { themesDir, comfy: backend(async () => { throw new Error('flat finish reached generation'); }) };
  const entry = await create(input, options);
  expect(entry.variants[0].class).toBe('flat');
  expect(entry.finish).toBeUndefined();
  const path = join(themesDir, 'test', entry.variants[0].maps.basecolor);
  const before = readFileSync(path);
  await expect(create(input, options)).rejects.toMatchObject({ code: 'E_KEY_EXISTS' });
  await create({ ...input, overwrite: true }, options);
  expect(readFileSync(path)).toEqual(before);
});
