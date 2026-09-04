import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve } from '../src/index.js';
import type { CreateRequest } from '../src/db/types.js';
import type { MaterialEntry } from '../src/db/types.js';
import styles from '../bindings/exterior-styles.json';
import schema from '../schema/exterior-styles.schema.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const theme = join(root, 'themes/cyberpunk');
const tiers = ['poor', 'mid', 'rich', 'high_rich'];

it('publishes nine coherent style sets whose complete bindings resolve at every tier', () => {
  expect(new Ajv2020().validate(schema, styles)).toBe(true);
  expect(new Set(styles.styles.map(style => style.id)).size).toBe(9);
  expect(new Set(styles.styles.map(style => JSON.stringify(style.surfaces))).size).toBe(9);
  for (const group of ['residential', 'premium', 'civic']) {
    expect(styles.styles.filter(style => style.group === group)).toHaveLength(3);
  }
  const entries = new Map<string, MaterialEntry>();
  const entryFor = (kind: string, tier: string) => {
    const key = `cyberpunk/${kind}/${tier}`;
    if (!entries.has(key)) entries.set(key, resolve(key));
    return entries.get(key)!;
  };
  for (const style of styles.styles) for (const tier of tiers) {
    for (const binding of Object.values(style.surfaces)) {
      const entry = entryFor(binding.kind, tier);
      expect(entry.variants.some(variant => variant.id === binding.variant)).toBe(true);
    }
    const facade = entryFor(style.surfaces.facade.kind, tier)
      .variants.find(variant => variant.id === style.surfaces.facade.variant)!;
    if (style.facadePattern.kind === 'panel') {
      expect(facade.layout?.moduleSize).toEqual([style.facadePattern.width, style.facadePattern.height]);
      expect(facade.layout?.jointWidth).toBe(style.facadePattern.jointWidth);
      expect(facade.layout?.moduleSize).toEqual([7, 3.5]);
    } else {
      expect(facade.layout?.family).toBe('continuous');
      expect(facade.layout?.moduleSize).toBeUndefined();
    }
  }
});

it('keeps glazing and modeled blind slats smooth with explicit opaque or office transmission', async () => {
  for (const tier of tiers) for (const kind of ['window-glass', 'window-glass-opaque', 'window-glass-office', 'curtain']) {
    const entry = resolve(`cyberpunk/${kind}/${tier}`);
    if (kind === 'window-glass-opaque') {
      expect(entry.physical.transmission).toBe(0);
      expect(entry.physical.roughnessFactor).toBeGreaterThanOrEqual(0.5);
    }
    if (kind === 'window-glass-office') expect(entry.physical.transmission).toBe(0.78);
    for (const variant of entry.variants.filter(variant => kind !== 'curtain' || variant.id === 'slat')) {
      const normal = (await sharp(join(theme, variant.maps.normal)).stats()).channels;
      expect(normal.map(channel => [channel.min, channel.max])).toEqual([[128, 128], [128, 128], [255, 255]]);
    }
  }
});

it('reproduces distinct concrete finishes without turning mineral stains into noisy relief', async () => {
  const recipes = JSON.parse(await readFile(join(root, 'batch/cyberpunk/exterior-finishes.json'), 'utf8')) as CreateRequest[];
  const themesDir = await mkdtemp(join(tmpdir(), 'concrete-finishes-'));
  const key = 'cyberpunk/concrete/poor';
  await create({ key, alignment: 'tile', description: 'neutral concrete base', tiling: { worldSize: [2, 2] }, physical: resolve(key).physical, flatColor: '#777777', resolution: [64, 64] }, { themesDir });
  const means: number[] = [];
  for (const recipe of recipes.filter(recipe => recipe.key === key)) {
    const reproduced = await create(recipe, { themesDir });
    const generated = reproduced.variants.find(variant => variant.id === recipe.variantId)!;
    const shipped = resolve(key).variants.find(variant => variant.id === recipe.variantId)!;
    for (const map of ['basecolor', 'normal', 'roughness'] as const) {
      expect(await readFile(join(themesDir, 'cyberpunk', generated.maps[map]))).toEqual(await readFile(join(theme, shipped.maps[map])));
    }
    const color = (await sharp(join(theme, shipped.maps.basecolor)).stats()).channels[0];
    means.push(color.mean);
    expect(color.stdev).toBeGreaterThan(3);
    const face = await sharp(join(theme, shipped.maps.normal)).extract({ left: 64, top: 64, width: 384, height: 128 }).toBuffer();
    const normal = await sharp(face).stats();
    for (const channel of normal.channels.slice(0, 2)) expect(channel.stdev).toBeLessThan(2);
  }
  expect(Math.max(...means) - Math.min(...means)).toBeGreaterThan(20);
}, 30_000);
