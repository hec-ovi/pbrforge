import { MaterialsError } from '../../db/errors.js';
import { mixColor, scaleColor } from '../color.js';
import { Pattern, type PatternParams, type Point, type Texel, smoothstep } from './Pattern.js';
import { mod } from './grid.js';

/** Four painted fixing heads per panel, placed by diameter and corner inset. */
export class Fixings extends Pattern {
  constructor(params: PatternParams) {
    super(params);
    if (params.line <= 0 || params.bevel <= params.line / 2
      || params.world.some((size, i) => size / params.cells[i] <= 2 * params.bevel + params.line)) {
      throw new MaterialsError('E_SCHEMA', 'fixings need positive heads and an inset that fits inside each panel');
    }
  }

  protected texel(at: Point): Texel {
    const { world, cells, line, bevel, colors, depth, roughness } = this.params;
    const width = world[0] / cells[0], height = world[1] / cells[1];
    const x = mod(at.x, width), y = mod(at.y, height);
    const dx = Math.min(Math.abs(x - bevel), Math.abs(x - width + bevel));
    const dy = Math.min(Math.abs(y - bevel), Math.abs(y - height + bevel));
    const radius = line / 2;
    const distance = Math.hypot(dx, dy);
    const aa = Math.max(at.px, at.py) / 2;
    const head = 1 - smoothstep(radius - aa, radius + aa, distance);
    const crown = 1 - smoothstep(radius * 0.58, radius, distance);
    const socket = 1 - smoothstep(radius * 0.2 - aa, radius * 0.2 + aa, distance);
    const base = this.finish(colors[0], 0.5, 0, at, 0.5);
    const mineral = (this.mottle(at) - 0.5) * this.params.grain;
    const fixing = mixColor(colors[1] ?? scaleColor(colors[0], 0.7), scaleColor(colors[0], 0.38), socket);
    return {
      color: mixColor(base.color, fixing, head),
      height: 0.5 + mineral + depth * head * (crown * 0.8 - socket * 0.35 - 0.2),
      roughness: roughness + mineral - head * 0.07 + socket * 0.12,
    };
  }
}
