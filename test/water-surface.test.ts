import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Ajv2020 as Ajv } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import type { CreateRequest, MapName, MaterialEntry } from '../src/db/types.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requests = JSON.parse(readFileSync(join(root, 'batch/cyberpunk/water-surface.json'), 'utf8')) as CreateRequest[];
const bindings = JSON.parse(readFileSync(join(root, 'bindings/atlas-hydrology.json'), 'utf8')) as Record<
  string,
  { key: string; variantId: string }
>;
const bindingSchema = JSON.parse(readFileSync(join(root, 'schema/atlas-hydrology-bindings.schema.json'), 'utf8'));
const requiredMaps: MapName[] = ['basecolor', 'normal', 'roughness', 'metallic'];

describe('water surface contract', () => {
  it('creates the three fitted tiled variants deterministically through the public generator', async () => {
    const themesDir = mkdtempSync(join(tmpdir(), 'water-materials-'));
    const db = new Database(themesDir);
    const generator = new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));
    let entry: MaterialEntry | undefined;
    for (const request of requests) entry = await generator.create(request);

    expect(entry).toMatchObject({
      key: 'cyberpunk/water-surface/high_rich',
      alignment: 'tile',
      tiling: { worldSize: [8, 8] },
      physical: { metallicFactor: 0, transmission: 0.12, ior: 1.333 },
    });
    expect(entry!.variants.map((variant) => variant.id)).toEqual(['lagoon', 'river', 'sea-coast']);

    const original = new Map<string, Buffer>();
    const normalLean: number[] = [];
    for (const variant of entry!.variants) {
      expect(variant).toMatchObject({ class: 'pattern', resolution: [512, 512] });
      for (const map of requiredMaps) {
        const path = join(themesDir, 'cyberpunk', variant.maps[map]!);
        expect(existsSync(path), `${variant.id}:${map}`).toBe(true);
        original.set(`${variant.id}:${map}`, readFileSync(path));
      }
      normalLean.push(await lean(join(themesDir, 'cyberpunk', variant.maps.normal)));
    }
    expect(normalLean[0]).toBeLessThan(normalLean[1]);
    expect(normalLean[1]).toBeLessThan(normalLean[2]);

    for (const [index, request] of requests.entries()) {
      entry = await generator.create({ ...request, overwrite: true });
      expect(entry.variants[index].id).toBe(request.variantId);
    }
    for (const variant of entry!.variants) {
      for (const map of requiredMaps) {
        expect(readFileSync(join(themesDir, 'cyberpunk', variant.maps[map]!))).toEqual(
          original.get(`${variant.id}:${map}`),
        );
      }
    }
  });

  it('resolves every exact Atlas key through the shipped binding map with no fallback', () => {
    expect(new Ajv().compile(bindingSchema)(bindings)).toBe(true);
    expect(Object.keys(bindings)).toEqual(['water.lagoon', 'water.river', 'water.sea-coast']);
    const db = new Database(join(root, 'themes'));
    for (const [atlasKey, binding] of Object.entries(bindings)) {
      const entry = db.resolve(binding.key);
      const variant = entry.variants.find((item) => item.id === binding.variantId);
      expect(entry.alignment, atlasKey).toBe('tile');
      expect(entry.tiling?.worldSize, atlasKey).toEqual([8, 8]);
      expect(variant, atlasKey).toBeDefined();
      for (const map of requiredMaps) expect(variant!.maps[map], `${atlasKey}:${map}`).toBeDefined();
    }
  });
});

async function lean(path: string): Promise<number> {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    total += (Math.abs(data[index] - 128) + Math.abs(data[index + 1] - 128)) / 2;
  }
  return total / (info.width * info.height);
}
