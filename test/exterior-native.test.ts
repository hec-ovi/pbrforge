import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { list, resolve } from '../src/index.js';
import manifest from '../sources/exterior-native/accepted.json';

const theme = new URL('../themes/cyberpunk/', import.meta.url);
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

it('resolves all accepted native finishes and exact counterparts with their original metadata and shared maps', () => {
  const keys = list({ theme: 'cyberpunk' });
  expect(manifest.finishes).toHaveLength(14);
  for (const finish of manifest.finishes) {
    const original = resolve(finish.key), exact = resolve(finish.exactKey);
    expect(keys).toContain(finish.key);
    expect(keys).toContain(finish.exactKey);
    expect(sha256(JSON.stringify(original)), finish.key).toBe(finish.entrySha256);
    expect(original.variants.map(variant => variant.id)).toEqual([finish.variantId]);
    expect(exact.alignment).toBe('exact');
    expect(exact.aspect).toEqual([1, 1]);
    expect(exact.tiling).toBeUndefined();
    expect(exact.physical).toEqual(original.physical);
    expect(exact.finish).toEqual(original.finish);
    expect(exact.variants).toEqual(original.variants);
    for (const entry of [original, exact]) {
      for (const alias of entry.aliases ?? []) expect(resolve(alias)).toEqual(entry);
      for (const variant of entry.variants) for (const path of Object.values(variant.maps)) expect(manifest.maps).toHaveProperty(path);
    }
  }
});

it('retains every accepted source byte and declared image channel layout', async () => {
  expect(Object.keys(manifest.maps)).toHaveLength(98);
  for (const [path, expected] of Object.entries(manifest.maps)) {
    const bytes = readFileSync(new URL(path, theme));
    expect(sha256(bytes), path).toBe(expected.sha256);
    const metadata = await sharp(bytes).metadata();
    expect([metadata.width, metadata.height], path).toEqual(expected.resolution);
    expect(metadata.channels, path).toBe(expected.channels);
  }
});
