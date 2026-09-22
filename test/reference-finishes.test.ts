import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { resolve } from '../src/index.js';

const linear = (byte: number): number => byte / 255 <= 0.04045
  ? byte / 255 / 12.92 : ((byte / 255 + 0.055) / 1.055) ** 2.4;

it('retains a readable cyan hologram emission signal below fixture luminance', async () => {
  const entry = resolve('cyberpunk/interior-hologram/rich');
  const variant = entry.variants.find(v => v.id === 'lattice')!;
  const pixel = await sharp(join('themes/cyberpunk', variant.maps.emission!)).raw().toBuffer();
  const radiance = [...pixel.subarray(0, 3)].map(value => linear(value) * entry.physical.emissiveStrength!);
  expect(radiance[0]).toBeLessThan(1);
  expect(radiance[1]).toBeGreaterThan(6);
  expect(radiance[2]).toBeGreaterThan(radiance[1]!);
  expect(radiance[2]).toBeLessThan(20);
});

it('preserves the hologram variant, three response map dimensions and physical volume', async () => {
  const entry = resolve('cyberpunk/interior-hologram/rich');
  expect(entry.variants.map(v => v.id)).toEqual(['lattice']);
  expect(entry.tiling?.worldSize).toEqual([1, 1]);
  expect(entry.physical).toMatchObject({ metallicFactor: 0, roughnessFactor: 0.28, transmission: 0.72, ior: 1.1 });
  const variant = entry.variants[0]!;
  expect(variant.resolution).toEqual([64, 64]);
  for (const map of ['basecolor', 'emission', 'metallicRoughness'] as const) {
    const metadata = await sharp(join('themes/cyberpunk', variant.maps[map]!)).metadata();
    expect([metadata.width, metadata.height]).toEqual([64, 64]);
    expect(variant.ktx2?.[map]).toBeDefined();
  }
});

it('gives graphite roofs their own variant identity while sharing exact accepted maps', () => {
  const source = resolve('cyberpunk/concrete-monolith/mid');
  const graphite = source.variants.find(v => v.id === 'graphite')!;
  const roof = resolve('cyberpunk/concrete-monolith-graphite/mid');
  expect(roof.key).not.toBe(source.key);
  expect(roof.variants).toEqual([graphite]);
  expect(roof.tiling).toEqual(source.tiling);
  expect(roof.physical).toEqual(source.physical);
  expect(roof.alignment).toBe(source.alignment);
});
