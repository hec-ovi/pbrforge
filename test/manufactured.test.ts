import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, type CreateRequest, type PatternSpec } from '../src/index.js';
import { buildPattern } from '../src/gen/pattern/build.js';

const spec: PatternSpec = {
  kind: 'brushed-metal', colors: ['#82898d', '#4c514b'], axis: 'y',
  depth: 0.4, grain: 0.12, variation: 0.08, sheen: 0.12, wear: 1,
};

it('keeps manufactured finishes periodic, shallow, and physically distinct', () => {
  const metal = buildPattern(spec, [1, 1], 0.61, 2137);
  const polymer = buildPattern({ ...spec, kind: 'composite' }, [1, 1], 0.73, 2137);
  let oxide = 0;
  let bare = 0;
  const metalRoughness = new Set<number>();
  const polymerRoughness = new Set<number>();
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const u = (x + 0.5) / 24;
    const v = (y + 0.5) / 24;
    const m = metal.sample(u, v, 1 / 512, 1 / 512);
    const p = polymer.sample(u, v, 1 / 512, 1 / 512);
    expect(p.metallic).toBe(0);
    expect(m.metallic).toBeGreaterThanOrEqual(0);
    expect(m.metallic).toBeLessThanOrEqual(1);
    if (m.metallic! < 0.98) oxide++;
    if (m.metallic! > 0.99) bare++;
    metalRoughness.add(Math.round(m.roughness * 255));
    polymerRoughness.add(Math.round(p.roughness * 255));
    expect(Math.hypot(m.normal![0], m.normal![1])).toBeLessThan(0.2);
    const wrapped = metal.sample(u + 1, v - 1, 1 / 512, 1 / 512);
    expect(wrapped.height).toBeCloseTo(m.height, 10);
    expect(wrapped.roughness).toBeCloseTo(m.roughness, 10);
    expect(wrapped.normal![0]).toBeCloseTo(m.normal![0], 10);
  }
  expect(oxide).toBeGreaterThan(25);
  expect(bare).toBeGreaterThan(150);
  expect(metalRoughness.size).toBeGreaterThan(12);
  expect(polymerRoughness.size).toBeGreaterThan(12);
});

it('publishes the authored oxide mask in both metallic and packed response maps', async () => {
  const themesDir = mkdtempSync(join(tmpdir(), 'manufactured-'));
  const request: CreateRequest = {
    key: 'test/alloy/poor', alignment: 'tile', description: 'worn alloy',
    tiling: { worldSize: [1, 1] }, resolution: [128, 128], seed: 2137,
    physical: { metallicFactor: 1, roughnessFactor: 0.61 }, pattern: spec,
  };
  try {
    const entry = await create(request, { themesDir });
    const maps = entry.variants[0].maps;
    const read = (name: keyof typeof maps) => sharp(readFileSync(join(themesDir, 'test', maps[name]!))).raw().toBuffer();
    const metallic = await sharp(join(themesDir, 'test', maps.metallic)).extractChannel(0).raw().toBuffer();
    const roughness = await sharp(join(themesDir, 'test', maps.roughness)).extractChannel(0).raw().toBuffer();
    const packed = await read('metallicRoughness');
    expect(new Set(metallic).size).toBeGreaterThan(20);
    for (let i = 0; i < metallic.length; i++) {
      expect(packed[i * 3 + 1]).toBe(roughness[i]);
      expect(packed[i * 3 + 2]).toBe(metallic[i]);
    }
    const base = await read('basecolor');
    await create({ ...request, overwrite: true }, { themesDir });
    expect(await read('basecolor')).toEqual(base);
    await expect(create({ ...request, key: 'test/mismatched/mid', physical: { metallicFactor: 0 } }, { themesDir }))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  } finally {
    rmSync(themesDir, { recursive: true, force: true });
  }
});
