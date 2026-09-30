import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, refinish, type CreateRequest } from '../src/index.js';
import { run } from '../src/cli/router.js';

async function fixture() {
  const themesDir = mkdtempSync(join(tmpdir(), 'prepared-maps-'));
  const sourceMaps = {} as NonNullable<CreateRequest['sourceMaps']>;
  for (const channel of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao', 'opacity'] as const) {
    const data = Buffer.alloc(64 * 64 * 3);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const v = Math.round(120 + 80 * Math.sin(x / 64 * Math.PI * 2) * Math.cos(y / 64 * Math.PI * 2));
      data.set(channel === 'normal' ? [128, 128, 255] : [v, v, v], (y * 64 + x) * 3);
    }
    sourceMaps[channel] = join(themesDir, `${channel}.png`);
    await sharp(data, { raw: { width: 64, height: 64, channels: 3 } }).png().toFile(sourceMaps[channel]!);
  }
  const request: CreateRequest = { key: 'test/prepared/mid', alignment: 'tile', tiling: { worldSize: [2, 2] },
    description: 'independent oily roughness and shallow relief', resolution: [64, 64], sourceMaps,
    physical: { metallicFactor: 0, roughnessFactor: 1, alphaMode: 'BLEND' } };
  return { themesDir, request, sourceMaps };
}

it('imports independent channels through the native CLI, preserving alpha and packed roughness', async () => {
  const { themesDir, request, sourceMaps } = await fixture();
  const path = join(themesDir, 'request.json'); writeFileSync(path, JSON.stringify(request));
  expect(await run(['create', path, '--native', '--themes', themesDir])).toMatchObject({ ok: true });
  const index = JSON.parse(readFileSync(join(themesDir, 'test/theme.json'), 'utf8'));
  const variant = index.entries[request.key].variants[0];
  expect(variant.class).toBe('prepared');
  const read = (file: string) => sharp(file).extractChannel(0).raw().toBuffer();
  const roughness = await read(sourceMaps.roughness);
  expect(await read(join(themesDir, 'test', variant.maps.roughness))).toEqual(roughness);
  expect(await sharp(join(themesDir, 'test', variant.maps.metallicRoughness)).extractChannel(1).raw().toBuffer()).toEqual(roughness);
  expect(await sharp(join(themesDir, 'test', variant.maps.basecolor)).extractChannel(3).raw().toBuffer()).toEqual(await read(sourceMaps.opacity!));
  await expect(refinish({ key: request.key, finish: { roughness: [0.1, 0.2] } }, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
});

it('rejects a data-map seam and a dimension mismatch before publishing a material', async () => {
  const { themesDir, request, sourceMaps } = await fixture();
  const data = Buffer.alloc(64 * 64 * 3);
  for (let i = 0; i < 4096; i++) data.fill((i % 64) * 4, i * 3, i * 3 + 3);
  await sharp(data, { raw: { width: 64, height: 64, channels: 3 } }).png().toFile(sourceMaps.roughness);
  await expect(create(request, { themesDir })).rejects.toMatchObject({ code: 'E_SEAM_CHECK_FAILED' });
  await sharp({ create: { width: 32, height: 64, channels: 3, background: '#888888' } }).png().toFile(sourceMaps.roughness);
  await expect(create(request, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
});
