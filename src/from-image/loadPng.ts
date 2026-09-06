import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import { decodeRgb, type Rgb } from '../gen/pixels.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function resolveSource(path: string): string {
  if (isAbsolute(path) && existsSync(path)) return path;
  if (existsSync(path)) return path;
  const rooted = join(packageRoot, path);
  if (existsSync(rooted)) return rooted;
  throw new MaterialsError('E_SCHEMA', `from-image cannot find: ${path}`);
}

/** Opaque sRGB albedo. JPEG or PNG. Must already cover the output size. Downsample only. */
export async function loadPng(path: string, width: number, height: number): Promise<Rgb> {
  try {
    const file = readFileSync(resolveSource(path));
    const metadata = await sharp(file).metadata();
    const format = metadata.format;
    if (format !== 'jpeg' && format !== 'png') {
      throw new MaterialsError('E_SCHEMA', `from-image source must be jpeg or png, got ${format ?? 'unknown'}`);
    }
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
