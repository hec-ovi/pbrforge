import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { create, resolve, type CreateRequest, type SurfaceResponse, type Variant } from '../src/index.js';
import recipes from '../batch/cyberpunk/street-construction.json';
import { expectPackedMap } from './helpers/packed-map.js';

const response: SurfaceResponse = {
  kind: 'localized-damp', coverage: 0.4, patchScale: 0.8,
  roughness: 0.22, darkening: 0.12, reliefRetention: 0.3,
};
const original = recipes[0] as CreateRequest;
const { response: _response, ...mineral } = original.pattern!;
const request: CreateRequest = {
  ...original, key: 'sample/mineral/mid', aliases: ['sample/mineral/rich'],
  variantId: 'sample', pattern: mineral,
};

it('keeps omitted response bytes and coordinates bounded damp coverage through create and resolve', async () => {
  const themesDir = await mkdtemp(join(tmpdir(), 'material-response-'));
  const theme = join(themesDir, 'sample');
  const dry = (await create(request, { themesDir })).variants[0];
  // Published dry mineral bytes remain stable when the additive response is absent.
  const hashes = {
    basecolor: 'f672f0cac9f6da65ba1354f8e0f190065fdbb8ed4c1808f652f27b4d27e1f7ca',
    normal: '7723012cf852f925ba3e4c18f8f0a685896617e690eb148fa71737d98d5cae53',
    roughness: '7450a3357b41f862e1f7cb8f326b04eea064f6507dd2b6d431925a09fe34e4be',
    metallic: 'a3acee77059e3c784c727f5bbee93338ed98fdc5e05ba57fcf31220a3511894d',
    height: '335ba24b101ac900c6745259fec463d620c0d888efb90053beec23c7fe8e9e46',
    ao: 'a31b5dc29242cad71d86c7f77999f95f0fc6f4018c4da63da3fb398824ef7236',
  };
  for (const [map, hash] of Object.entries(hashes)) {
    expect(createHash('sha256').update(await readFile(join(theme, dry.maps[map as keyof typeof hashes]!)))
      .digest('hex'), map).toBe(hash);
  }
  const wetRequest: CreateRequest = {
    ...request, append: true, variantId: 'local', pattern: { ...mineral, response },
  };
  await create(wetRequest, { themesDir });
  const entry = resolve('sample/mineral/rich', { themesDir });
  const wet = entry.variants[1];
  expect(wet.response).toEqual(response);
  expect(dry.response).toBeUndefined();
  expect(entry.physical).toEqual(request.physical);
  expect(entry.tiling).toEqual(request.tiling);
  expect(wet.resolution).toEqual(request.resolution);
  expect(wet.maps.emission).toBeUndefined();
  const a = await channels(theme, dry);
  const b = await channels(theme, wet);
  let changed = 0, core = 0, normalDry = 0, normalWet = 0, violations = 0;
  const coreCode = Math.round(response.roughness * 255);
  for (let i = 0; i < a.roughness.length; i++) {
    const altered = a.roughness[i] !== b.roughness[i] || a.height[i] !== b.height[i]
      || a.basecolor[i] !== b.basecolor[i];
    if (altered) changed++;
    if (b.basecolor[i] > a.basecolor[i]
      || Math.abs(b.height[i] - 127.5) > Math.abs(a.height[i] - 127.5)
      || b.roughness[i] < coreCode || b.roughness[i] > a.roughness[i]) violations++;
    if (b.roughness[i] === coreCode) {
      core++;
      if (Math.abs(b.basecolor[i] - Math.round(a.basecolor[i] * (1 - response.darkening))) > 1) violations++;
      normalDry += Math.abs(a.normal[i] - 127.5);
      normalWet += Math.abs(b.normal[i] - 127.5);
    }
  }
  expect(violations).toBe(0);
  expect(changed / a.roughness.length).toBeLessThanOrEqual(response.coverage);
  expect(1 - changed / a.roughness.length).toBeGreaterThan(0.5);
  expect(core / a.roughness.length).toBeGreaterThan(response.coverage * 0.38);
  expect(core / a.roughness.length).toBeLessThan(response.coverage * 0.45);
  expect(normalWet).toBeLessThan(normalDry * 0.6);
  await expectPackedMap(theme, wet);
  const files = await Promise.all(Object.values(wet.maps).map(file => readFile(join(theme, file))));
  await create({ ...wetRequest, overwrite: true }, { themesDir });
  for (const [i, file] of Object.values(wet.maps).entries()) {
    expect((await readFile(join(theme, file))).equals(files[i]), file).toBe(true);
  }
  const recolored = await create({
    ...request, append: true, variantId: 'tint', pattern: undefined,
    recolor: { from: wet.id, color: '#62696b' },
  }, { themesDir });
  expect(recolored.variants[2].response).toEqual(response);
  expect(recolored.variants[2].maps.roughness).toBe(wet.maps.roughness);
}, 30_000);

it('retains metre-scale mask positions and smooth wrap edges at another output resolution', async () => {
  const themesDir = await mkdtemp(join(tmpdir(), 'material-response-scale-'));
  const theme = join(themesDir, 'sample');
  const outputs = [];
  for (const size of [256, 512]) {
    const entry = await create({
      ...request, key: `sample/scale-${size}/mid`, aliases: [], resolution: [size, size],
      pattern: { ...mineral, response },
    }, { themesDir });
    const data = (await channels(theme, entry.variants[0])).roughness;
    let wrapX = 0, wrapY = 0, stepX = 0, stepY = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = data[y * size + x];
      stepX += Math.abs(value - data[y * size + (x + 1) % size]);
      stepY += Math.abs(value - data[((y + 1) % size) * size + x]);
      if (x === 0) wrapX += Math.abs(value - data[y * size + size - 1]);
      if (y === 0) wrapY += Math.abs(value - data[(size - 1) * size + x]);
    }
    expect(wrapX / size).toBeLessThan(stepX / data.length * 2 + 1);
    expect(wrapY / size).toBeLessThan(stepY / data.length * 2 + 1);
    outputs.push(data);
  }
  let difference = 0;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const high = outputs[1];
    const index = y * 2 * 512 + x * 2;
    difference += Math.abs(outputs[0][y * 256 + x]
      - (high[index] + high[index + 1] + high[index + 512] + high[index + 513]) / 4);
  }
  expect(difference / outputs[0].length).toBeLessThan(0.5);
});

it('rejects unbounded response parameters and unsupported finish combinations', async () => {
  const themesDir = await mkdtemp(join(tmpdir(), 'material-response-invalid-'));
  const valid: CreateRequest = { ...request, resolution: [64, 64], pattern: { ...mineral, response } };
  const invalid = [
    ...[{ coverage: 0.5 }, { patchScale: 0.1 }, { roughness: 0.1 }, { darkening: 0.3 }, { reliefRetention: 1.1 }]
      .map(change => ({ ...valid, pattern: { ...mineral, response: { ...response, ...change } } })),
    { ...valid, pattern: { ...valid.pattern!, kind: 'concrete' as const } },
    { ...valid, alignment: 'exact' as const, tiling: undefined, aspect: [1, 1] as [number, number] },
    { ...valid, physical: { roughnessFactor: 0.46 } },
    { ...valid, physical: { metallicFactor: 1 } },
    { ...valid, physical: { transmission: 0.1 } },
    { ...valid, emission: 'luminance' as const },
    { ...valid, tiling: { worldSize: [1, 1] as [number, number] } },
  ];
  for (const input of invalid) await expect(create(input, { themesDir })).rejects.toMatchObject({ code: 'E_SCHEMA' });
});

async function channels(theme: string, variant: Variant): Promise<Record<'basecolor' | 'roughness' | 'height' | 'normal', Buffer>> {
  const load = (name: 'basecolor' | 'roughness' | 'height' | 'normal') =>
    sharp(join(theme, variant.maps[name]!)).extractChannel(0).raw().toBuffer();
  const [basecolor, roughness, height, normal] = await Promise.all([
    load('basecolor'), load('roughness'), load('height'), load('normal'),
  ]);
  return { basecolor, roughness, height, normal };
}
