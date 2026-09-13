import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, type CreateRequest, type SurfaceResponse } from '../src/index.js';

const response: SurfaceResponse = {
  kind: 'localized-damp', coverage: 0.3, patchScale: 0.5,
  roughness: 0.22, darkening: 0.12, reliefRetention: 0.3,
};
const request: CreateRequest = {
  key: 'test/mineral/mid', alignment: 'tile', description: 'local damp concrete',
  tiling: { worldSize: [2, 2] }, resolution: [128, 128], seed: 7,
  physical: { roughnessFactor: 0.8, metallicFactor: 0 },
  pattern: { kind: 'mineral', colors: ['#777777'], response },
};

it('publishes bounded damp response while keeping dry area dominant', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'damp-'));
  const entry = await create(request, { themesDir });
  const variant = entry.variants[0];
  expect(variant.response).toEqual(response);
  expect(entry.physical).toEqual(request.physical);
  expect(variant.maps.emission).toBeUndefined();
  const pixels = await sharp(join(themesDir, 'test', variant.maps.roughness)).extractChannel(0).raw().toBuffer();
  const damp = pixels.filter(value => value < Math.round(0.8 * 255));
  expect(damp.length).toBeGreaterThan(0);
  expect(damp.length / pixels.length).toBeLessThanOrEqual(response.coverage);
  expect(Math.min(...pixels)).toBeGreaterThanOrEqual(Math.round(response.roughness * 255));
});

it('rejects response values outside the schema and unsupported material lanes', async () => {
  const options = { themesDir: mkdtempSync(join(tmpdir(), 'damp-invalid-')) };
  for (const change of [{ coverage: 0.5 }, { patchScale: 0.1 }, { roughness: 0.1 }, { darkening: 0.3 }, { reliefRetention: 1.1 }])
    await expect(create({ ...request, pattern: { ...request.pattern!, response: { ...response, ...change } } }, options))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  await expect(create({ ...request, physical: { metallicFactor: 1 } }, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});
