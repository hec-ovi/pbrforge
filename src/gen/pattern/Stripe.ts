import { Pattern, type Point, type Texel } from './Pattern.js';
import { mod, wrapInt } from './grid.js';
import { hash2 } from './noise.js';

/**
 * Bands across the surface: `cells` on the chosen axis, `split` of each band in
 * the first color and the rest in the second, with a joint line at every
 * boundary. Any band count wraps, since the color comes from the position
 * inside a band and not from the band's parity.
 */
export class Stripe extends Pattern {
  protected texel(at: Point): Texel {
    const { cells, world, axis, split, line, colors, seed } = this.params;
    const along = axis === 'x' ? cells[0] : cells[1];
    const span = (axis === 'x' ? world[0] : world[1]) / along;
    const t = (axis === 'x' ? at.x / world[0] : at.y / world[1]) * along;
    const inside = mod(t, 1);

    const face = inside < split ? colors[0] : (colors[1] ?? colors[0]);
    const distance = Math.min(inside, Math.abs(split - inside), 1 - inside) * span;
    const aa = Math.max(at.px, at.py) / 2;
    const joint = this.line(distance, line / 2, aa);
    const band = wrapInt(Math.floor(t), along) * 2 + (inside < split ? 0 : 1);
    return this.finish(face, hash2(band, 0, seed), joint, at);
  }
}
