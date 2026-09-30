import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import type { CreateRequest, Physical } from '../db/types.js';
import { MaterialsError } from '../db/errors.js';
import { root } from './Template.js';
import { type Gray, type Rgb } from './pixels.js';
import { isSeamless, seamScore } from './seam.js';

/** Prepared scalar channels never pass through a color-space transform. */
export class PreparedMaps {
  static async load(paths: NonNullable<CreateRequest['sourceMaps']>, width: number, height: number,
    alignment: string, physical: Physical): Promise<{
      basecolor: Rgb; normal: Rgb; roughness: Gray; metallic: Gray; height: Gray; ao: Gray; opacity?: Gray;
    }> {
    const maps: Record<string, Rgb | Gray> = {};
    for (const [channel, path] of Object.entries(paths)) {
      const input = readFileSync(isAbsolute(path) ? path : join(root, path));
      const meta = await sharp(input).metadata();
      if (meta.width !== width || meta.height !== height || meta.format !== 'png' || (meta.orientation ?? 1) !== 1) {
        throw new MaterialsError('E_SCHEMA', `prepared ${channel} must be an unrotated ${width}x${height} PNG`);
      }
      if (meta.hasAlpha && !(await sharp(input).stats()).isOpaque) {
        throw new MaterialsError('E_SCHEMA', `prepared ${channel} must be opaque; provide coverage in opacity`);
      }
      const data = new Uint8Array(await sharp(input).removeAlpha().toColourspace('srgb').raw().toBuffer());
      const rgb = { data, width, height };
      if (alignment === 'tile' && !isSeamless(rgb)) {
        throw new MaterialsError('E_SEAM_CHECK_FAILED', `prepared ${channel} has a visible seam`, seamScore(rgb));
      }
      if (channel === 'basecolor' || channel === 'normal') {
        maps[channel] = rgb;
      } else {
        const scalar = new Float32Array(width * height);
        for (let i = 0; i < scalar.length; i++) {
          if (data[i * 3] !== data[i * 3 + 1] || data[i * 3] !== data[i * 3 + 2]) {
            throw new MaterialsError('E_SCHEMA', `prepared ${channel} must be grayscale`);
          }
          scalar[i] = data[i * 3] / 255;
        }
        maps[channel] = { data: scalar, width, height };
      }
    }
    if (paths.opacity && physical.alphaMode !== 'BLEND' && physical.alphaMode !== 'MASK') {
      throw new MaterialsError('E_SCHEMA', 'prepared opacity needs alphaMode BLEND or MASK');
    }
    return maps as Awaited<ReturnType<typeof PreparedMaps.load>>;
  }
}
