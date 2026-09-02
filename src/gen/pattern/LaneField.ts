import { scaleColor } from '../color.js';
import { NoiseField } from './NoiseField.js';
import { smoothstep, type Point, type Texel } from './Pattern.js';
import { fbmNoise } from './noise.js';

/** The roughness a worn, damp wheel track settles at: a soft lamp reflection. */
export const DAMP = 0.5;

/**
 * Asphalt of a noise field with the wear of traffic on it: two wheel tracks
 * along the lane, darker and damper than the road between them, their edges
 * soft and their depth uneven along the run. The tile is one lane wide, so a
 * consumer that lays U across the lane puts the tracks under the wheels.
 */
export class LaneField extends NoiseField {
  protected texel(at: Point): Texel {
    const dry = super.texel(at);
    const cover = this.track(at) * this.params.wear;
    if (cover === 0) return dry;
    return {
      color: scaleColor(dry.color, 1 - cover * 0.35),
      height: dry.height,
      roughness: dry.roughness + (DAMP - dry.roughness) * cover,
    };
  }

  /**
   * How far inside a wheel track a point is, 0 on clean road to 1 at the
   * centre of the track. `split` is the spacing of the two tracks across the
   * lane as a fraction of the tile's width, `line` is the width of one track in
   * metres, and the wear along the run breathes with the lane's own lattice.
   */
  private track(at: Point): number {
    const { world, cells, axis, split, line, seed } = this.params;
    const across = axis === 'y' ? at.x : at.y;
    const along = axis === 'y' ? at.y : at.x;
    const span = axis === 'y' ? world[0] : world[1];
    const run = axis === 'y' ? world[1] : world[0];
    const runCells = axis === 'y' ? cells[1] : cells[0];
    const offset = (split * span) / 2;
    const distance = Math.min(Math.abs(across - span / 2 + offset), Math.abs(across - span / 2 - offset));
    const half = line / 2;
    const core = 1 - smoothstep(half * 0.4, half, distance);
    const breath = fbmNoise(along / run, 0.5, Math.max(2, runCells >> 1), 1, 1, seed + 53);
    return core * (0.65 + 0.35 * breath);
  }
}
