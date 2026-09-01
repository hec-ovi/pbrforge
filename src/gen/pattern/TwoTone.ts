import { mixColor } from '../color.js';
import { Pattern, type Point, type Texel } from './Pattern.js';
import { hash2 } from './noise.js';

/**
 * Color blocking: the tile split once across its axis, the first color below
 * the split and the second above it, with a line at both boundaries. Given a
 * third color that line is a painted trim; without one it reads as the joint
 * between two materials.
 */
export class TwoTone extends Pattern {
  protected texel(at: Point): Texel {
    const { world, axis, split, line, colors, seed } = this.params;
    const t = axis === 'x' ? at.x / world[0] : at.y / world[1];
    const span = axis === 'x' ? world[0] : world[1];
    const lower = t < split;

    const distance = Math.min(Math.abs(t - split), t, 1 - t) * span;
    const aa = Math.max(at.px, at.py) / 2;
    const cover = this.line(distance, line / 2, aa);
    const face = lower ? colors[0] : (colors[1] ?? colors[0]);
    const trim = colors[2];
    const cell = hash2(lower ? 0 : 1, 0, seed);
    return trim
      ? this.finish(mixColor(face, trim, cover), cell, 0, at)
      : this.finish(face, cell, cover, at);
  }
}
