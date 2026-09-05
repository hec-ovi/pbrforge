import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';
import styles from '../bindings/street-styles.json';
import recipes from '../batch/cyberpunk/street-construction.json';

const theme = join(dirname(fileURLToPath(import.meta.url)), '../themes/cyberpunk');

it('binds every construction region to a continuous finish at its published scale', () => {
  for (const style of styles.styles) for (const tier of ['poor', 'mid', 'rich', 'high_rich']) {
    const bindings = style.constructionSurfaces;
    expect(bindings.border).toEqual(style.surfaces.border);
    expect(bindings.curb).toEqual(style.surfaces.curb);
    for (const [role, binding] of Object.entries(bindings)) {
      const entry = resolve(`cyberpunk/${binding.kind}/${tier}`);
      const variant = entry.variants.find(variant => variant.id === binding.variant)!;
      expect(entry.alignment).toBe('tile');
      expect(variant.layout).toEqual({ family: 'continuous', origin: [0, 0], orientation: 'isotropic' });
      if (role === 'pavingBody') {
        expect(entry.tiling?.worldSize).toEqual([2, 2]);
        expect(variant.resolution).toEqual([1024, 1024]);
      } else if (role === 'joint') {
        expect(entry.tiling?.worldSize).toEqual([0.5, 0.5]);
        expect(variant.resolution).toEqual([512, 512]);
      }
    }
  }
});

it('reproduces body wear and joint mortar from their public recipes', async () => {
  const themesDir = await mkdtemp(join(tmpdir(), 'street-construction-'));
  for (const [kind, id] of [['street-paving-body', 'salvaged'], ['street-joint', 'industrial']]) {
    const key = `cyberpunk/${kind}/mid`;
    const entry = resolve(key);
    const request = recipes.find(recipe => recipe.key === key && recipe.variantId === id)! as CreateRequest;
    const generated = await create({
      ...request, append: false, physical: entry.physical, tiling: entry.tiling,
    }, { themesDir });
    const shipped = entry.variants.find(variant => variant.id === id)!;
    for (const map of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao'] as const) {
      expect(await readFile(join(themesDir, 'cyberpunk', generated.variants[0].maps[map]!)), `${kind}/${map}`)
        .toEqual(await readFile(join(theme, shipped.maps[map]!)));
    }
  }
}, 30_000);

it('keeps paving body variation local, sparse and seamless over the complete tile', async () => {
  for (const variant of resolve('cyberpunk/street-paving-body/mid').variants) {
    const { data, info } = await sharp(join(theme, variant.maps.basecolor))
      .greyscale().raw().toBuffer({ resolveWithObject: true });
    const blocks: number[] = [];
    // A 6.25 cm region is much larger than the 6-11 mm aggregate.
    for (let y = 0; y < info.height; y += 32) for (let x = 0; x < info.width; x += 32) {
      let sum = 0;
      for (let dy = 0; dy < 32; dy++) for (let dx = 0; dx < 32; dx++) {
        sum += data[(y + dy) * info.width + x + dx];
      }
      blocks.push(sum / 1024);
    }
    const [mean, fine] = moments(data);
    expect(moments(blocks)[1], variant.id).toBeLessThan(fine * 0.35);
    expect(fine, variant.id).toBeGreaterThan(4);
    expect(data.filter(value => value < mean * 0.8).length / data.length, variant.id).toBeLessThan(0.01);
    let acrossEdge = 0;
    let alongEdge = 0;
    let acrossInside = 0;
    let alongInside = 0;
    for (let y = 0; y < info.height; y++) {
      acrossEdge += Math.abs(data[y * info.width] - data[(y + 1) * info.width - 1]);
    }
    for (let x = 0; x < info.width; x++) {
      alongEdge += Math.abs(data[x] - data[(info.height - 1) * info.width + x]);
    }
    for (let y = 0; y < info.height - 1; y++) for (let x = 0; x < info.width - 1; x++) {
      const index = y * info.width + x;
      acrossInside += Math.abs(data[index] - data[index + 1]);
      alongInside += Math.abs(data[index] - data[index + info.width]);
    }
    const samples = (info.width - 1) * (info.height - 1);
    expect(acrossEdge / info.height, variant.id).toBeLessThan(acrossInside / samples * 2 + 1);
    expect(alongEdge / info.width, variant.id).toBeLessThan(alongInside / samples * 2 + 1);
  }
});

function moments(values: Iterable<number>): [number, number] {
  let total = 0;
  let square = 0;
  let count = 0;
  for (const value of values) { total += value; square += value * value; count++; }
  const mean = total / count;
  return [mean, Math.sqrt(square / count - mean * mean)];
}
