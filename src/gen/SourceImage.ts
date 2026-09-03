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
 * fitted to the screen it will be shown on. Sources that already cover the target
 * resolution stay local. Smaller sources use the deterministic ComfyUI 4x upscale.
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
    const source = readFileSync(file);
    const metadata = await sharp(source).metadata();
    let prepared: Buffer<ArrayBufferLike> = source;
    if ((metadata.width ?? 0) < width || (metadata.height ?? 0) < height) {
      const name = await this.comfy.upload(source, path.replace(/[^a-zA-Z0-9._-]/g, '-'));
      const graph = structuredClone(this.graph);
      graph[N_IMAGE].inputs.image = name;
      prepared = await this.comfy.render(graph);
    }
    const fitted = await sharp(prepared)
      .resize(width, height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    return decodeRgb(fitted);
  }
}
