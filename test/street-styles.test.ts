import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';
import styles from '../bindings/street-styles.json';
import schema from '../schema/street-styles.schema.json';
import recipes from '../batch/cyberpunk/street-surfaces.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const theme = join(root, 'themes/cyberpunk');

it('resolves three complete street families with matching paving modules at every tier', () => {
  expect(new Ajv2020().validate(schema, styles)).toBe(true);
  expect(styles.styles.map(style => style.id)).toEqual(['maintained', 'salvaged', 'industrial']);
  for (const style of styles.styles) for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
    for (const [role, binding] of Object.entries(style.surfaces)) {
      const entry = resolve(`cyberpunk/${binding.kind}/${tier}`);
      const variant = entry.variants.find(variant => variant.id === binding.variant)!;
      expect(entry.alignment).toBe('tile');
      expect(entry.variants.map(variant => variant.id)).toEqual(styles.styles.map(style => style.id));
      expect(entry.tiling?.worldSize).toEqual(role === 'road' || role === 'paving' ? [4, 4] : [2, 2]);
      expect(variant.layout?.origin).toEqual([0, 0]);
      if (role === 'paving') {
        expect(variant.layout?.moduleSize).toEqual([style.pavingPattern.width, style.pavingPattern.height]);
        expect(variant.layout?.jointWidth).toBe(style.pavingPattern.jointWidth);
      } else {
        expect(variant.layout?.family).toBe('continuous');
        expect(variant.layout?.orientation).toBe('isotropic');
        expect(variant.layout?.moduleSize).toBeUndefined();
        expect(variant.layout?.jointWidth).toBeUndefined();
      }
    }
  }
});

it('reproduces the shipped aggregate and paving maps through the public create entry', async () => {
  const themesDir = await mkdtemp(join(tmpdir(), 'street-materials-'));
  for (const [kind, id] of [['street-road', 'maintained'], ['street-paving', 'salvaged']]) {
    const key = `cyberpunk/${kind}/mid`;
    const entry = resolve(key);
    const recipe = recipes.find(recipe => recipe.key === key && recipe.variantId === id)! as CreateRequest;
    const generated = await create({
      ...recipe, append: false, tiling: entry.tiling, physical: entry.physical,
    }, { themesDir });
    const shipped = entry.variants.find(variant => variant.id === id)!;
    for (const name of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao'] as const) {
      expect(await readFile(join(themesDir, 'cyberpunk', generated.variants[0].maps[name]!)), `${kind}/${name}`)
        .toEqual(await readFile(join(theme, shipped.maps[name]!)));
    }
  }
  await expect(create({
    key: 'cyberpunk/street-invalid/mid', alignment: 'tile', description: 'invalid aggregate palette',
    tiling: { worldSize: [1, 1] }, resolution: [64, 64],
    pattern: { kind: 'aggregate', colors: ['#444444'] },
  }, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
}, 30_000);

it('keeps continuous mineral finish isotropic and road reflections broad above the damp floor', async () => {
  for (const kind of ['street-border', 'street-curb']) {
    for (const variant of resolve(`cyberpunk/${kind}/mid`).variants) {
      const { data, info } = await sharp(join(theme, variant.maps.basecolor))
        .greyscale().raw().toBuffer({ resolveWithObject: true });
      // A 25 cm comparison captures mineral weathering, not individual pores.
      const [across, along] = differences(data, info.width, info.height, info.width / 8);
      expect(across / along, `${kind}/${variant.id}`).toBeGreaterThan(0.75);
      expect(across / along, `${kind}/${variant.id}`).toBeLessThan(1.34);
    }
  }
  for (const variant of resolve('cyberpunk/street-road/mid').variants) {
    const { data, info } = await sharp(join(theme, variant.maps.roughness))
      .greyscale().raw().toBuffer({ resolveWithObject: true });
    let floor = 255;
    for (const value of data) floor = Math.min(floor, value);
    expect(floor, variant.id).toBeGreaterThanOrEqual(127);
    const pixel = differences(data, info.width, info.height, 1);
    const field = differences(data, info.width, info.height, info.width / 8);
    expect(pixel[0] + pixel[1], variant.id).toBeLessThan((field[0] + field[1]) * 0.12);
  }
});

function differences(data: Buffer, width: number, height: number, step: number): [number, number] {
  let across = 0;
  let along = 0;
  for (let y = 0; y < height - step; y++) for (let x = 0; x < width - step; x++) {
    const index = y * width + x;
    across += Math.abs(data[index + step] - data[index]);
    along += Math.abs(data[index + step * width] - data[index]);
  }
  const count = (width - step) * (height - step);
  return [across / count, along / count];
}
