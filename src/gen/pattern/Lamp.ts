import { type Color, clamp01, mixColor } from '../color.js';
import { Pattern, type Point, type Texel, smoothstep } from './Pattern.js';

/** The hot centre when no third color states one: the lens colour driven to white. */
const WHITE: Color = { r: 1, g: 1, b: 1 };

/**
 * One luminaire per tile: a dark housing bezel around a recessed lens with a
 * hot centre, so a fixture face that spans one tile reads as a lamp and not as
 * a lit card. `line` is the bezel width and `bevel` the chamfer from the bezel
 * down to the lens, both in metres; `split` is how far the hot centre reaches
 * across the lens, 0 a flat diffuser and 1 a glow that fades to the rim.
 * Colors: the lens at its rim, the housing, and the hot centre.
 */
export class Lamp extends Pattern {
  protected texel(at: Point): Texel {
    const { world, colors, line, bevel, split, depth, roughness } = this.params;
    // distance from the tile edge along the shorter direction: the bezel is a band around it
    const inset = Math.min(at.x, world[0] - at.x, at.y, world[1] - at.y);
    const aa = Math.max(at.px, at.py) / 2;
    const bezel = 1 - smoothstep(line - aa, line + aa, inset);
    const chamfer = smoothstep(line, line + Math.max(bevel, 2 * aa), inset);

    // the lens centre in lens units: 0 at the middle, 1 at the bezel
    const lensX = (at.x - world[0] / 2) / (world[0] / 2 - line);
    const lensY = (at.y - world[1] / 2) / (world[1] / 2 - line);
    const radius = Math.hypot(lensX, lensY);
    const hot = split === 0 ? 0 : 1 - smoothstep(0, split, radius);

    const lens = mixColor(colors[0], colors[2] ?? WHITE, hot);
    const housing = colors[1] ?? colors[0];
    return {
      color: mixColor(lens, housing, bezel),
      height: clamp01(0.5 + depth * (0.5 - chamfer)),
      roughness: clamp01(roughness - (1 - bezel) * 0.15),
    };
  }
}
