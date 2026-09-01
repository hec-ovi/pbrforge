import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { MaterialsError } from '../db/errors.js';
import type { ComfyClient } from './ComfyClient.js';
import { type Graph, loadGraph, root } from './Template.js';
import { type Rgb, decodeRgb } from './pixels.js';

// Injection point in templates/upscale-4x.json, by node id.
const N_IMAGE = '1';

/**
 * A provided artwork instead of a diffused one: read off disk, run through the
 * ComfyUI 4x upscale so a billboard-scale screen has real detail behind it, and
 * fitted to the screen it will be shown on. The upscale is a feed-forward model
 * with no sampling, so the same file always comes back the same picture.
 */
export class SourceImage {
  constructor(
    private comfy: ComfyClient,
    private graph: Graph = loadGraph('upscale-4x'),
  ) {}

  async load(path: string, width: number, height: number): Promise<Rgb> {
    const file = isAbsolute(path) ? path : join(root, path);
    if (!existsSync(file)) {
      throw new MaterialsError('E_SCHEMA', `screens[].imagePath does not exist: ${path}`);
    }
    const name = await this.comfy.upload(readFileSync(file), path.replace(/[^a-zA-Z0-9._-]/g, '-'));
    const graph = structuredClone(this.graph);
    graph[N_IMAGE].inputs.image = name;
    const upscaled = await this.comfy.render(graph);
    // the source is 4x larger than the screen asks for, so the fit is a downsample: detail, not blur
    const fitted = await sharp(upscaled)
      .resize(width, height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    return decodeRgb(fitted);
  }
}
