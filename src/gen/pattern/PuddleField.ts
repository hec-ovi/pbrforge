import { mixColor, scaleColor } from '../color.js';
import { NoiseField } from './NoiseField.js';
import { smoothstep, type Point, type Texel } from './Pattern.js';
import { fbmNoise } from './noise.js';

/** Still water is a mirror: this is the roughness the environment reflects off. */
const MIRROR = 0.04;
/** Water finds one level, so every texel under it stands at the same height: a flat normal, an unbroken reflection. */
const WATER_LEVEL = 0.42;
/** How wide the rim is, in mask units: a puddle edge is crisp but not aliased. */
const RIM = 0.06;

/**
 * Asphalt with standing water: the dry road of a noise field, and over it a
 * mask of pooled patches where the surface goes flat, mirror-smooth and dark.
 * The mask is two octaves of the same wrapping lattice, so the puddles tile
 * with the road they sit in and the same parameters draw them the same way.
 */
export class PuddleField extends NoiseField {
  protected texel(at: Point): Texel {
    const dry = super.texel(at);
    const cover = this.cover(at);
    if (cover === 0) return dry;
    const { colors } = this.params;
    // wet asphalt darkens; a third color states the water's own tone instead
    const water = colors[2] ?? scaleColor(colors[0], 0.55);
    return {
      color: mixColor(dry.color, water, cover),
      height: dry.height + (WATER_LEVEL - dry.height) * cover,
      roughness: dry.roughness + (MIRROR - dry.roughness) * cover,
    };
  }

  /**
   * How deep under water a point is, 0 on dry road to 1 in open water. Puddles
   * are metre-scale, so the mask runs at half the aggregate's lattice, and `wet`
   * moves the waterline: 0 leaves the road dry, 0.5 floods about half of it.
   */
  private cover(at: Point): number {
    const { cells, world, wet, seed } = this.params;
    if (wet === 0) return 0;
    const pools: [number, number] = [Math.max(2, cells[0] >> 1), Math.max(2, cells[1] >> 1)];
    const n = fbmNoise(at.x / world[0], at.y / world[1], pools[0], pools[1], 2, seed + 31);
    const waterline = 0.5 + (0.5 - wet) * 0.9;
    return smoothstep(waterline, waterline + RIM, n);
  }
}
