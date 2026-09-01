import type { PatternKind } from '../../db/types.js';
import { type Color, clamp01, scaleColor } from '../color.js';
import { valueNoise } from './noise.js';

/** A pattern with every parameter resolved: what the classes actually read. */
export interface PatternParams {
  kind: PatternKind;
  colors: Color[];
  cells: [number, number];
  /** Joint or edge line width, in metres. */
  line: number;
  /** Chamfer width beside a joint, in metres. */
  bevel: number;
  /** Relief between a face and a joint, 0 to 1 of the height range. */
  depth: number;
  /** How much darker and rougher a joint reads than the face it cuts. */
  joint: number;
  /** How much one cell's tone differs from the next. */
  variation: number;
  /** How much one cell's gloss differs from the next: a printed pattern, no relief. */
  sheen: number;
  /** Fine tonal mottling over everything. */
  grain: number;
  /** How many octaves of noise a noise field carries: one is a plain wall, four is asphalt. */
  octaves: number;
  /** How much of a puddle field stands under water: 0 is a dry road. */
  wet: number;
  bond: 'stack' | 'running';
  axis: 'x' | 'y';
  /** Where the band boundary sits, as a fraction of the tile. */
  split: number;
  /** The roughness the finish sits around: the entry's own factor. */
  roughness: number;
  /** Metres covered by one tile. */
  world: [number, number];
  seed: number;
}

/** One texel of a pattern: surface color, height and roughness. */
export interface Texel {
  color: Color;
  height: number;
  roughness: number;
}

/** A point on the surface, in metres, with the size of one pixel for anti-aliasing. */
export interface Point {
  x: number;
  y: number;
  px: number;
  py: number;
}

/** Fine mottling runs on a fixed lattice, so grain reads the same at any map size. */
const GRAIN_CELLS = 64;

/**
 * A surface drawn as arithmetic on where a point is, in metres: crisp at any
 * map size, anti-aliased against the pixel it is sampled for, and periodic over
 * one tile by construction, so nothing has to be cut to make it wrap.
 */
export abstract class Pattern {
  constructor(protected readonly params: PatternParams) {}

  /** Samples one texel. Coordinates wrap into one tile here, which is what makes every pattern tileable. */
  sample(u: number, v: number, du: number, dv: number): Texel {
    const [width, height] = this.params.world;
    return this.texel({
      x: (u - Math.floor(u)) * width,
      y: (v - Math.floor(v)) * height,
      px: du * width,
      py: dv * height,
    });
  }

  protected abstract texel(at: Point): Texel;

  /**
   * The finish over the pattern: the cell's own tone, the joint darkening and
   * roughening where it cuts, the gloss spread of a printed pattern, and grain.
   * `relief` is how high the point stands, 1 on a face and 0 at the bottom of a
   * joint; a chamfer passes its own ramp instead of the joint coverage.
   */
  protected finish(face: Color, cell: number, joint: number, at: Point, relief = 1 - joint): Texel {
    const { params } = this;
    const spread = (cell - 0.5) * 2;
    const grain = params.grain === 0 ? 0 : (this.mottle(at) - 0.5) * 2 * params.grain;
    const color = scaleColor(face, (1 + spread * params.variation + grain) * (1 - joint * params.joint));
    return {
      color,
      height: clamp01(0.5 + params.depth * (relief - 0.5)),
      roughness: clamp01(params.roughness + spread * params.sheen + joint * params.joint * 0.4),
    };
  }

  /** Fine tonal noise, in tile space so it wraps with everything else. */
  protected mottle(at: Point): number {
    const [width, height] = this.params.world;
    return valueNoise(at.x / width, at.y / height, GRAIN_CELLS, GRAIN_CELLS, this.params.seed + 7);
  }

  /** Coverage of a line of the given half width at a signed distance, anti-aliased over one pixel. */
  protected line(distance: number, halfWidth: number, aa: number): number {
    return 1 - smoothstep(halfWidth - aa, halfWidth + aa, Math.abs(distance));
  }
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
