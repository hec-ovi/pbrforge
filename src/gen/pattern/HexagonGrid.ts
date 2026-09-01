import { Pattern, type Point, type Texel } from './Pattern.js';
import { mod, wrapInt } from './grid.js';
import { hash2 } from './noise.js';

const ROOT3 = Math.sqrt(3);

/**
 * A hexagonal grid: one column of hexagons is one lattice unit wide, one
 * staggered pair of rows is ROOT3 tall, so `cells` of [x, y] wraps exactly and
 * hexagons come out regular when x is about 1.73 times y.
 *
 * Every point belongs to whichever of the two staggered lattices its own centre
 * is nearer, which walks a hex grid without a search. With no joint darkening
 * and some sheen it reads as a printed wall: the pattern is only there in the
 * gloss, which is what makes it subtle instead of a drawn grid.
 */
export class HexagonGrid extends Pattern {
  protected texel(at: Point): Texel {
    const [nx, ny] = this.params.cells;
    const [width, height] = this.params.world;
    const qx = (at.x / width) * nx;
    const qy = (at.y / height) * ny * ROOT3;

    const oneX = mod(qx, 1) - 0.5;
    const oneY = mod(qy, ROOT3) - ROOT3 / 2;
    const twoX = mod(qx - 0.5, 1) - 0.5;
    const twoY = mod(qy - ROOT3 / 2, ROOT3) - ROOT3 / 2;
    const first = oneX * oneX + oneY * oneY < twoX * twoX + twoY * twoY;
    const localX = first ? oneX : twoX;
    const localY = first ? oneY : twoY;

    // distance from the hexagon boundary, in lattice units: 0 on an edge, 0.5 at the centre
    const ax = Math.abs(localX);
    const ay = Math.abs(localY);
    const edge = 0.5 - Math.max(ax * 0.5 + ay * (ROOT3 / 2), ax);

    // the centre's index on the doubled lattice, wrapped so a hexagon across the tile edge hashes once
    const idX = wrapInt(Math.round((qx - localX) * 2), nx * 2);
    const idY = wrapInt(Math.round(((qy - localY) * 2) / ROOT3), ny * 2);

    const unit = width / nx;
    const aa = Math.max(at.px, at.py) / 2;
    const joint = this.line(edge * unit, this.params.line / 2, aa);
    return this.finish(this.params.colors[0], hash2(idX, idY, this.params.seed), joint, at);
  }
}
