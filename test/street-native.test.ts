import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const binding = JSON.parse(read('bindings/street-native.json').toString());
const schema = JSON.parse(read('schema/street-native.schema.json').toString());
const validate = new Ajv2020().compile(schema);

it('publishes complete native street effects with intact source scans and portable references', async () => {
  expect(validate(binding), JSON.stringify(validate.errors)).toBe(true);
  const provenance = JSON.parse(read(binding.source.manifest).toString());
  expect(provenance.revision).toBe(binding.source.revision);
  const sources = new Map(provenance.files.filter((f: { target?: string }) => f.target)
    .map((f: { target: string; sha256: string }) => [f.target, f.sha256]));
  const referenced = new Set<string>();
  for (const surface of Object.values(binding.surfaces) as { maps: Record<string, string> }[]) {
    for (const id of Object.values(surface.maps)) {
      expect(binding.textures[id], id).toBeDefined();
      referenced.add(id);
    }
  }
  expect([...referenced].sort()).toEqual(Object.keys(binding.textures).sort());
  for (const [id, texture] of Object.entries(binding.textures) as [string, { path: string; sha256: string; resolution: number[] }][]) {
    const bytes = read(texture.path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(hash, id).toBe(texture.sha256);
    expect(sources.get(texture.path), id).toBe(hash);
    const image = await sharp(bytes).metadata();
    expect([image.width, image.height], id).toEqual(texture.resolution);
    expect(fileURLToPath(new URL(texture.path, root)).startsWith(fileURLToPath(root))).toBe(true);
  }
  expect(sources.size).toBe(Object.keys(binding.textures).length);
});

it('rejects unsupported effects, missing channels and unsafe asset paths at the binding boundary', () => {
  for (const mutate of [
    (b: typeof binding) => { b.version = 2; },
    (b: typeof binding) => { b.surfaces.asphalt.effect = 'unknown'; },
    (b: typeof binding) => { delete b.surfaces.yellowPaint.maps.mask; },
    (b: typeof binding) => { b.textures['curb-basecolor'].path = '../scan.png'; },
    (b: typeof binding) => { b.surfaces.gutter.parameters.unrecognized = 1; },
  ]) {
    const invalid = structuredClone(binding);
    mutate(invalid);
    expect(validate(invalid)).toBe(false);
  }
});
