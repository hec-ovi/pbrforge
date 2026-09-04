import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve } from '../src/index.js';
import type { CreateRequest } from '../src/db/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

it('publishes reproducible graphite door coatings with restrained relief and tiered wear', async () => {
  const recipes = JSON.parse(await readFile(join(root, 'batch/cyberpunk/door.json'), 'utf8')) as CreateRequest[];
  const themesDir = await mkdtemp(join(tmpdir(), 'door-coatings-'));
  let previousWear = Infinity;
  for (const recipe of recipes) {
    const entry = resolve(recipe.key);
    expect(entry.tiling?.worldSize).toEqual([0.5, 0.5]);
    expect(entry.physical.metallicFactor).toBe(0);
    expect(entry.variants.map(variant => variant.id)).toEqual(['paint', 'satin', 'scuffed']);
    const variant = entry.variants[0];
    expect(variant.class).toBe('pattern');
    const reproduced = await create(recipe, { themesDir });
    for (const [map, path] of Object.entries(variant.maps)) {
      expect(await readFile(join(themesDir, 'cyberpunk', reproduced.variants[0].maps[map as keyof typeof variant.maps]!)))
        .toEqual(await readFile(join(root, 'themes/cyberpunk', path)));
    }
    const mapStats = async (map: 'basecolor' | 'normal' | 'roughness') =>
      (await sharp(join(root, 'themes/cyberpunk', variant.maps[map])).stats()).channels;
    const color = await mapStats('basecolor');
    const wear = Math.max(...color.map(channel => channel.max - channel.min));
    expect(wear).toBeGreaterThan(1);
    expect(wear).toBeLessThanOrEqual(20);
    expect(wear).toBeLessThan(previousWear);
    previousWear = wear;
    const normal = await mapStats('normal');
    for (const channel of normal.slice(0, 2)) {
      expect(channel.min).toBeGreaterThanOrEqual(116);
      expect(channel.max).toBeLessThanOrEqual(140);
    }
    const roughness = (await mapStats('roughness'))[0];
    expect(roughness.min / 255).toBeGreaterThanOrEqual(0.45);
    expect(roughness.max).toBeGreaterThan(roughness.min);
  }
});

it('reproduces directional satin and scuffed finishes on the existing door keys', async () => {
  const base = JSON.parse(await readFile(join(root, 'batch/cyberpunk/door.json'), 'utf8')) as CreateRequest[];
  const finishes = JSON.parse(await readFile(join(root, 'batch/cyberpunk/door-finishes.json'), 'utf8')) as CreateRequest[];
  const themesDir = await mkdtemp(join(tmpdir(), 'door-finishes-'));
  for (const recipe of base) await create(recipe, { themesDir });
  for (const recipe of finishes) {
    const generated = (await create(recipe, { themesDir })).variants.find(variant => variant.id === recipe.variantId)!;
    const shipped = resolve(recipe.key).variants.find(variant => variant.id === recipe.variantId)!;
    for (const map of ['basecolor', 'normal', 'roughness'] as const) {
      expect(await readFile(join(themesDir, 'cyberpunk', generated.maps[map])))
        .toEqual(await readFile(join(root, 'themes/cyberpunk', shipped.maps[map])));
    }
    const color = (await sharp(join(root, 'themes/cyberpunk', shipped.maps.basecolor)).stats()).channels;
    expect(Math.max(...color.map(channel => channel.max))).toBeLessThan(80);
    expect(Math.max(...color.map(channel => channel.max - channel.min))).toBeGreaterThan(8);
  }
}, 15_000);
