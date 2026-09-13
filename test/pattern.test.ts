import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';
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
      tiling: base.tiling, aspect: base.aspect, physical: base.physical,
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

it('rejects an undrawable pattern and a missing recolor source', async () => {
  const options = { themesDir: mkdtempSync(join(tmpdir(), 'pattern-invalid-')) };
  const request: CreateRequest = {
    key: 'test/pattern/mid', alignment: 'tile', description: 'pattern validation',
    tiling: { worldSize: [1, 1] }, resolution: [64, 64],
    pattern: { kind: 'stripe', colors: ['#555555'] },
  };
  await expect(create(request, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  await create({ ...request, pattern: undefined, flatColor: '#555555' }, options);
  await expect(create({ ...request, append: true, pattern: undefined,
    recolor: { from: 'absent', color: '#444444' } }, options)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});
