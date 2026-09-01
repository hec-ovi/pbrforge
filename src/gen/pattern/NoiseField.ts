import { mixColor } from '../color.js';
import { Pattern, type Point, type Texel } from './Pattern.js';
import { fbmNoise } from './noise.js';

/**
 * Mottling between two colors over a wrapping lattice, in as many octaves as
 * the surface needs: one octave is the plain wall of the library, four is
 * asphalt, where the tonal patches and the aggregate under them are the same
 * field at different scales.
 */
export class NoiseField extends Pattern {
  protected texel(at: Point): Texel {
    const { cells, world, colors, octaves, seed } = this.params;
    const n = fbmNoise(at.x / world[0], at.y / world[1], cells[0], cells[1], octaves, seed);
    const face = mixColor(colors[0], colors[1] ?? colors[0], n);
    return this.finish(face, n, 0, at, n);
  }
}
