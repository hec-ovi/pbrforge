import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import { root } from '../gen/Template.js';
import { decodeRgb, type Rgb } from '../gen/pixels.js';

/** Opaque sRGB albedo that already covers the output size. Downsample only. */
export async function loadPng(path: string, width: number, height: number): Promise<Rgb> {
  try {
    const file = readFileSync(isAbsolute(path) ? path : join(root, path));
    const metadata = await sharp(file).metadata();
    const rotated = metadata.orientation !== undefined && metadata.orientation >= 5;
    const sourceWidth = (rotated ? metadata.height : metadata.width) ?? 0;
    const sourceHeight = (rotated ? metadata.width : metadata.height) ?? 0;
    if (sourceWidth < width || sourceHeight < height) {
      throw new MaterialsError('E_SCHEMA', 'from-image source must cover the requested resolution');
    }
    if (sourceWidth * height !== sourceHeight * width) {
      throw new MaterialsError('E_SCHEMA', 'from-image source and output must have the same image aspect');
    }
    if (metadata.hasAlpha && !(await sharp(file).stats()).isOpaque) {
      throw new MaterialsError('E_SCHEMA', 'from-image pixels must be fully opaque');
    }
    return decodeRgb(await sharp(file).rotate().toColourspace('srgb').removeAlpha()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .png().toBuffer());
  } catch (error) {
    if (error instanceof MaterialsError) throw error;
    throw new MaterialsError('E_SCHEMA', `from-image cannot read: ${path}`);
  }
}
