import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, pack, resolve, type CreateRequest, type Variant } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const request: CreateRequest = {
  key: 'test/finish/mid', aliases: ['test/finish/rich'], alignment: 'tile',
  description: 'mineral response test', tiling: { worldSize: [1, 1] }, resolution: [64, 64],
  physical: { roughnessFactor: 0.61, metallicFactor: 0.37 }, flatColor: '#777777', flatNoise: 0,
};

/** Reads the packed map as a consumer does: R=255, G=roughness, B=metallic at the variant resolution. */
async function expectPackedMap(theme: string, variant: Variant): Promise<void> {
  const { data, info } = await sharp(join(theme, variant.maps.metallicRoughness!)).raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([...variant.resolution, 3]);
  const channel = (offset: number) => Buffer.from(data.filter((_, index) => index % 3 === offset));
  expect(channel(0).equals(Buffer.alloc(info.width * info.height, 255)), 'red').toBe(true);
  expect(channel(1).equals(await sharp(join(theme, variant.maps.roughness)).extractChannel(0).raw().toBuffer()), 'roughness').toBe(true);
  expect(channel(2).equals(await sharp(join(theme, variant.maps.metallic)).extractChannel(0).raw().toBuffer()), 'metallic').toBe(true);
}

it('packs metallic and roughness through the CLI without changing source bytes or factors', async () => {
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

  const cli = spawnSync(process.execPath,
    ['--import', 'tsx', 'src/cli/pack.ts', '--theme', 'test', '--themes', themesDir], { cwd: root, encoding: 'utf8' });
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
