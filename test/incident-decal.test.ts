import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, type CreateRequest } from '../src/index.js';

const request: CreateRequest = {
  key: 'test/incident/mid', alignment: 'exact', aspect: [2, 1],
  description: 'fitted incident decal', resolution: [128, 64], seed: 14873,
  decal: { worldSize: [2.4, 1.2], edgeInset: 0.08, surfaceOffset: 0.002, wrapMode: 'clamp', projection: 'surface-fit' },
  physical: { roughnessFactor: 0.62, metallicFactor: 0, alphaMode: 'BLEND' },
  pattern: { kind: 'incident-blood', colors: ['#541014', '#22080a'], grain: 0 },
};

it('returns a fitted opacity map with a transparent receiving-face inset', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'decal-'));
  const entry = await create(request, { themesDir });
  expect(entry.decal).toEqual(request.decal);
  const { data, info } = await sharp(join(themesDir, 'test', entry.variants[0].maps.opacity!))
    .extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  expect(data.some(value => value > 0)).toBe(true);
  const { worldSize: [width, height], edgeInset } = entry.decal!;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const edge = Math.min((x + 0.5) / info.width * width, (info.width - x - 0.5) / info.width * width,
      (y + 0.5) / info.height * height, (info.height - y - 0.5) / info.height * height);
    if (edge < edgeInset) expect(data[y * info.width + x]).toBe(0);
  }
});

it('rejects incompatible placement, transparency and pattern inputs', async () => {
  const options = { themesDir: mkdtempSync(join(tmpdir(), 'decal-invalid-')) };
  for (const patch of [
    { alignment: 'tile', tiling: { worldSize: [2.4, 1.2] } },
    { physical: { ...request.physical, alphaMode: 'OPAQUE' } },
    { decal: { ...request.decal!, worldSize: [2, 1.2] } },
    { pattern: { kind: 'noise', colors: ['#111111', '#222222'] } },
  ]) await expect(create({ ...request, ...patch } as CreateRequest, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});
