import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { resolve } from '../src/index.js';
import { decodeRgb } from '../src/gen/pixels.js';
import { seamScore } from '../src/gen/seam.js';

it('publishes seamless 2048 squared linear masks at the declared world scales', async () => {
  const binding = JSON.parse(fs.readFileSync('bindings/surface-detail.json', 'utf8'));
  expect(Object.keys(binding.masks)).toHaveLength(6);
  for (const mask of Object.values(binding.masks) as any[]) {
    const entry = resolve(mask.key), variant = entry.variants.find(v => v.id === mask.variant)!;
    expect(variant.resolution).toEqual([2048, 2048]);
    expect((variant.tiling ?? entry.tiling)?.worldSize).toEqual(mask.worldSize);
    const t = binding.textures[mask.texture];
    expect(t.colorSpace).toBe('linear');
    const bytes = fs.readFileSync(t.path);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(t.sha256);
    const raw = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    expect(new Set(raw.data).size).toBeGreaterThan(100);
    const edge = seamScore(await decodeRgb(bytes));
    expect(Math.max(edge.x, edge.y)).toBeLessThanOrEqual(1.2);
  }
}, 30000);

it('keeps alpha gutters around every engine atlas cell and includes all six decal categories', async () => {
  const binding = JSON.parse(fs.readFileSync('bindings/surface-detail.json', 'utf8'));
  const entry = resolve(binding.atlas.key), variant = entry.variants[0];
  expect(variant.id).toBe('engine-grid');
  expect(new Set(binding.atlas.cells.map((c: any) => c.kind))).toEqual(new Set(['oil', 'tyre', 'crack', 'water', 'gum', 'paint-chip']));
  const base = await sharp(`themes/cyberpunk/${variant.maps.basecolor}`).ensureAlpha().raw().toBuffer();
  const opacity = await sharp(`themes/cyberpunk/${variant.maps.opacity}`).extractChannel(0).raw().toBuffer();
  let visible = 0, transparent = 0;
  for (let y = 0; y < 2048; y++) for (let x = 0; x < 2048; x++) {
    const i = y * 2048 + x, a = base[i * 4 + 3];
    if (a) visible++; else transparent++;
    if (x % 512 < 24 || y % 512 < 24 || x % 512 >= 488 || y % 512 >= 488) expect(a).toBe(0);
    if (a !== opacity[i]) throw new Error(`alpha disagrees at ${x},${y}`);
  }
  expect(visible).toBeGreaterThan(2048 * 2048 * .08);
  expect(transparent).toBeGreaterThan(2048 * 2048 * .45);
}, 30000);
