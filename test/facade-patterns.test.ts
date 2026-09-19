import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';
import recipes from '../batch/cyberpunk/facade-patterns.json';

/** Circular starts also count a feature crossing the tile seam once. */
function starts(values: boolean[]): number[] {
  return values.flatMap((value, i) => value && !values[(i + values.length - 1) % values.length] ? [i] : []);
}

it('authors facade features at their metre scale while preserving existing finishes and aliases', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'facade-patterns-'));
  const offline = async (): Promise<never> => { throw new Error('facade pattern reached a backend'); };
  const options = { themesDir, comfy: { ready: offline, upload: offline, render: offline } };
  try {
    for (const recipe of recipes as CreateRequest[]) {
      const published = resolve(recipe.key);
      const expectedSize = recipe.variantId === 'comb' ? 0.64 : recipe.variantId === 'fixings' ? 1.5
        : recipe.variantId === 'joints' ? 3 : recipe.key.includes('paired-blind') ? 0.56 : 0.52;
      const expectedResolution = recipe.variantId === 'fixings' || recipe.variantId === 'joints' ? 1024
        : recipe.key.includes('paired-blind') ? 512 : 256;
      const publishedVariant = published.variants.find(v => v.id === recipe.variantId)!;
      expect(publishedVariant.tiling?.worldSize).toEqual([expectedSize, expectedSize]);
      expect(publishedVariant.resolution).toEqual([expectedResolution, expectedResolution]);
      const base = await create({
        key: recipe.key, aliases: published.aliases, alignment: 'tile', description: 'existing finish',
        tiling: published.tiling, physical: published.physical, resolution: [64, 64],
        variantId: published.variants[0].id, flatColor: '#888888', flatNoise: 0,
      }, options);
      const oldPath = join(themesDir, 'cyberpunk', base.variants[0].maps.basecolor);
      const oldBytes = readFileSync(oldPath);
      const entry = await create(recipe, options);
      expect(entry.tiling).toEqual(base.tiling);
      expect(entry.physical).toEqual(base.physical);
      expect(entry.variants[0]).toEqual(base.variants[0]);
      expect(readFileSync(oldPath)).toEqual(oldBytes);
      for (const alias of entry.aliases ?? []) expect(resolve(alias, options)).toEqual(entry);
      const variant = entry.variants.at(-1)!;
      expect(variant.tiling?.worldSize).toEqual([expectedSize, expectedSize]);
      const pixels = await sharp(join(themesDir, 'cyberpunk', variant.maps.basecolor)).removeAlpha().raw().toBuffer();
      const normal = await sharp(join(themesDir, 'cyberpunk', variant.maps.normal)).raw().toBuffer();
      const size = expectedResolution;
      const value = (x: number, y: number) => pixels[(Math.floor(y / expectedSize * size) * size + Math.floor(x / expectedSize * size)) * 3];
      if (recipe.pattern!.kind === 'louvre') {
        const vertical = recipe.variantId === 'comb';
        const threshold = vertical ? 35 : 85;
        const line = Array.from({ length: size }, (_, i) => pixels[(vertical ? i : i * size + 5) * 3] < threshold);
        const edges = starts(line);
        expect(edges).toHaveLength(4);
        const pitch = vertical ? 0.16 : recipe.key.includes('paired-blind') ? 0.14 : 0.13;
        for (let i = 1; i < edges.length; i++) expect((edges[i] - edges[i - 1]) * expectedSize / size).toBeCloseTo(pitch, 3);
        const channel = vertical ? 0 : 1;
        const directions = Array.from({ length: size }, (_, i) => normal[(vertical ? i : i * size + 5) * 3 + channel]);
        expect(Math.max(...directions) - Math.min(...directions)).toBeGreaterThan(80);
        // The broad face has its own tilt, away from the folded edge.
        const facePixel = Math.floor(size / 8);
        expect(Math.abs(directions[facePixel] - 128)).toBeGreaterThan(15);
        if (recipe.key.includes('paired-blind')) {
          const holeY = 0.14 * 0.68;
          const width = Array.from({ length: size / 2 }, (_, i) => value((i + 0.5) / size * expectedSize, holeY) < 85).filter(Boolean).length;
          const height = Array.from({ length: size / 4 }, (_, i) => value(0.14, (i + 0.5) / size * expectedSize) < 85);
          // Ignore the blade gap crossing the ends of this row.
          const openingRows = height.filter((dark, i) => dark && i > 10 && i < height.length - 10).length;
          expect(width * expectedSize / size).toBeCloseTo(0.076, 2);
          expect(openingRows * expectedSize / size).toBeCloseTo(0.026, 2);
        }
      } else if (recipe.variantId === 'fixings') {
        for (const x of [0.045, 1.455]) for (const y of [0.045, 1.455]) {
          expect(value(x, y)).toBeLessThan(120);
          expect(value(x + 0.016, y)).toBeGreaterThan(175);
        }
        const row = Array.from({ length: size }, (_, i) => value((i + 0.5) / size * expectedSize, 0.045) < 175);
        expect(starts(row)).toHaveLength(2);
        expect(row.filter(Boolean).length / 2 * expectedSize / size).toBeCloseTo(0.022, 2);
      } else {
        const horizontal = Array.from({ length: size }, (_, i) => value((i + 0.5) / size * expectedSize, 0.75) < 45);
        const vertical = Array.from({ length: size }, (_, i) => value(0.5, (i + 0.5) / size * expectedSize) < 45);
        expect(starts(horizontal)).toHaveLength(3);
        expect(starts(vertical)).toHaveLength(2);
        expect(horizontal.filter(Boolean).length / 3 * expectedSize / size).toBeCloseTo(0.032, 2);
        expect(vertical.filter(Boolean).length / 2 * expectedSize / size).toBeCloseTo(0.032, 2);
      }
    }
    const recipe = recipes[0] as CreateRequest;
    const recolored = await create({
      key: recipe.key, alignment: 'tile', description: 'same formed blind in graphite', append: true,
      variantId: 'graphite', recolor: { from: 'blades', color: '#444444', strength: 0.5 },
    }, options);
    expect(recolored.variants.at(-1)!.tiling).toEqual(recipe.tiling);
    await expect(create({ ...recipe, variantId: 'invalid', tiling: { worldSize: [0.56, 0.28] } }, options))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
    await expect(create({ ...recipe, variantId: 'invalid', pattern: { ...recipe.pattern!, opening: [1, 1] } }, options))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
    const fixing = recipes.find(r => r.variantId === 'fixings') as CreateRequest;
    await expect(create({ ...fixing, variantId: 'invalid', pattern: { ...fixing.pattern!, bevel: 0 } }, options))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  } finally {
    rmSync(themesDir, { recursive: true, force: true });
  }
}, 30_000);
