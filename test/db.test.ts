import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { list, resolve } from '../src/index.js';
import manifest from '../sources/exterior-native/accepted.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path));
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

it('resolves the bundled catalog and aliases with complete aligned map files', async () => {
  const keys = list();
  expect(keys.length).toBeGreaterThan(0);
  expect(keys).toEqual([...keys].sort());
  const sizes = new Map<string, [number | undefined, number | undefined]>();
  for (const key of keys) {
    const entry = resolve(key);
    for (const alias of entry.aliases ?? []) expect(resolve(alias)).toEqual(entry);
    expect(new Set(entry.variants.map(variant => variant.id)).size).toBe(entry.variants.length);
    for (const variant of entry.variants) {
      const maps = [...Object.values(variant.maps), ...(variant.screen ? [variant.screen.artwork] : [])];
      for (const map of maps) {
        const path = join(root, 'themes', key.split('/')[0], map);
        expect(existsSync(path), `${key}: ${map}`).toBe(true);
        if (!sizes.has(path)) {
          const metadata = await sharp(path).metadata();
          sizes.set(path, [metadata.width, metadata.height]);
        }
        expect(sizes.get(path), `${key}: ${map}`).toEqual(variant.resolution);
      }
    }
  }
}, 30_000);

it('validates every published consumer binding and resolves the references it names', async () => {
  const manifests = [
    ['exterior-styles', 'exterior-styles'], ['street-styles', 'street-styles'],
    ['street-markings', 'street-markings'], ['window-room-surfaces', 'window-room-surfaces'],
    ['atlas-hydrology', 'atlas-hydrology-bindings'],
  ];
  const seen = new Set<string>();
  function check(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const binding = value as Record<string, unknown>;
    const id = binding.variant ?? binding.variantId;
    if (typeof id === 'string') {
      const keys = typeof binding.key === 'string' ? [binding.key]
        : ['poor', 'mid', 'rich', 'high_rich'].map(tier => `cyberpunk/${binding.kind}/${tier}`);
      for (const key of keys) {
        if (seen.has(`${key}:${id}`)) continue;
        expect(resolve(key).variants.some(variant => variant.id === id), `${key}:${id}`).toBe(true);
        seen.add(`${key}:${id}`);
      }
    } else for (const child of Object.values(binding)) check(child);
  }
  for (const [name, schemaName] of manifests) {
    const binding = JSON.parse(read(`bindings/${name}.json`).toString());
    const validate = new Ajv2020().compile(JSON.parse(read(`schema/${schemaName}.schema.json`).toString()));
    expect(validate(binding), JSON.stringify(validate.errors)).toBe(true);
    check(binding);
  }
  expect(seen.size).toBeGreaterThan(0);

  const native = JSON.parse(read('bindings/street-native.json').toString());
  const validateNative = new Ajv2020({ strict: true })
    .compile(JSON.parse(read('schema/street-native.schema.json').toString()));
  expect(validateNative(native), JSON.stringify(validateNative.errors)).toBe(true);
  const provenance = JSON.parse(read(native.source.manifest).toString());
  expect(provenance.revision).toBe(native.source.revision);
  const authored = native.authored ? JSON.parse(read(native.authored.manifest).toString()).files : [];
  const sources = new Map([...provenance.files, ...authored].filter((file: { target?: string }) => file.target)
    .map((file: { target: string; sha256: string }) => [file.target, file.sha256]));
  const referenced = new Set<string>();
  for (const surface of Object.values(native.surfaces) as { maps: Record<string, string> }[]) {
    for (const id of Object.values(surface.maps)) {
      expect(native.textures[id], id).toBeDefined();
      referenced.add(id);
    }
  }
  expect([...referenced].sort()).toEqual(Object.keys(native.textures).sort());
  for (const [id, texture] of Object.entries(native.textures) as [string, { path: string; sha256: string; resolution: number[] }][]) {
    const bytes = read(texture.path);
    expect(sha256(bytes), id).toBe(texture.sha256);
    expect(sources.get(texture.path), id).toBe(texture.sha256);
    expect(join(root, texture.path).startsWith(root), id).toBe(true);
    const image = await sharp(bytes).metadata();
    expect([image.width, image.height], id).toEqual(texture.resolution);
  }
  expect(sources.size).toBe(Object.keys(native.textures).length);
});

it('binds the capped marquee run to catalog finishes at metre UVs and a lettered LED dot face', () => {
  const native = JSON.parse(read('bindings/street-native.json').toString());
  const path = (key: string, id: string, map: string) =>
    `themes/cyberpunk/${(resolve(key).variants.find(variant => variant.id === id)!.maps as Record<string, string>)[map]}`;
  const finishes: Record<string, [string, string]> = {
    'marquee-channel': ['cyberpunk/marquee-channel/rich', 'grimy'],
    'marquee-frame': ['cyberpunk/marquee-frame/rich', 'amber'],
    'marquee-cap': ['cyberpunk/exterior-graphite-concrete/mid', 'native'],
  };
  for (const id of ['marquee-channel', 'marquee-frame', 'marquee-lip', 'marquee-cap']) {
    const surface = native.surfaces[id];
    expect(surface.uv.mode, id).toBe('metres');
    for (const [slot, texture] of Object.entries(surface.maps) as [string, string][]) {
      expect(native.textures[texture].wrap, `${id}.${slot}`).toEqual(['repeat', 'repeat']);
      if (finishes[id]) expect(native.textures[texture].path, `${id}.${slot}`).toBe(path(...finishes[id], slot));
    }
  }
  const led = native.surfaces['marquee-led'];
  expect(led.effect).toBe('led-matrix');
  expect(led.uv).toEqual({ mode: 'metres', scale: [1, 1] });
  expect(native.textures[led.maps.glyphs].path).toBe(path('cyberpunk/letter-atlas/rich', 'panel', 'emission'));
  const { dotPitch, dotRadius, glyphBand, glyphAdvance } = led.parameters;
  expect(dotRadius).toBeLessThan(dotPitch / 2);
  expect(glyphBand[1] - glyphBand[0]).toBeGreaterThan(10 * dotPitch);
  expect(glyphAdvance).toBeGreaterThan(0);
});

it('retains every accepted exterior finish, its exact counterpart and the accepted source bytes', async () => {
  const keys = list({ theme: 'cyberpunk' });
  expect(manifest.finishes).toHaveLength(14);
  for (const finish of manifest.finishes) {
    const original = resolve(finish.key), exact = resolve(finish.exactKey);
    expect(keys).toContain(finish.key);
    expect(keys).toContain(finish.exactKey);
    const authored = { ...original, variants: original.variants.map(({ ktx2, ...variant }) => variant) };
    expect(sha256(JSON.stringify(authored)), finish.key).toBe(finish.entrySha256);
    expect(original.variants.map(variant => variant.id)).toEqual([finish.variantId]);
    expect(exact.alignment).toBe('exact');
    expect(exact.aspect).toEqual([1, 1]);
    expect(exact.tiling).toBeUndefined();
    expect(exact.physical).toEqual(original.physical);
    expect(exact.finish).toEqual(original.finish);
    expect(exact.variants).toEqual(original.variants);
  }
  expect(Object.keys(manifest.maps)).toHaveLength(98);
  for (const [path, expected] of Object.entries(manifest.maps)) {
    const bytes = read(join('themes/cyberpunk', path));
    expect(sha256(bytes), path).toBe(expected.sha256);
    const metadata = await sharp(bytes).metadata();
    expect([metadata.width, metadata.height], path).toEqual(expected.resolution);
    expect(metadata.channels, path).toBe(expected.channels);
  }
});

it('reports malformed keys, absent keys, missing themes and unreadable theme JSON', () => {
  expect(() => resolve('bad-key')).toThrowError(expect.objectContaining({ code: 'E_SCHEMA' }));
  expect(() => resolve('cyberpunk/absent/mid')).toThrowError(expect.objectContaining({ code: 'E_KEY_NOT_FOUND' }));
  expect(() => resolve('absent/material/mid')).toThrowError(expect.objectContaining({ code: 'E_THEME_NOT_FOUND' }));
  const themesDir = mkdtempSync(join(tmpdir(), 'materials-db-'));
  try {
    mkdirSync(join(themesDir, 'broken'));
    writeFileSync(join(themesDir, 'broken', 'theme.json'), '{');
    expect(() => list({ theme: 'broken' }, { themesDir })).toThrowError(expect.objectContaining({ code: 'E_SCHEMA' }));
  } finally {
    rmSync(themesDir, { recursive: true, force: true });
  }
});
