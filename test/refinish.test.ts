import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';
import { Refinisher } from '../src/gen/Refinish.js';
import type { CreateRequest } from '../src/db/types.js';

/** Per-pixel noise: the surface that made the maps glitter before the finish lane. */
async function noisePng(size = 64): Promise<Buffer> {
  const data = new Uint8Array(size * size * 3);
  let state = 7;
  for (let i = 0; i < data.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    data[i] = 90 + (state % 60);
  }
  return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

function mockComfy(): ComfyClient {
  return { ready: async () => true, render: async () => noisePng() } as unknown as ComfyClient;
}

const request: CreateRequest = {
  key: 'cyberpunk/concrete/mid',
  alignment: 'tile',
  description: 'cast concrete surface',
  tiling: { worldSize: [3, 3] },
  physical: { roughnessFactor: 0.85, metallicFactor: 0 },
  resolution: [64, 64],
};

describe('refinish contract', () => {
  let themesDir: string;
  let db: Database;

  beforeEach(() => {
    themesDir = mkdtempSync(join(tmpdir(), 'materials-'));
    db = new Database(themesDir);
  });

  it('re-reads the maps under a new band and leaves the basecolor alone', async () => {
    const created = await new Generator(db, mockComfy()).create(request);
    const path = (name: 'basecolor' | 'roughness') => join(themesDir, 'cyberpunk', created.variants[0].maps[name]!);
    const before = readFileSync(path('basecolor'));

    const { entry, variants } = await new Refinisher(db).refinish({
      key: 'cyberpunk/concrete/mid',
      finish: { roughness: [0.9, 0.95], grain: 0.1 },
      physical: { roughnessFactor: 0.92, metallicFactor: 1 },
    });

    expect(variants).toEqual(['1']);
    expect(entry.finish).toEqual({ roughness: [0.9, 0.95], grain: 0.1, relief: 2 });
    const stored = db.resolve('cyberpunk/concrete/mid');
    expect(stored.finish?.roughness).toEqual([0.9, 0.95]);
    expect(stored.physical).toEqual({ roughnessFactor: 0.92, metallicFactor: 1 });
    expect(readFileSync(path('basecolor')).equals(before)).toBe(true);

    const roughness = await sharp(path('roughness')).raw().toBuffer();
    expect(Math.min(...roughness) / 255).toBeGreaterThanOrEqual(0.89);
    expect(Math.max(...roughness) / 255).toBeLessThanOrEqual(0.96);
    const metallic = await sharp(join(themesDir, 'cyberpunk', created.variants[0].maps.metallic)).raw().toBuffer();
    expect(new Set(metallic)).toEqual(new Set([255])); // the fill follows the factor
  });

  it('throws E_SCHEMA on a screen, whose maps carry no relief', async () => {
    await new Generator(db, mockComfy()).create({
      key: 'cyberpunk/ad-screen/mid',
      alignment: 'exact',
      description: 'district advertisement',
      aspect: [1, 1],
      resolution: [64, 64],
      physical: { roughnessFactor: 0.1, emissiveStrength: 6 },
      emission: 'image',
      flatColor: '#08080a',
      screens: [{ kind: 'led-dot', pitch: 8, description: 'a bowl of noodles' }],
    });
    await expect(new Refinisher(db).refinish({ key: 'cyberpunk/ad-screen/mid' })).rejects.toMatchObject({
      code: 'E_SCHEMA',
    });
  });
});
