import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import type { Finish, Physical } from '../db/types.js';
import { root } from './Template.js';
import { decodeRgb, type Rgb } from './pixels.js';

/** Imports the complete opaque surface; physical response is authored by the shared finish pipeline. */
export class ImageAlbedo {
  static assertTarget(alignment: string, physical: Physical, finish: Finish): void {
    if (alignment !== 'tile' || ![0, 1].includes(physical.metallicFactor ?? 0)
      || (physical.roughnessFactor ?? 1) < 0.45 || finish.roughness.some(value => value < 0.45)
      || (physical.transmission ?? 0) !== 0 || (physical.emissiveStrength ?? 0) !== 0
      || (physical.alphaMode ?? 'OPAQUE') !== 'OPAQUE') {
      throw new MaterialsError('E_SCHEMA', 'sourceAlbedo needs an opaque nonemissive tiled entry with dry matte response');
    }
  }

  static async load(path: string, width: number, height: number): Promise<Rgb> {
    try {
      const source = readFileSync(isAbsolute(path) ? path : join(root, path));
      const metadata = await sharp(source).metadata();
      const rotated = metadata.orientation !== undefined && metadata.orientation >= 5;
      const sourceWidth = (rotated ? metadata.height : metadata.width) ?? 0;
      const sourceHeight = (rotated ? metadata.width : metadata.height) ?? 0;
      if (sourceWidth < width || sourceHeight < height) {
        throw new MaterialsError('E_SCHEMA', 'sourceAlbedo must cover the requested resolution');
      }
      if (sourceWidth * height !== sourceHeight * width) {
        throw new MaterialsError('E_SCHEMA', 'sourceAlbedo and output must have the same image aspect');
      }
      if (metadata.hasAlpha && !(await sharp(source).stats()).isOpaque) {
        throw new MaterialsError('E_SCHEMA', 'sourceAlbedo pixels must be fully opaque');
      }
      return decodeRgb(await sharp(source).rotate().toColourspace('srgb').removeAlpha()
        .resize(width, height, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
        .png().toBuffer());
    } catch (error) {
      if (error instanceof MaterialsError) throw error;
      throw new MaterialsError('E_SCHEMA', `sourceAlbedo cannot be read: ${path}`);
    }
  }
}
