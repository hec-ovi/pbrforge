import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, refinish, resolve, type CreateRequest, type Variant } from '../src/index.js';
import { expectPackedMap } from './helpers/packed-map.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const offline = async (): Promise<never> => { throw new Error('sourceAlbedo must stay local'); };
const comfy = { ready: offline, render: offline, upload: offline };
const request = (path: string): CreateRequest => ({
  key: 'test/albedo/mid', aliases: ['test/albedo/poor'], alignment: 'tile',
  description: 'continuous source albedo', sourceAlbedo: { path },
  tiling: { worldSize: [1, 1] }, resolution: [64, 64], variantId: 'clean',
  physical: { metallicFactor: 0, roughnessFactor: 0.65 },
  finish: { roughness: [0.6, 0.7], grain: 0.2, relief: 1.2 },
});

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

async function source(path: string, width = 64, height = 64): Promise<Buffer> {
  const pixels = periodicPixels(width, height);
  writeFileSync(path, await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer());
  return pixels;
}

const bytes = (theme: string, variant: Variant) => Object.fromEntries(
  Object.entries(variant.maps).map(([name, path]) => [name, readFileSync(join(theme, path))]),
);

it('imports complete RGB pixels into derived nonemissive PBR, with inherited append and reproducible refinish', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-'));
  const path = join(themesDir, 'source.png');
  const rgb = await source(path);
  const options = { themesDir, comfy };
  const layout = { family: 'continuous' as const, origin: [3, -2] as [number, number], orientation: 'isotropic' as const };
  const entry = await create({ ...request(relative(root, path)), layout }, options);
  const theme = join(themesDir, 'test');
  const variant = entry.variants[0];
  expect(resolve('test/albedo/poor', options)).toEqual(entry);
  expect(entry.tiling?.worldSize).toEqual([1, 1]);
  expect(entry.finish).toEqual({ roughness: [0.6, 0.7], grain: 0.2, relief: 1.2 });
  expect(variant.class).toBe('image');
  expect(variant.maps.emission).toBeUndefined();
  expect(variant.layout).toEqual(layout);
  expect(variant.resolution).toEqual([64, 64]);
  expect(readFileSync(join(theme, 'theme.json'), 'utf8')).not.toContain(path);
  const before = bytes(theme, variant);
  expect(await sharp(before.basecolor).raw().toBuffer()).toEqual(rgb);
  for (const map of Object.values(before)) {
    const meta = await sharp(map).metadata();
    expect([meta.width, meta.height]).toEqual([64, 64]);
  }
  const roughness = await sharp(before.roughness).extractChannel(0).raw().toBuffer();
  expect(Math.min(...roughness)).toBeGreaterThanOrEqual(Math.round(0.6 * 255));
  expect(Math.max(...roughness)).toBeLessThanOrEqual(Math.round(0.7 * 255));
  expect([...new Set(await sharp(before.metallic).raw().toBuffer())]).toEqual([0]);
  expect(new Set(await sharp(before.height).raw().toBuffer()).size).toBeGreaterThan(1);
  await expectPackedMap(theme, variant);
  await expect(create(request(path), options)).rejects.toMatchObject({ code: 'E_KEY_EXISTS' });
  const appended = await create({
    key: request(path).key, alignment: 'tile', description: 'appended source', sourceAlbedo: { path },
    append: true, canonical: true, variantId: 'alternate', resolution: [64, 64],
    tiling: { worldSize: [2, 1] }, physical: { roughnessFactor: 0.9 }, finish: { roughness: [0.8, 0.9] },
  }, options);
  expect(appended.variants.map(v => v.id)).toEqual(['alternate', 'clean']);
  expect(appended.tiling).toEqual(entry.tiling);
  expect(appended.physical).toEqual(entry.physical);
  expect(appended.finish).toEqual(entry.finish);
  expect(bytes(theme, variant)).toEqual(before);
  const result = await refinish({ key: entry.key, finish: entry.finish }, options);
  expect(result.variants).toEqual(['alternate', 'clean']);
  expect(bytes(theme, result.entry.variants[1])).toEqual(before);
  await expectPackedMap(theme, result.entry.variants[0]);
  const regenerated = await create({ ...request(path), overwrite: true, seed: 923 }, options);
  expect(bytes(theme, regenerated.variants[0])).toEqual(before);
});

it('imports an oriented opaque source through the create CLI, downsampling the whole image into an isolated database', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-cli-'));
  const path = join(themesDir, 'oriented.png');
  writeFileSync(path, await sharp(periodicPixels(256, 128), { raw: { width: 256, height: 128, channels: 3 } })
    .ensureAlpha().withMetadata({ orientation: 6 }).png().toBuffer());
  const input = { ...request(path), tiling: { worldSize: [1, 2] }, resolution: [64, 128] };
  const requestPath = join(themesDir, 'request.json');
  writeFileSync(requestPath, JSON.stringify([input]));
  const run = (...extra: string[]) => spawnSync(join(root, 'node_modules/.bin/tsx'),
    ['src/cli/create.ts', requestPath, '--themes', themesDir, ...extra], { cwd: root, encoding: 'utf8' });
  const cli = run();
  expect(cli.status, cli.stderr).toBe(0);
  expect(cli.stdout).toContain('created test/albedo/mid');
  const entry = resolve('test/albedo/mid', { themesDir });
  const theme = join(themesDir, 'test');
  const before = bytes(theme, entry.variants[0]);
  const expected = await sharp(path).rotate().toColourspace('srgb').removeAlpha()
    .resize(64, 128, { kernel: 'lanczos3' }).raw().toBuffer();
  expect(await sharp(before.basecolor).raw().toBuffer()).toEqual(expected);
  expect(entry.tiling?.worldSize).toEqual([1, 2]);
  await expectPackedMap(theme, entry.variants[0]);
  const repeated = run();
  expect(repeated.status, repeated.stderr).toBe(0);
  expect(repeated.stdout).toContain('skipped test/albedo/mid');
  const overwritten = run('--overwrite');
  expect(overwritten.status, overwritten.stderr).toBe(0);
  expect(bytes(theme, entry.variants[0])).toEqual(before);
  const usage = spawnSync(join(root, 'node_modules/.bin/tsx'), ['src/cli/create.ts', requestPath, '--themes'],
    { cwd: root, encoding: 'utf8' });
  expect(usage.status).toBe(2);
  expect(usage.stderr).toContain('usage:');
});

it('rejects each incompatible albedo input through the public create schema', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-input-'));
  const path = join(themesDir, 'source.png');
  await source(path);
  const invalid: Partial<CreateRequest>[] = [
    { sourceAlbedo: { path: '' } }, { sourceImage: { path } },
    { alignment: 'exact', aspect: [1, 1] }, { tiling: undefined }, { aspect: [1, 1] },
    { variants: 2 }, { pattern: { kind: 'mineral', colors: ['#555555'] } },
    { flatColor: '#555555' }, { recolor: { from: 'clean', color: '#444444' } },
    { screens: [{ kind: 'glyph-panel', description: 'screen' }] }, { emission: 'luminance' },
    { brandName: 'Brand' }, { businessKind: 'clinic' },
    { layout: { family: 'panel', origin: [0, 0], orientation: 'isotropic', moduleSize: [1, 1], jointWidth: 0.02 } },
    { layout: { family: 'continuous', origin: [0, 0], orientation: 'isotropic', moduleSize: [1, 1] } },
    { layout: { family: 'continuous', origin: [0, 0], orientation: 'isotropic', bandHeight: 1 } },
    { layout: { family: 'continuous', origin: [0, 0], orientation: 'isotropic', jointWidth: 0.02 } },
    { decal: { worldSize: [1, 1], edgeInset: 0.01, surfaceOffset: 0.002, projection: 'surface-fit', wrapMode: 'clamp' } },
    { physical: { alphaMode: 'BLEND' } }, { physical: { transmission: 0.1 } },
    { physical: { emissiveStrength: 1 } }, { physical: { metallicFactor: 0.3 } },
    { physical: { roughnessFactor: 0.4 } }, { finish: { roughness: [0.4, 0.7] } },
    { finish: undefined, physical: { roughnessFactor: 0.46 } },
    { tiling: { worldSize: [2, 1] } }, { resolution: [2048, 2048] },
  ];
  for (const patch of invalid) {
    await expect(create({ ...request(path), ...patch }, { themesDir, comfy }), JSON.stringify(patch))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  }
});

it('rejects unreadable, undersized, mismatched and nonopaque source images before writing maps', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-files-'));
  const path = join(themesDir, 'source.png');
  const attempt = () => expect(create(request(path), { themesDir, comfy })).rejects.toMatchObject({ code: 'E_SCHEMA' });
  await attempt();
  writeFileSync(path, 'invalid image');
  await attempt();
  await source(path, 32, 32);
  await attempt();
  await source(path, 128, 64);
  await attempt();
  writeFileSync(path, await sharp({ create: { width: 64, height: 64, channels: 4,
    background: { r: 80, g: 80, b: 80, alpha: 0.99 } } }).png().toBuffer());
  await attempt();
  expect(existsSync(join(themesDir, 'test/assets'))).toBe(false);
});

it('rejects a source seam through API and CLI without seed retries or altering existing maps', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-seam-'));
  const path = join(themesDir, 'source.png');
  await source(path);
  const entry = await create(request(path), { themesDir, comfy });
  const theme = join(themesDir, 'test');
  const before = bytes(theme, entry.variants[0]);
  const index = readFileSync(join(theme, 'theme.json'));
  const gradient = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) gradient.fill(x * 4, (y * 64 + x) * 3, (y * 64 + x) * 3 + 3);
  writeFileSync(path, await sharp(gradient, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer());
  const invalid = { ...request(path), overwrite: true };
  await expect(create(invalid, { themesDir, comfy })).rejects.toMatchObject({ code: 'E_SEAM_CHECK_FAILED' });
  const requestPath = join(themesDir, 'request.json');
  writeFileSync(requestPath, JSON.stringify(invalid));
  const cli = spawnSync(join(root, 'node_modules/.bin/tsx'),
    ['src/cli/create.ts', requestPath, '--themes', themesDir], { cwd: root, encoding: 'utf8' });
  expect(cli.status).toBe(1);
  expect(cli.stderr).toContain('E_SEAM_CHECK_FAILED');
  expect(cli.stdout).not.toContain('retry');
  expect(bytes(theme, entry.variants[0])).toEqual(before);
  expect(readFileSync(join(theme, 'theme.json'))).toEqual(index);
});

it('validates inherited physical response and adds a finish when appending to a patterned entry', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'source-albedo-inherit-'));
  const path = join(themesDir, 'source.png');
  await source(path);
  const options = { themesDir, comfy };
  const base = { ...request(path), sourceAlbedo: undefined, finish: undefined, aliases: [], variantId: 'pattern',
    pattern: { kind: 'mineral' as const, colors: ['#555555'] } };
  const entry = await create(base, options);
  const before = bytes(join(themesDir, 'test'), entry.variants[0]);
  const appended = await create({ ...request(path), append: true, tiling: undefined }, options);
  expect(appended.finish).toBeDefined();
  expect(bytes(join(themesDir, 'test'), appended.variants[0])).toEqual(before);
  for (const physical of [{ transmission: 0.5 }, { emissiveStrength: 1 }, { roughnessFactor: 0.2 }, { metallicFactor: 0.5 }]) {
    await create({ ...base, overwrite: true, physical }, options);
    await expect(create({ ...request(path), append: true }, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  }
});
