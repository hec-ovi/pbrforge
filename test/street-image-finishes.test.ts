import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest } from '../src/index.js';
import styles from '../bindings/street-styles.json';
import markings from '../bindings/street-markings.json';
import markingSchema from '../schema/street-markings.schema.json';
import recipes from '../batch/cyberpunk/street-image-finishes.json';
import { expectPackedMap } from './helpers/packed-map.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themeDir = join(root, 'themes/cyberpunk');
const tiers = ['poor', 'mid', 'rich', 'high_rich'];

it('publishes distinct candidate family tones and dry responses at a shared physical grain scale', async () => {
  for (const kind of ['street-road', 'street-precast', 'street-graphite']) {
    const means: number[] = [];
    const factors: number[] = [];
    for (const style of styles.styles) {
      const key = `cyberpunk/${kind}-${style.id}`;
      const entry = resolve(`${key}/mid`);
      for (const tier of tiers) expect(resolve(`${key}/${tier}`)).toEqual(entry);
      const selected = entry.variants[0];
      expect(selected.id).toBe('finish');
      expect(entry.tiling?.worldSize).toEqual([1, 1]);
      expect(selected.resolution).toEqual([1024, 1024]);
      expect(selected.layout).toEqual({ family: 'continuous', origin: [0, 0], orientation: 'isotropic' });
      expect(selected.maps.emission).toBeUndefined();
      expect(entry.physical.metallicFactor).toBe(0);
      expect(entry.finish!.roughness[0]).toBeGreaterThanOrEqual(0.45);
      const pixels = await sharp(join(themeDir, selected.maps.basecolor)).greyscale().raw().toBuffer();
      means.push(pixels.reduce((sum, value) => sum + value, 0) / pixels.length);
      factors.push(entry.physical.roughnessFactor!);
      await expectPackedMap(themeDir, selected);
    }
    // Family palette differences are visible tone changes, independent of the unchanged metre scale.
    expect(Math.max(...means) - Math.min(...means), kind).toBeGreaterThan(12);
    expect(new Set(factors).size, kind).toBe(3);
  }
});

it('binds white and orange road semantics to complete nonemissive continuous coatings', async () => {
  expect(new Ajv2020().validate(markingSchema, markings)).toBe(true);
  for (const binding of Object.values(markings.surfaces)) {
    const entry = resolve(`cyberpunk/${binding.kind}/mid`);
    for (const tier of tiers) expect(resolve(`cyberpunk/${binding.kind}/${tier}`)).toEqual(entry);
    const variant = entry.variants.find(variant => variant.id === binding.variant)!;
    expect(entry.alignment).toBe('tile');
    expect(entry.tiling?.worldSize).toEqual([1, 1]);
    expect(entry.physical.metallicFactor).toBe(0);
    expect(entry.physical.transmission ?? 0).toBe(0);
    expect(entry.physical.emissiveStrength ?? 0).toBe(0);
    expect(variant.layout).toEqual({ family: 'continuous', origin: [0, 0], orientation: 'isotropic' });
    expect(variant.maps.emission).toBeUndefined();
    await expectPackedMap(themeDir, variant);
  }
});

it('reproduces every candidate source, canonical tone and marking through public recipes without a backend', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'street-image-catalog-'));
  const offline = async (): Promise<never> => { throw new Error('street sources must generate locally'); };
  const options = { themesDir, comfy: { ready: offline, upload: offline, render: offline } };
  for (const request of recipes as CreateRequest[]) {
    const actual = await create(request, options);
    const expected = resolve(request.key);
    const variant = actual.variants.find(variant => variant.id === request.variantId)!;
    const shipped = expected.variants.find(variant => variant.id === request.variantId)!;
    expect(variant).toEqual(shipped);
    for (const [name, path] of Object.entries(variant.maps)) {
      expect(readFileSync(join(themesDir, 'cyberpunk', path)).equals(readFileSync(join(themeDir, path))),
        `${request.key}/${variant.id}/${name}`).toBe(true);
    }
  }
}, 30_000);
