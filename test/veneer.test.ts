import { expect, it } from 'vitest';
import { parseHex } from '../src/gen/color.js';
import type { PatternParams, Texel } from '../src/gen/pattern/Pattern.js';
import { Veneer } from '../src/gen/pattern/Veneer.js';

const params: PatternParams = {
  kind: 'veneer', colors: ['#5a4030', '#3e2c23'].map(parseHex), world: [1, 2],
  axis: 'y', seed: 1729, roughness: 0.52, grain: 0.18, depth: 0.18,
  variation: 0.12, sheen: 0.14, wear: 0.05, cells: [1, 1], line: 0,
  bevel: 0, joint: 0, octaves: 1, wet: 0, chop: 0, bond: 'stack', split: 0.5, edgeInset: 0,
};

const channels = (value: Texel): number[] => [value.color.r, value.color.g, value.color.b,
  value.height, value.roughness, ...value.normal!];

it('keeps colour, pore normals and varnish continuous through both tile boundaries', () => {
  const veneer = new Veneer(params);
  for (const [u, v] of [[0.13, 0.22], [0.86, 0.79], [0, 0.61], [0.43, 0]]) {
    const centre = channels(veneer.sample(u, v, 1 / 512, 1 / 1024));
    const repeated = channels(veneer.sample(u + 2, v - 3, 1 / 512, 1 / 1024));
    centre.forEach((value, i) => expect(repeated[i]).toBeCloseTo(value, 9));
  }
  for (const axis of [0, 1]) for (const fraction of [0.21, 0.58, 0.87]) {
    const before = channels(veneer.sample(axis === 0 ? 1 - 1e-8 : fraction,
      axis === 1 ? 1 - 1e-8 : fraction, 1 / 512, 1 / 1024));
    const after = channels(veneer.sample(axis === 0 ? 1e-8 : fraction,
      axis === 1 ? 1e-8 : fraction, 1 / 512, 1 / 1024));
    before.forEach((value, i) => expect(after[i]).toBeCloseTo(value, 4));
  }
});

it('rotates metric fibres and their normal direction with the grain axis', () => {
  const vertical = new Veneer(params);
  const horizontal = new Veneer({ ...params, world: [2, 1], axis: 'x' });
  for (const [u, v] of [[0.2, 0.7], [0.62, 0.36], [0.81, 0.91]]) {
    const a = vertical.sample(u, v, 1 / 512, 1 / 1024);
    const b = horizontal.sample(v, u, 1 / 1024, 1 / 512);
    expect(b.color).toEqual(a.color);
    expect(b.height).toEqual(a.height);
    expect(b.roughness).toEqual(a.roughness);
    expect(b.normal![0]).toBeCloseTo(-a.normal![1], 9);
    expect(b.normal![1]).toBeCloseTo(-a.normal![0], 9);
  }
});

it('preserves varnish variation on a flat finish and filters unresolved pores', () => {
  const detailed = new Veneer(params);
  const flat = new Veneer({ ...params, depth: 0, grain: 0 });
  let across = 0;
  let along = 0;
  let low = 1;
  let high = 0;
  let filtered = 0;
  for (let i = 0; i < 160; i++) {
    const u = ((i * 67) % 163 + 0.5) / 163;
    const v = ((i * 43) % 167 + 0.5) / 167;
    const a = detailed.sample(u, v, 1 / 512, 1 / 1024);
    const b = flat.sample(u, v, 1 / 512, 1 / 1024);
    const distant = detailed.sample(u, v, 1 / 16, 1 / 32);
    across += Math.abs(a.normal![0]);
    along += Math.abs(a.normal![1]);
    filtered += Math.abs(distant.normal![0]) + Math.abs(distant.normal![1]);
    expect(b.height).toBe(0.5);
    expect(b.normal!.slice(0, 2).every(value => value === 0)).toBe(true);
    expect(b.roughness).toEqual(a.roughness);
    low = Math.min(low, b.roughness);
    high = Math.max(high, b.roughness);
  }
  expect(high - low).toBeGreaterThan(0.08);
  expect(across).toBeGreaterThan(0.1);
  expect(across).toBeGreaterThan(along * 5);
  expect(filtered).toBeLessThan(across * 0.05);
});
