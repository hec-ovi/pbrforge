import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MaterialsError } from '../db/errors.js';

/** The box folder: templates, prompts and provided source images are all named relative to it. */
export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/** A workflow from templates/, in ComfyUI API format, ready to have its params injected. */
export function loadGraph(name: string): Graph {
  return JSON.parse(readFileSync(join(root, 'templates', `${name}.json`), 'utf8')) as Graph;
}

// Injection points in templates/sdxl-tile.json, by node id.
const N_POSITIVE = '3';
const N_NEGATIVE = '4';
const N_LATENT = '5';
const N_SAMPLER = '6';

export interface TileJob {
  positive: string;
  negative: string;
  seed: number;
  width: number;
  height: number;
}

export class Template {
  private graph: Graph;

  constructor(name = 'sdxl-tile') {
    this.graph = loadGraph(name);
  }

  build(job: TileJob): Graph {
    const graph = structuredClone(this.graph);
    try {
      graph[N_POSITIVE].inputs.text = job.positive;
      graph[N_NEGATIVE].inputs.text = job.negative;
      graph[N_LATENT].inputs.width = job.width;
      graph[N_LATENT].inputs.height = job.height;
      graph[N_SAMPLER].inputs.seed = job.seed;
    } catch (cause) {
      throw new MaterialsError('E_SCHEMA', 'template is valid JSON but missing the expected nodes', cause);
    }
    return graph;
  }
}

export function loadPrompt(name: string): string {
  return readFileSync(join(root, 'prompts', `${name}.md`), 'utf8').trim();
}
