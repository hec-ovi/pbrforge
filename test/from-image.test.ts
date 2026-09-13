import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { resolve } from '../src/index.js';
import { run } from '../src/cli/router.js';

async function source(themesDir: string, extension: 'png' | 'jpeg'): Promise<string> {
  const path = join(themesDir, `source.${extension}`);
  const pixels = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) pixels.fill(x * 4, (y * 64 + x) * 3, (y * 64 + x + 1) * 3);
  await sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } }).toFormat(extension).toFile(path);
  return path;
}

function convert(themesDir: string, input: Record<string, unknown>, flags: string[] = []) {
  const file = join(themesDir, 'request.json');
  writeFileSync(file, JSON.stringify(input));
  return run(['from-image', file, '--themes', themesDir, ...flags]);
}

it('imports PNG and JPEG faces, appending with inherited scale, finish and physical values', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'from-image-'));
  const input = {
    key: 'test/face/mid', path: await source(themesDir, 'png'), description: 'asymmetric face',
    alignment: 'exact', aspect: [1, 1], resolution: [64, 64], variantId: 'front',
    physical: { metallicFactor: 0, roughnessFactor: 0.65 },
    finish: { roughness: [0.55, 0.75], grain: 0.2, relief: 1.5 },
  };
  expect(await convert(themesDir, input)).toMatchObject({ ok: true, data: { key: input.key, variant: 'front', alignment: 'exact' } });
  const before = resolve(input.key, { themesDir });
  expect(await convert(themesDir, {
    key: input.key, path: await source(themesDir, 'jpeg'), description: 'continuity face', append: true, variantId: 'side',
  })).toMatchObject({ ok: true });
  const entry = resolve(input.key, { themesDir });
  expect(entry.aspect).toEqual(before.aspect);
  expect(entry.physical).toEqual(before.physical);
  expect(entry.finish).toEqual(before.finish);
  expect(entry.variants.map(variant => variant.id)).toEqual(['front', 'side']);
  for (const variant of entry.variants) {
    expect(variant.resolution).toEqual([64, 64]);
    expect(variant.class).toBe('image');
    expect(variant.maps.emission).toBeUndefined();
    expect(variant.maps.opacity).toBeUndefined();
    for (const map of Object.values(variant.maps)) {
      const metadata = await sharp(join(themesDir, 'test', map)).metadata();
      expect([metadata.width, metadata.height]).toEqual(variant.resolution);
    }
  }
  expect(await convert(themesDir, input)).toMatchObject({ ok: false, error: { code: 'E_KEY_EXISTS' } });
  expect(await convert(themesDir, input, ['--overwrite'])).toMatchObject({ ok: true });
});

it('accepts a tile without a seam gate and supplies default finish and physical values', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'from-image-tile-'));
  const input = {
    key: 'test/tile/mid', path: await source(themesDir, 'png'), description: 'unwrapped source',
    alignment: 'tile', tiling: { worldSize: [1, 1] }, resolution: [64, 64],
  };
  expect(await convert(themesDir, input)).toMatchObject({ ok: true, data: { variant: '1', alignment: 'tile' } });
  expect(resolve(input.key, { themesDir })).toMatchObject({
    physical: { metallicFactor: 0, roughnessFactor: 0.65 },
    finish: { roughness: [0.6, 0.7], grain: 0.2, relief: 2 },
  });
  expect(await convert(themesDir, { ...input, key: 'test/absent/mid', append: true, variantId: 'side' }))
    .toMatchObject({ ok: false, error: { code: 'E_KEY_NOT_FOUND' } });
});

it('reports invalid images, physical settings and missing append themes', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'from-image-invalid-'));
  const input = {
    key: 'test/face/mid', path: join(themesDir, 'absent.png'), description: 'invalid face',
    alignment: 'exact', aspect: [1, 1], resolution: [64, 64],
  };
  expect(await convert(themesDir, input)).toMatchObject({ ok: false, error: { code: 'E_SCHEMA' } });
  const path = await source(themesDir, 'png');
  expect(await convert(themesDir, { ...input, path, physical: { roughnessFactor: 0.2 } }))
    .toMatchObject({ ok: false, error: { code: 'E_SCHEMA' } });
  expect(await convert(themesDir, { ...input, path, key: 'absent/face/mid', append: true, variantId: 'side' }))
    .toMatchObject({ ok: false, error: { code: 'E_THEME_NOT_FOUND' } });
});
