import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';
import type { CreateRequest } from '../src/db/types.js';

/** Tileable fixture: uniform noise wraps by construction when generated per-pixel independently. */
async function tileablePng(size = 64): Promise<Buffer> {
  const data = new Uint8Array(size * size * 3);
  let state = 42;
  for (let i = 0; i < data.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    data[i] = 100 + (state % 40);
  }
  return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

/** Classic non-tiling failure: a smooth ramp whose only hard step is at the wrap edge. */
async function seamyPng(size = 64): Promise<Buffer> {
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data.fill(Math.round((x / (size - 1)) * 220 + 20), (y * size + x) * 3, (y * size + x) * 3 + 3);
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

function mockComfy(png: () => Promise<Buffer>): ComfyClient {
  return { ready: async () => true, render: async () => png() } as unknown as ComfyClient;
}

const request: CreateRequest = {
  key: 'cyberpunk/wall/poor',
  alignment: 'tile',
  description: 'stained concrete panels',
  tiling: { worldSize: [3, 3] },
  physical: { roughnessFactor: 0.9, metallicFactor: 0 },
  emission: 'luminance',
  resolution: [64, 64],
};

describe('create contract', () => {
  let themesDir: string;
  let db: Database;

  /** How far a normal map leans off flat, on average: what a moving light glitters on. */
  async function tilt(path: string): Promise<number> {
    const normal = await sharp(join(themesDir, 'cyberpunk', path)).raw().toBuffer();
    const lean = normal.filter((_, i) => i % 3 !== 2).reduce((sum, v) => sum + Math.abs(v - 128), 0);
    return lean / (normal.length / 3) / 2;
  }

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), 'materials-'));
    db = new Database(themesDir);
  });

  it('generates the full set, verifies seams, writes entry and files', async () => {
    const entry = await new Generator(db, mockComfy(tileablePng)).create(request);
    expect(entry.variants).toHaveLength(1);
    const maps = entry.variants[0].maps;
    for (const name of ['basecolor', 'normal', 'roughness', 'metallic', 'height', 'ao', 'emission'] as const) {
      expect(maps[name], name).toBeDefined();
      expect(existsSync(join(themesDir, 'cyberpunk', maps[name]!))).toBe(true);
    }
    expect(entry.variants[0].resolution).toEqual([64, 64]);
    expect(db.resolve('cyberpunk/wall/poor').physical.roughnessFactor).toBe(0.9);
  });

  it('throws E_KEY_EXISTS on a second create without overwrite', async () => {
    const generator = new Generator(db, mockComfy(tileablePng));
    await generator.create(request);
    await expect(generator.create(request)).rejects.toMatchObject({ code: 'E_KEY_EXISTS' });
    await generator.create({ ...request, overwrite: true });
  });

  it('throws E_SCHEMA when tile alignment has no tiling config', async () => {
    await expect(
      new Generator(db, mockComfy(tileablePng)).create({ ...request, tiling: undefined }),
    ).rejects.toMatchObject({ code: 'E_SCHEMA' });
  });

  it('throws E_SEAM_CHECK_FAILED on a seamy image and writes nothing', async () => {
    await expect(new Generator(db, mockComfy(seamyPng)).create(request)).rejects.toMatchObject({
      code: 'E_SEAM_CHECK_FAILED',
    });
    const index = JSON.parse(readFileSync(join(themesDir, 'cyberpunk/theme.json'), 'utf8'));
    expect(index.entries).toEqual({});
  });

  it('throws E_COMFY_UNAVAILABLE when ComfyUI is unreachable', async () => {
    const offline = new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));
    await expect(offline.create(request)).rejects.toMatchObject({ code: 'E_COMFY_UNAVAILABLE' });
  });

  it('shows the ad through the display structure and leaves the screen surface flat', async () => {
    const artwork = await tileablePng(64);
    const graphs: Record<string, { inputs: Record<string, unknown> }>[] = [];
    const comfy = {
      ready: async () => true,
      render: async (graph: Record<string, { inputs: Record<string, unknown> }>) => {
        graphs.push(graph);
        return artwork;
      },
    } as unknown as ComfyClient;

    const entry = await new Generator(db, comfy).create({
      key: 'cyberpunk/ad-screen/poor',
      alignment: 'exact',
      description: 'district advertisement',
      brandName: 'NOODLE-9',
      businessKind: 'noodle bar',
      aspect: [16, 9],
      resolution: [64, 64],
      physical: { roughnessFactor: 0.1, metallicFactor: 0, emissiveStrength: 6 },
      emission: 'image',
      flatColor: '#08080a',
      screens: [
        { kind: 'led-dot', pitch: 8, description: 'a man eating noodles from a cup' },
        { kind: 'glyph-panel', description: 'cyan circuit glyphs' },
      ],
    });
    const read = (variant: number, name: keyof (typeof entry.variants)[0]['maps']) =>
      sharp(join(themesDir, 'cyberpunk', entry.variants[variant].maps[name]!)).raw().toBuffer();

    expect(entry.variants).toHaveLength(2); // screens set the variant count
    expect(graphs[0]['3'].inputs.text).toContain('a noodle bar'); // the business steers the artwork
    expect(graphs[0]['3'].inputs.text).not.toContain('NOODLE-9'); // the brand never enters the prompt

    const led = await read(0, 'emission');
    expect(Math.min(...led)).toBeLessThan(20); // dark gaps between the lit dots
    expect(Math.max(...led)).toBeGreaterThan(90); // the dots carry the ad
    // glyph panel: no lattice, but the wordmark is stroked in far brighter than the artwork
    expect(Math.max(...(await read(1, 'emission')))).toBeGreaterThan(200);

    const base = await read(0, 'basecolor');
    expect(Math.max(...base)).toBeLessThan(40); // near-black glass, not the ad
    expect(new Set(base).size).toBeGreaterThan(1); // carrying the faint dot structure
    expect([...new Set(await read(0, 'normal'))].sort()).toEqual([128, 255]); // no relief
  });

  it('paints a screen from a provided source through the upscale, with nothing diffused', async () => {
    // stands in for the 4x model output: flat and bright, so the display structure over it is visible
    const upscaled = await sharp(new Uint8Array(512 * 288 * 3).fill(200), {
      raw: { width: 512, height: 288, channels: 3 },
    })
      .png()
      .toBuffer();
    const graphs: Record<string, { class_type: string; inputs: Record<string, unknown> }>[] = [];
    const uploads: string[] = [];
    const comfy = {
      ready: async () => true,
      upload: async (image: Buffer, name: string) => {
        uploads.push(`${name}:${image.length}`);
        return 'stored.png';
      },
      render: async (graph: Record<string, { class_type: string; inputs: Record<string, unknown> }>) => {
        graphs.push(graph);
        return upscaled;
      },
    } as unknown as ComfyClient;

    const entry = await new Generator(db, comfy).create({
      key: 'cyberpunk/ad-screen/high_rich',
      alignment: 'exact',
      description: 'corporate tower advertisement painted from a provided source',
      aspect: [16, 9],
      resolution: [128, 72],
      physical: { roughnessFactor: 0.04, metallicFactor: 0, emissiveStrength: 10 },
      emission: 'image',
      flatColor: '#050507',
      screens: [
        {
          kind: 'scanline-billboard',
          pitch: 4,
          imagePath: 'sources/ads-grok/ad-retro-soda-wide.png',
          description: 'a woman drinking amber soda from a chilled glass bottle',
        },
      ],
    });

    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('ad-retro-soda-wide.png'); // the file on disk, not a prompt
    expect(graphs).toHaveLength(1);
    expect(graphs[0]['3'].class_type).toBe('ImageUpscaleWithModel');
    expect(graphs[0]['1'].inputs.image).toBe('stored.png');
    expect(Object.values(graphs[0]).some((node) => node.class_type === 'KSampler')).toBe(false);

    // fitted to the screen, and the same scan bands every other billboard carries
    expect(entry.variants[0].resolution).toEqual([128, 72]);
    const emission = await sharp(join(themesDir, 'cyberpunk', entry.variants[0].maps.emission!)).raw().toBuffer();
    expect(Math.min(...emission)).toBeLessThan(0.5 * Math.max(...emission));
  });

  it('throws E_SCHEMA when a screen names a source that is not there', async () => {
    await expect(
      new Generator(db, mockComfy(tileablePng)).create({
        key: 'cyberpunk/ad-screen/rich',
        alignment: 'exact',
        description: 'advertisement from a provided source',
        aspect: [16, 9],
        resolution: [128, 72],
        emission: 'image',
        flatColor: '#050507',
        screens: [{ kind: 'led-dot', imagePath: 'sources/ads-grok/absent.png', description: 'an advertisement' }],
      }),
    ).rejects.toMatchObject({ code: 'E_SCHEMA' });
  });

  it('keeps the gloss inside the finish band and the pixel speckle out of the relief', async () => {
    // the fixture is per-pixel noise: read straight out it is exactly the glitter case
    const entry = await new Generator(db, mockComfy(tileablePng)).create({
      ...request,
      finish: { roughness: [0.8, 0.9], grain: 0 },
    });
    expect(entry.finish).toEqual({ roughness: [0.8, 0.9], grain: 0, relief: 2 });

    const roughness = await sharp(join(themesDir, 'cyberpunk', entry.variants[0].maps.roughness)).raw().toBuffer();
    expect(Math.min(...roughness) / 255).toBeGreaterThanOrEqual(0.79);
    expect(Math.max(...roughness) / 255).toBeLessThanOrEqual(0.91);

    // the same surface with its speckle kept: the grain is what decides how much light the relief catches
    const speckled = await new Generator(db, mockComfy(tileablePng)).create({
      ...request,
      key: 'cyberpunk/wall/mid',
      finish: { roughness: [0.8, 0.9], grain: 1 },
    });
    expect(await tilt(entry.variants[0].maps.normal)).toBeLessThan(0.3 * (await tilt(speckled.variants[0].maps.normal)));
  });

  it('synthesizes a flatColor set without ComfyUI and it passes the seam gate', async () => {
    const offline = new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));
    const entry = await offline.create({
      ...request,
      key: 'cyberpunk/window-glass/poor',
      flatColor: '#d8ddd8',
      emission: 'none',
    });
    expect(entry.variants[0].class).toBe('flat');
    expect(entry.finish).toBeUndefined();
    expect(entry.variants[0].maps.basecolor).toBeDefined();
    expect(existsSync(join(themesDir, 'cyberpunk', entry.variants[0].maps.basecolor))).toBe(true);
  });
});
