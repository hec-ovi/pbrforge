import { Pattern, type Point, type Texel, smoothstep } from './Pattern.js';
import { rectCell } from './grid.js';
import { hash2 } from './noise.js';

/**
 * Inset panels: a raised face, a chamfer down its edge, and a flat recess where
 * two panels meet. One panel per cell, so a tile of one cell puts the joint on
 * the tile boundary and whole-tile faces keep their seams aligned.
 */
export class PanelGrid extends Pattern {
  protected texel(at: Point): Texel {
    const { cells, world, bond, line, bevel, colors, seed } = this.params;
    const cell = rectCell(at, cells, world, bond);
    const aa = Math.max(at.px, at.py) / 2;
    const half = line / 2;
    const joint = this.line(cell.edge, half, aa);
    const relief = smoothstep(half - aa, half + Math.max(bevel, 2 * aa), cell.edge);
    return this.finish(colors[0], hash2(cell.idX, cell.idY, seed), joint, at, relief);
  }
}
