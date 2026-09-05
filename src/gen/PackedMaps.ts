import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import type { Variant } from '../db/types.js';

interface PackedFile {
  path: string;
  png: Buffer;
  changed: boolean;
  resolution: [number, number];
}

/** One packed RGB file per source-map pair, shared by generation and catalog backfill. */
export class PackedMaps {
  constructor(private readonly themeDir: string) {}

  async apply(variants: Variant[]): Promise<{ variants: Variant[]; changed: string[] }> {
    const files = new Map<string, PackedFile>();
    const changed: string[] = [];
    const updated: Variant[] = [];
    for (const variant of variants) {
      const pair = JSON.stringify([variant.maps.roughness, variant.maps.metallic]);
      let file = files.get(pair);
      if (!file) {
        file = await this.prepare(variant, pair);
        files.set(pair, file);
      }
      if (file.resolution.some((size, axis) => size !== variant.resolution[axis])) {
        throw new MaterialsError('E_SCHEMA', `packed source dimensions differ from variant ${variant.id}`);
      }
      if (file.changed || variant.maps.metallicRoughness !== file.path) changed.push(variant.id);
      updated.push({ ...variant, maps: { ...variant.maps, metallicRoughness: file.path } });
    }
    // Every source is checked before publishing any packed file.
    for (const file of files.values()) if (file.changed) {
      const path = join(this.themeDir, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.png);
    }
    return { variants: updated, changed };
  }

  private async prepare(variant: Variant, pair: string): Promise<PackedFile> {
    try {
      const read = (path: string) => sharp(readFileSync(join(this.themeDir, path)))
        .extractChannel(0).raw().toBuffer({ resolveWithObject: true });
      const [roughness, metallic] = await Promise.all([read(variant.maps.roughness), read(variant.maps.metallic)]);
      const [width, height] = variant.resolution;
      for (const source of [roughness, metallic]) if (source.info.width !== width || source.info.height !== height) {
        throw new MaterialsError('E_SCHEMA', `packed source dimensions differ from variant ${variant.id}`);
      }
      const rgb = new Uint8Array(width * height * 3);
      for (let pixel = 0; pixel < width * height; pixel++) {
        rgb[pixel * 3] = 255;
        rgb[pixel * 3 + 1] = roughness.data[pixel];
        rgb[pixel * 3 + 2] = metallic.data[pixel];
      }
      const png = await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
      const id = createHash('sha256').update(pair).digest('hex');
      const path = join('assets', 'metallic-roughness', `${id}.png`);
      const absolute = join(this.themeDir, path);
      return { path, png, resolution: [width, height], changed: !existsSync(absolute) || !readFileSync(absolute).equals(png) };
    } catch (error) {
      if (error instanceof MaterialsError) throw error;
      throw new MaterialsError('E_SCHEMA', `cannot pack source maps for variant ${variant.id}`);
    }
  }
}
