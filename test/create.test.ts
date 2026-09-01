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

/** Hard vertical seam: left half dark, right half bright. */
async function seamyPng(size = 64): Promise<Buffer> {
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data.fill(x < size / 2 ? 20 : 235, (y * size + x) * 3, (y * size + x) * 3 + 3);
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

  it('synthesizes a flatColor set without ComfyUI and it passes the seam gate', async () => {
    const offline = new Generator(db, new ComfyClient('http://127.0.0.1:9', 1000));
    const entry = await offline.create({
      ...request,
      key: 'cyberpunk/window-glass/poor',
      flatColor: '#d8ddd8',
      emission: 'none',
    });
    expect(entry.variants[0].maps.basecolor).toBeDefined();
    expect(existsSync(join(themesDir, 'cyberpunk', entry.variants[0].maps.basecolor))).toBe(true);
  });
});
