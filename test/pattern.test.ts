import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest, type SurfaceResponse } from '../src/index.js';
import catalog from '../schema/pattern-kinds.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const offline = async (): Promise<never> => { throw new Error('pattern reached a backend'); };

it('creates every published pattern kind through its request schema without a backend', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'patterns-'));
  const recipes = readdirSync(join(root, 'batch/cyberpunk'), { recursive: true, encoding: 'utf8' })
    .filter(path => path.endsWith('.json')).flatMap(path => {
      const value = JSON.parse(readFileSync(join(root, 'batch/cyberpunk', path), 'utf8'));
      return (Array.isArray(value) ? value : [value]) as CreateRequest[];
    });
  for (const { kind } of catalog.kinds) {
    const recipe = recipes.find(recipe => recipe.pattern?.kind === kind);
    expect(recipe, kind).toBeDefined();
    const base = resolve(recipe!.key);
    const input: CreateRequest = {
      ...recipe!, key: `test/${kind}/mid`, aliases: [], append: false, canonical: false,
      tiling: recipe!.tiling ?? base.tiling, aspect: base.aspect, physical: base.physical,
    };
    const entry = await create(input, { themesDir, comfy: { ready: offline, upload: offline, render: offline } });
    expect(entry.variants[0].class, kind).toBe('pattern');
    expect(entry.variants[0].layout).toEqual(input.layout);
    expect(entry.variants[0].response).toEqual(input.pattern?.response);
    expect(resolve(entry.key, { themesDir })).toEqual(entry);
  }
}, 30_000);

it('appends a canonical recolor while inheriting the entry and sharing relief maps', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'pattern-append-'));
  const options = { themesDir };
  const request: CreateRequest = {
    key: 'test/coating/mid', alignment: 'tile', description: 'neutral coating',
    tiling: { worldSize: [1, 1] }, resolution: [64, 64], seed: 7,
    pattern: { kind: 'noise', colors: ['#555555', '#666666'], cells: [4, 4] },
  };
  const base = await create(request, options);
  const path = join(themesDir, 'test', base.variants[0].maps.basecolor);
  const bytes = readFileSync(path);
  await create({ ...request, overwrite: true }, options);
  expect(readFileSync(path)).toEqual(bytes);
  const entry = await create({
    key: request.key, alignment: 'tile', description: 'rust paint',
    append: true, canonical: true, variantId: 'rust', recolor: { from: '1', color: '#a2683c', strength: 0.4 },
  }, options);
  expect(entry.variants.map(variant => variant.id)).toEqual(['rust', '1']);
  expect(entry.tiling).toEqual(base.tiling);
  expect(entry.physical).toEqual(base.physical);
  for (const name of ['normal', 'roughness', 'metallic', 'height', 'ao'] as const)
    expect(entry.variants[0].maps[name]).toBe(base.variants[0].maps[name]);
  expect(readFileSync(join(themesDir, 'test', entry.variants[0].maps.basecolor))).not.toEqual(bytes);
});

it('publishes bounded damp response on a mineral tile while keeping the dry area dominant', async () => {
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
  const themesDir = mkdtempSync(join(tmpdir(), 'damp-'));
  const entry = await create(request, { themesDir });
  const variant = entry.variants[0];
  expect(variant.response).toEqual(response);
  expect(variant.maps.emission).toBeUndefined();
  const pixels = await sharp(join(themesDir, 'test', variant.maps.roughness)).extractChannel(0).raw().toBuffer();
  const damp = pixels.filter(value => value < Math.round(0.8 * 255));
  expect(damp.length).toBeGreaterThan(0);
  expect(damp.length / pixels.length).toBeLessThanOrEqual(response.coverage);
  expect(Math.min(...pixels)).toBeGreaterThanOrEqual(Math.round(response.roughness * 255));
  await expect(create({ ...request, key: 'test/metal/mid', physical: { metallicFactor: 1 } }, { themesDir }))
    .rejects.toMatchObject({ code: 'E_SCHEMA' });
});

it('fits a decal to its receiving face with a transparent edge inset', async () => {
  const request: CreateRequest = {
    key: 'test/incident/mid', alignment: 'exact', aspect: [2, 1],
    description: 'fitted incident decal', resolution: [128, 64], seed: 14873,
    decal: { worldSize: [2.4, 1.2], edgeInset: 0.08, surfaceOffset: 0.002, wrapMode: 'clamp', projection: 'surface-fit' },
    physical: { roughnessFactor: 0.62, metallicFactor: 0, alphaMode: 'BLEND' },
    pattern: { kind: 'incident-blood', colors: ['#541014', '#22080a'], grain: 0 },
  };
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
