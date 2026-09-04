import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

it('publishes reproducible exact office, apartment and lobby plates at every tier', async () => {
  const recipes = JSON.parse(readFileSync(join(root, 'batch/cyberpunk/window-room.json'), 'utf8')) as CreateRequest[];
  const themesDir = mkdtempSync(join(tmpdir(), 'window-room-'));
  const entry = resolve('cyberpunk/window-room/mid');
  expect(entry.alignment).toBe('exact');
  expect(entry.aspect).toEqual([1, 1]);
  expect(entry.tiling).toBeUndefined();
  expect(entry.finish).toBeUndefined();
  expect(entry.physical).toEqual({ metallicFactor: 0, roughnessFactor: 1, emissiveStrength: 1 });
  expect(entry.variants.map(v => v.id)).toEqual(['office', 'apartment', 'lobby']);
  for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
    expect(resolve(`cyberpunk/window-room/${tier}`)).toEqual(entry);
  }
  for (const recipe of recipes) await create(recipe, { themesDir });
  const reproduced = resolve(entry.key, { themesDir });
  expect(reproduced).toEqual(entry);
  for (const variant of entry.variants) {
    expect(variant.class).toBe('plate');
    expect(variant.resolution).toEqual([1024, 1024]);
    const bytes = (path: string) => readFileSync(join(root, 'themes/cyberpunk', path));
    expect(bytes(variant.maps.basecolor).equals(bytes(variant.maps.emission!))).toBe(true);
    for (const path of Object.values(variant.maps)) {
      expect(readFileSync(join(themesDir, 'cyberpunk', path)).equals(bytes(path))).toBe(true);
    }
  }
});
