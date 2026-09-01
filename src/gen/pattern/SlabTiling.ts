import { Pattern, type Point, type Texel, smoothstep } from './Pattern.js';
import { rectCell } from './grid.js';
import { hash2 } from './noise.js';

/**
 * Large flush slabs cut by a narrow groove: pavement and clean floors. The
 * ground falls into the joint as a notch rather than over a ledge, so the line
 * between two slabs stays thin, and each slab carries its own tone.
 */
export class SlabTiling extends Pattern {
  protected texel(at: Point): Texel {
    const { cells, world, bond, line, bevel, colors, seed } = this.params;
    const cell = rectCell(at, cells, world, bond);
    const aa = Math.max(at.px, at.py) / 2;
    const joint = this.line(cell.edge, line / 2, aa);
    const relief = smoothstep(0, line / 2 + bevel, cell.edge);
    return this.finish(colors[0], hash2(cell.idX, cell.idY, seed), joint, at, relief);
  }
}
