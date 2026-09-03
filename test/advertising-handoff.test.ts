import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { Database } from '../src/db/Database.js';
import type { CreateRequest } from '../src/db/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requests = JSON.parse(readFileSync(join(root, 'batch/cyberpunk/ad-screen.json'), 'utf8')) as CreateRequest[];
const prompts = readFileSync(join(root, 'sources/ads-codex/PROMPTS.md'), 'utf8');

describe('advertising artwork handoff', () => {
  it('keeps every approved source, prompt and mapped screen within the restrained emission bounds', async () => {
    const db = new Database(join(root, 'themes'));
    const sources = new Set<string>();

    for (const request of requests) {
      const screen = request.screens![0];
      const source = screen.imagePath!;
      sources.add(source);
      expect(existsSync(join(root, source)), source).toBe(true);
      expect(prompts, source).toContain(`## ${source.split('/').at(-1)}`);

      const entry = db.resolve(request.key);
      const aspect = request.aspect ?? entry.aspect!;
      const sourceSize = await sharp(join(root, source)).metadata();
      const sourceRatio = sourceSize.width! / sourceSize.height!;
      expect(sourceRatio).toBeCloseTo(aspect[0] / aspect[1], 2);

      const variant = entry.variants.find((item) => item.id === request.variantId)!;
      expect(entry.alignment).toBe('exact');
      expect(entry.aspect).toEqual(aspect);
      expect(variant.resolution).toEqual(request.resolution);
      expect(variant.screen?.kind).toBe(screen.kind);
      expect(existsSync(join(db.themeDir('cyberpunk'), variant.screen!.artwork))).toBe(true);

      const { data } = await sharp(join(db.themeDir('cyberpunk'), variant.maps.emission!))
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const strength = entry.physical.emissiveStrength ?? 1;
      const clipped = data.filter((value) => (value / 255) * strength >= 0.99).length / data.length;
      const dark = data.filter((value) => value < 8).length / data.length;
      expect(clipped, `${request.key}:${request.variantId} clipped`).toBeLessThan(0.18);
      expect(dark, `${request.key}:${request.variantId} dark structure`).toBeGreaterThan(0.4);
    }

    expect([...sources].sort()).toEqual([
      'sources/ads-codex/ad-noir-amber-tall.png',
      'sources/ads-codex/ad-noir-amber-wide.png',
      'sources/ads-codex/ad-noir-cyan-red-tall.png',
      'sources/ads-codex/ad-noir-cyan-red-wide.png',
    ]);
  });
});
