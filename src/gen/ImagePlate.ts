import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import type { MapName, Physical } from '../db/types.js';
import { root } from './Template.js';
import { constantGray, flatNormal } from './maps.js';
import { decodeRgb, encodeGrayPng, encodeRgbPng, type Rgb } from './pixels.js';

/** Baked room imagery keeps its light and texture without deriving surface relief. */
export class ImagePlate {
  static async load(path: string, width: number, height: number): Promise<Rgb> {
    try {
      const source = readFileSync(isAbsolute(path) ? path : join(root, path));
      const metadata = await sharp(source).metadata();
      const rotated = metadata.orientation !== undefined && metadata.orientation >= 5;
      const sourceWidth = (rotated ? metadata.height : metadata.width) ?? 0;
      const sourceHeight = (rotated ? metadata.width : metadata.height) ?? 0;
      if (sourceWidth < width || sourceHeight < height) {
        throw new MaterialsError('E_SCHEMA', 'sourceImage must cover the requested resolution');
      }
      return decodeRgb(await sharp(source).rotate()
        .resize(width, height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
        .flatten({ background: '#000000' }).toColourspace('srgb').png().toBuffer());
    } catch (error) {
      if (error instanceof MaterialsError) throw error;
      throw new MaterialsError('E_SCHEMA', `sourceImage cannot be read: ${path}`);
    }
  }

  static async maps(image: Rgb, physical: Physical): Promise<[MapName, Buffer][]> {
    return [
      ['normal', await encodeRgbPng(flatNormal(image))],
      ['roughness', await encodeGrayPng(constantGray(image, physical.roughnessFactor ?? 1))],
      ['metallic', await encodeGrayPng(constantGray(image, physical.metallicFactor ?? 0))],
      ['height', await encodeGrayPng(constantGray(image, 0.5))],
      ['ao', await encodeGrayPng(constantGray(image, 1))],
      ['emission', await encodeRgbPng(image)],
    ];
  }
}
