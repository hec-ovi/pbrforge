import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(resolve(request.key, { themesDir })).toEqual(created);
    expect(list({ theme: 'test', kind: 'concrete' }, { themesDir })).toEqual([request.key]);
    expect(existsSync(join(themesDir, 'test', created.variants[0].maps.basecolor))).toBe(true);

    const before = readFileSync(join(themesDir, 'test', created.variants[0].maps.basecolor));
    const result = await refinish(
      { key: request.key, finish: { roughness: [0.82, 0.9], grain: 0.1 } },
      { themesDir },
    );
    expect(result.variants).toEqual(['1']);
    expect(result.entry.finish?.roughness).toEqual([0.82, 0.9]);
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

    const branded = await rebrand({
      theme: 'test',
      businesses: [{ brandName: 'Kiro Clinic', businessKind: 'clinic', tier: 'rich' }],
    }, { themesDir });

    expect(branded).toHaveLength(2);
    for (const kind of ['ad-screen', 'ad-screen-tall']) {
      const entry = resolve(`test/${kind}/rich`, { themesDir });
      expect(entry.variants.some((variant) => variant.id === 'brand:kiro-clinic')).toBe(true);
    }
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
