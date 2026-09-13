import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { list, resolve } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

it('resolves the named variants in every published consumer binding', () => {
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
    const manifest = JSON.parse(readFileSync(join(root, 'bindings', `${name}.json`), 'utf8'));
    const schema = JSON.parse(readFileSync(join(root, 'schema', `${schemaName}.schema.json`), 'utf8'));
    const validate = new Ajv2020().compile(schema);
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    check(manifest);
  }
  expect(seen.size).toBeGreaterThan(0);
});

it('reports malformed keys, absent keys and missing themes through resolve', () => {
  expect(() => resolve('bad-key')).toThrowError(expect.objectContaining({ code: 'E_SCHEMA' }));
  expect(() => resolve('cyberpunk/absent/mid')).toThrowError(expect.objectContaining({ code: 'E_KEY_NOT_FOUND' }));
  expect(() => resolve('absent/material/mid')).toThrowError(expect.objectContaining({ code: 'E_THEME_NOT_FOUND' }));
});
