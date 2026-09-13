import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { expectPackedMap } from './helpers/packed-map.js';
import {
  MaterialsError,
  create,
  list,
  rebrand,
  refinish,
  resolve,
  type ComfyRuntime,
  type CreateRequest,
} from '../src/index.js';

async function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp(new Uint8Array(width * height * 3).fill(96), {
    raw: { width, height, channels: 3 },
  }).png().toBuffer();
}

const comfy: ComfyRuntime = {
  ready: async () => true,
  upload: async () => 'unused.png',
  render: async (graph) => solidPng(Number(graph['5'].inputs.width), Number(graph['5'].inputs.height)),
};

let tempThemes: string[] = [];

function themes(): string {
  const path = mkdtempSync(join(tmpdir(), 'materials-public-'));
  tempThemes.push(path);
  return path;
}

afterEach(() => {
  for (const path of tempThemes) rmSync(path, { recursive: true, force: true });
  tempThemes = [];
});

describe('public package entry', () => {
  it('creates, resolves, lists and refinishes through the configured database', async () => {
    const themesDir = themes();
    const request: CreateRequest = {
      key: 'test/concrete/mid',
      alignment: 'tile',
      description: 'neutral cast concrete',
      tiling: { worldSize: [1, 1] },
      resolution: [64, 64],
      physical: { roughnessFactor: 0.8, metallicFactor: 0 },
    };

    const created = await create(request, { themesDir, comfy });
    await expectPackedMap(join(themesDir, 'test'), created.variants[0]);
    expect(resolve(request.key, { themesDir })).toEqual(created);
    expect(list({ theme: 'test', kind: 'concrete', tier: 'mid' }, { themesDir })).toEqual([request.key]);
    expect(list({ tier: 'rich' }, { themesDir })).toEqual([]);
    expect(existsSync(join(themesDir, 'test', created.variants[0].maps.basecolor))).toBe(true);

    const before = readFileSync(join(themesDir, 'test', created.variants[0].maps.basecolor));
    const result = await refinish(
      { key: request.key, finish: { roughness: [0.82, 0.9], grain: 0.1 }, physical: { metallicFactor: 1 } },
      { themesDir },
    );
    expect(result.variants).toEqual(['1']);
    expect(result.entry.finish?.roughness).toEqual([0.82, 0.9]);
    expect(result.entry.physical.metallicFactor).toBe(1);
    await expectPackedMap(join(themesDir, 'test'), result.entry.variants[0]);
    expect(readFileSync(join(themesDir, 'test', created.variants[0].maps.basecolor))).toEqual(before);
  });

  it('rebrands both screen shapes through the public entry', async () => {
    const themesDir = themes();
    const screen = (
      key: string,
      aspect: [number, number],
      resolution: [number, number],
    ): CreateRequest => ({
      key,
      alignment: 'exact',
      description: 'dark district advertisement',
      aspect,
      resolution,
      physical: { roughnessFactor: 0.1, metallicFactor: 0, emissiveStrength: 6 },
      emission: 'image',
      flatColor: '#08080a',
      screens: [{ kind: 'led-dot', pitch: 4, description: 'brandless city advertisement' }],
    });
    await create(screen('test/ad-screen/rich', [16, 9], [128, 72]), { themesDir, comfy });
    await create(screen('test/ad-screen-tall/rich', [9, 16], [72, 128]), { themesDir, comfy });
    await create({
      key: 'test/letter-atlas/rich',
      alignment: 'exact',
      description: 'lit panel alphabet',
      aspect: [4, 3],
      resolution: [128, 96],
      physical: { roughnessFactor: 0.3, metallicFactor: 0, emissiveStrength: 5 },
      emission: 'luminance',
      variantId: 'panel',
      pattern: {
        kind: 'glyph-atlas',
        colors: ['#ffeaf7', '#ffc0e6', '#140f16'],
        line: 0.11,
        bevel: 0.015,
        depth: 0.3,
      },
    }, { themesDir });

    const original = resolve('test/ad-screen/rich', { themesDir });
    const baseEmission = readFileSync(join(themesDir, 'test', original.variants[0].maps.emission!));
    const request = {
      theme: 'test',
      businesses: [{ brandName: 'Kiro Clinic', businessKind: 'clinic' as const, tier: 'rich' as const }],
    };
    const branded = await rebrand(request, { themesDir });

    expect(branded).toHaveLength(2);
    for (const kind of ['ad-screen', 'ad-screen-tall']) {
      const entry = resolve(`test/${kind}/rich`, { themesDir });
      const variant = entry.variants.find(variant => variant.id === 'brand:kiro-clinic')!;
      expect(variant.maps.basecolor).toBe(entry.variants[0].maps.basecolor);
      const result = branded.find(item => item.key === entry.key)!;
      expect(result).toMatchObject({ variantId: variant.id, from: '1' });
      expect([1, 2]).toContain(result.lines);
      for (const variant of entry.variants) await expectPackedMap(join(themesDir, 'test'), variant);
    }
    expect(readFileSync(join(themesDir, 'test', original.variants[0].maps.emission!))).toEqual(baseEmission);
    const variant = resolve(original.key, { themesDir }).variants[1];
    const emissionPath = join(themesDir, 'test', variant.maps.emission!);
    const brandedBytes = readFileSync(emissionPath);
    expect(await rebrand(request, { themesDir })).toEqual(branded);
    expect(readFileSync(emissionPath)).toEqual(brandedBytes);
    expect(await rebrand({ theme: 'test', businesses: [] }, { themesDir })).toEqual([]);
    const indexPath = join(themesDir, 'test/theme.json');
    const index = readFileSync(indexPath);
    for (const brandName of ['Café Ñu', '!!!']) {
      await expect(rebrand({ ...request, businesses: [{ ...request.businesses[0], brandName }] }, { themesDir }))
        .rejects.toMatchObject({ code: 'E_SCHEMA' });
    }
    await expect(rebrand({ ...request, businesses: [{ ...request.businesses[0], tier: 'poor' }] }, { themesDir }))
      .rejects.toMatchObject({ code: 'E_KEY_NOT_FOUND' });
    expect(readFileSync(indexPath)).toEqual(index);
  });

  it('keeps malformed database JSON inside the closed MaterialsError set', () => {
    const themesDir = themes();
    mkdirSync(join(themesDir, 'broken'), { recursive: true });
    writeFileSync(join(themesDir, 'broken', 'theme.json'), '{');

    expect(() => list({ theme: 'broken' }, { themesDir })).toThrowError(
      expect.objectContaining<Partial<MaterialsError>>({ code: 'E_SCHEMA' }),
    );
  });
});
