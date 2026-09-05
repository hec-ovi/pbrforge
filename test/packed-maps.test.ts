import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, list, pack, resolve, type CreateRequest } from '../src/index.js';
import { expectPackedMap } from './helpers/packed-map.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const request: CreateRequest = {
  key: 'test/finish/mid', aliases: ['test/finish/rich'], alignment: 'tile',
  description: 'mineral response test', tiling: { worldSize: [1, 1] }, resolution: [64, 64],
  physical: { roughnessFactor: 0.61, metallicFactor: 0.37 }, flatColor: '#777777', flatNoise: 0,
};

it('packs flat and patterned responses and shares a recolored source pair', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'packed-generation-'));
  const theme = join(themesDir, 'test');
  const entry = await create(request, { themesDir });
  await expectPackedMap(theme, entry.variants[0]);
  const bytes = await sharp(join(theme, entry.variants[0].maps.metallicRoughness!)).raw().toBuffer();
  expect([...bytes.subarray(0, 3)]).toEqual([255, 156, 94]);
  const tinted = await create({
    key: request.key, alignment: 'tile', description: 'tinted mineral', append: true,
    variantId: 'tint', recolor: { from: '1', color: '#58724a', strength: 0.6 }, resolution: [64, 64],
  }, { themesDir });
  expect(tinted.variants[1].maps.metallicRoughness).toBe(entry.variants[0].maps.metallicRoughness);
  await expectPackedMap(theme, tinted.variants[1]);
  const pattern = await create({
    ...request, key: 'test/panel/mid', aliases: [], flatColor: undefined, flatNoise: undefined,
    pattern: { kind: 'panel-grid', colors: ['#777777'], cells: [2, 2], joint: 0.2, sheen: 0.07 },
  }, { themesDir });
  await expectPackedMap(theme, pattern.variants[0]);
});

it('backfills a legacy catalog through the CLI without changing source bytes or factors', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'packed-backfill-'));
  const theme = join(themesDir, 'test');
  const entry = await create(request, { themesDir });
  const variant = entry.variants[0];
  const packedPath = join(theme, variant.maps.metallicRoughness!);
  const expected = readFileSync(packedPath);
  unlinkSync(packedPath);
  delete variant.maps.metallicRoughness;
  const source = Object.values(variant.maps).map(path => [path, readFileSync(join(theme, path))] as const);
  writeFileSync(join(theme, 'theme.json'), JSON.stringify({ theme: 'test', entries: { [entry.key]: entry } }));
  const cli = spawnSync(join(root, 'node_modules/.bin/tsx'),
    ['src/cli/pack.ts', '--theme', 'test', '--themes', themesDir], { cwd: root, encoding: 'utf8' });
  expect(cli.status, cli.stderr).toBe(0);
  const updated = resolve('test/finish/rich', { themesDir });
  expect(updated.physical).toEqual(entry.physical);
  expect(readFileSync(packedPath)).toEqual(expected);
  for (const [path, bytes] of source) expect(readFileSync(join(theme, path))).toEqual(bytes);
  await expectPackedMap(theme, updated.variants[0]);
  const index = readFileSync(join(theme, 'theme.json'));
  expect((await pack({ key: 'test/finish/rich' }, { themesDir })).variants).toEqual([]);
  expect(readFileSync(join(theme, 'theme.json'))).toEqual(index);
});

it('rejects invalid requests, unknown entries and unreadable or mismatched source maps', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'packed-invalid-'));
  const entry = await create(request, { themesDir });
  await expect(pack({ key: 'invalid' }, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
  await expect(pack({ key: 'test/missing/mid' }, { themesDir })).rejects.toMatchObject({ code: 'E_KEY_NOT_FOUND' });
  await expect(pack({ key: 'missing/finish/mid' }, { themesDir })).rejects.toMatchObject({ code: 'E_THEME_NOT_FOUND' });
  const path = join(themesDir, 'test', entry.variants[0].maps.roughness);
  writeFileSync(path, 'unreadable source');
  await expect(pack({ key: entry.key }, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
  writeFileSync(path, await sharp({ create: { width: 32, height: 64, channels: 3, background: '#888888' } }).png().toBuffer());
  await expect(pack({ key: entry.key }, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
});

it('ships one correctly encoded packed file for every catalog source pair', async () => {
  const seen = new Set<string>();
  for (const key of list({ theme: 'cyberpunk' })) {
    const entry = resolve(key);
    for (const variant of entry.variants) {
      expect(variant.maps.metallicRoughness, `${key}:${variant.id}`).toBeDefined();
      const signature = JSON.stringify([variant.maps.metallicRoughness, variant.maps.roughness,
        variant.maps.metallic, variant.resolution]);
      if (seen.has(signature)) continue;
      await expectPackedMap(join(root, 'themes/cyberpunk'), variant);
      seen.add(signature);
    }
  }
}, 30_000);
