import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import { ComfyClient } from '../src/gen/ComfyClient.js';
import { Generator } from '../src/gen/Generator.js';
import type { Business, CreateRequest, MaterialEntry } from '../src/db/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A brandless picture: a horizontal ramp that stays well under the lit glyphs. */
async function rampPng(width: number, height: number): Promise<Buffer> {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.fill(20 + Math.round((x / (width - 1)) * 100), (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Paints whatever size the graph asks for, so one mock serves both screen shapes. */
const comfy = {
  ready: async () => true,
  render: async (graph: Record<string, { inputs: Record<string, number> }>) => rampPng(graph['5'].inputs.width, graph['5'].inputs.height),
} as unknown as ComfyClient;

function screen(key: string, aspect: [number, number], resolution: [number, number], kind: 'led-dot' | 'glyph-panel'): CreateRequest {
  return {
    key,
    alignment: 'exact',
    description: 'district advertisement',
    aspect,
    resolution,
    physical: { roughnessFactor: 0.1, metallicFactor: 0, emissiveStrength: 6 },
    emission: 'image',
    flatColor: '#08080a',
    screens: [{ kind, pitch: 8, description: 'a brandless advertisement' }],
  };
}

const atlas: CreateRequest = {
  key: 'cyberpunk/letter-atlas/rich',
  alignment: 'exact',
  description: 'backlit panel letter sheet',
  aspect: [4, 3],
  resolution: [512, 384],
  physical: { roughnessFactor: 0.28, metallicFactor: 0, emissiveStrength: 5 },
  emission: 'luminance',
  variantId: 'panel',
  pattern: { kind: 'glyph-atlas', colors: ['#ffeaf7', '#ffc0e6', '#140f16'], line: 0.11, bevel: 0.015, depth: 0.3 },
};

const businesses: Business[] = [
  { brandName: 'Noodle-9', businessKind: 'restaurant', tier: 'rich' },
  { brandName: 'The Grand Meridian Hotel', businessKind: 'hotel', tier: 'rich' },
];

/** How many separate bands of lit rows a picture carries: one per line of text. */
async function litBands(path: string): Promise<number> {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  let bands = 0;
  let inside = false;
  for (let y = 0; y < info.height; y++) {
    const row = data.subarray(y * info.width * 3, (y + 1) * info.width * 3);
    const lit = Math.max(...row) > 160;
    if (lit && !inside) bands++;
    inside = lit;
  }
  return bands;
}

describe('rebrand contract', () => {
  let themesDir: string;
  let db: Database;
  let before: { entries: MaterialEntry[]; emission: Buffer };
  let stdout: string;

  function rebrand(list: Business[]) {
    const file = join(themesDir, 'businesses.json');
    writeFileSync(file, JSON.stringify(list));
    return spawnSync(
      join(root, 'node_modules', '.bin', 'tsx'),
      ['src/cli/rebrand.ts', '--theme', 'cyberpunk', '--businesses', file, '--themes', themesDir],
      { cwd: root, encoding: 'utf8' },
    );
  }

  function file(entry: MaterialEntry, id: string, name: 'emission' | 'basecolor'): string {
    return join(themesDir, 'cyberpunk', entry.variants.find((v) => v.id === id)!.maps[name]!);
  }

  beforeAll(async () => {
    themesDir = mkdtempSync(join(tmpdir(), 'materials-'));
    db = new Database(themesDir);
    const generator = new Generator(db, comfy);
    await generator.create(screen('cyberpunk/ad-screen/rich', [16, 9], [256, 144], 'led-dot'));
    await generator.create(screen('cyberpunk/ad-screen-tall/rich', [9, 16], [144, 256], 'glyph-panel'));
    await generator.create(atlas);
    const wide = db.resolve('cyberpunk/ad-screen/rich');
    before = { entries: [wide, db.resolve('cyberpunk/ad-screen-tall/rich')], emission: readFileSync(file(wide, '1', 'emission')) };

    const run = rebrand(businesses);
    expect(run.status, run.stderr).toBe(0);
    stdout = run.stdout;
  });

  it('writes one brand variant per business on both screen kinds, resolvable by id', () => {
    for (const kind of ['ad-screen', 'ad-screen-tall']) {
      const entry = db.resolve(`cyberpunk/${kind}/rich`);
      for (const id of ['brand:noodle-9', 'brand:the-grand-meridian-hotel']) {
        expect(stdout).toContain(`branded cyberpunk/${kind}/rich#${id}`);
        const variant = entry.variants.find((v) => v.id === id);
        expect(variant?.maps.emission).toBe(`assets/${kind}/rich/brand/${id.slice(6)}/emission.png`);
        expect(existsSync(join(themesDir, 'cyberpunk', variant!.maps.emission!))).toBe(true);
        // same screen surface, a different picture on it
        expect(variant!.maps.basecolor).toBe(entry.variants[0].maps.basecolor);
        expect(readFileSync(file(entry, id, 'emission')).equals(readFileSync(file(entry, '1', 'emission')))).toBe(false);
      }
    }
  });

  it('spells a short name on one line and breaks a long one over two', async () => {
    const tall = db.resolve('cyberpunk/ad-screen-tall/rich');
    expect(stdout).toContain('#brand:noodle-9 over 1 (1 line)');
    expect(stdout).toContain('#brand:the-grand-meridian-hotel over 1 (2 lines)');
    expect(await litBands(file(tall, 'brand:noodle-9', 'emission'))).toBe(1);
    expect(await litBands(file(tall, 'brand:the-grand-meridian-hotel', 'emission'))).toBe(2);
  });

  it('leaves the base variants and their maps untouched', () => {
    const wide = db.resolve('cyberpunk/ad-screen/rich');
    const tall = db.resolve('cyberpunk/ad-screen-tall/rich');
    expect(wide.variants.slice(0, 1)).toEqual(before.entries[0].variants);
    expect(tall.variants.slice(0, 1)).toEqual(before.entries[1].variants);
    expect(readFileSync(file(wide, '1', 'emission')).equals(before.emission)).toBe(true);
  });

  it('replaces the same variants with the same maps when run again', () => {
    const wide = db.resolve('cyberpunk/ad-screen/rich');
    const first = readFileSync(file(wide, 'brand:the-grand-meridian-hotel', 'emission'));
    const again = rebrand(businesses);
    expect(again.status, again.stderr).toBe(0);
    expect(db.resolve('cyberpunk/ad-screen/rich').variants).toHaveLength(wide.variants.length);
    expect(readFileSync(file(wide, 'brand:the-grand-meridian-hotel', 'emission')).equals(first)).toBe(true);
  });

  it('rejects a business kind outside the parcel types with E_SCHEMA', () => {
    const run = rebrand([{ brandName: 'Kiro', businessKind: 'bar' as Business['businessKind'], tier: 'rich' }]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('E_SCHEMA');
  });

  it('rejects a name outside the letter atlas charset with E_SCHEMA, writing nothing', () => {
    const run = rebrand([{ brandName: 'Café Ñu', businessKind: 'coffee_shop', tier: 'rich' }]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('E_SCHEMA');
    expect(db.resolve('cyberpunk/ad-screen/rich').variants.some((v) => v.id.startsWith('brand:caf'))).toBe(false);
  });

  it('reports a tier with no screen entry as E_KEY_NOT_FOUND', () => {
    const run = rebrand([{ brandName: 'Kiro', businessKind: 'commerce', tier: 'poor' }]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('E_KEY_NOT_FOUND');
  });
});
