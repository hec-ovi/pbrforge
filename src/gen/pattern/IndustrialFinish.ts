import { clamp01, mixColor, scaleColor } from '../color.js';
import { Pattern, smoothstep, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

/** Continuous manufactured surfaces; architectural seams belong to the fitted mesh. */
export class IndustrialFinish extends Pattern {
  protected texel(at: Point): Texel {
    const { colors, roughness, wear, sheen, grain, variation, kind } = this.params;
    const alloy = kind === 'brushed-metal';
    const field = this.field(at);
    const stepX = Math.max(at.px, 0.001);
    const stepY = Math.max(at.py, 0.001);
    const slopeX = (this.field({ ...at, x: at.x + stepX }).relief
      - this.field({ ...at, x: at.x - stepX }).relief) / (2 * stepX);
    const slopeY = (this.field({ ...at, y: at.y + stepY }).relief
      - this.field({ ...at, y: at.y - stepY }).relief) / (2 * stepY);
    // Oxide/dust has a dielectric response even over a conducting metal substrate.
    const oxidation = field.damage * wear;
    const face = scaleColor(colors[0], 1 + field.broad * variation
      + field.fine * grain - field.scuff * wear * 0.13);
    return {
      color: mixColor(face, colors[1] ?? colors[0], oxidation * 0.6),
      normal: [-slopeX, slopeY, 1],
      height: clamp01(0.5 + field.relief / 0.004),
      roughness: clamp01(roughness + field.gloss * sheen
        + oxidation * (alloy ? 0.25 : 0.12) - field.scuff * wear * 0.07),
      metallic: alloy ? 1 - oxidation : 0,
    };
  }

  private field(at: Point): { fine: number; broad: number; gloss: number; damage: number; scuff: number; relief: number } {
    const { world, seed, kind, axis, depth, wear } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const noise = (x: number, y: number, offset: number) => valueNoise(u, v,
      Math.max(1, Math.round(world[0] / x)), Math.max(1, Math.round(world[1] / y)), seed + offset);
    const oriented = (across: number, along: number, offset: number) => axis === 'x'
      ? noise(along, across, offset) : noise(across, along, offset);
    const alloy = kind === 'brushed-metal';
    // Resolve 4–8 mm brush or mould texture only while the map can represent it.
    const visibility = Math.min(1, 0.002 / Math.max(at.px, at.py));
    const fine = (alloy ? oriented(0.004, 0.22, 191) : noise(0.008, 0.008, 191)) - 0.5;
    const broad = noise(0.21, 0.21, 307) - 0.5;
    const gloss = noise(0.048, 0.06, 419) - 0.5;
    const scuff = smoothstep(0.72, 0.92, oriented(0.009, 0.075, 521))
      * smoothstep(0.56, 0.8, noise(0.19, 0.17, 631));
    const damage = smoothstep(0.53, 0.86, noise(0.13, 0.21, 743))
      * smoothstep(0.35, 0.78, noise(0.013, 0.025, 857));
    // Metres, independent of output resolution; wear never becomes raised rocky noise.
    const relief = depth * (fine * visibility * (alloy ? 0.0007 : 0.0005)
      - scuff * wear * 0.0008 - damage * wear * 0.00045);
    return { fine: fine * visibility, broad, gloss, damage, scuff, relief };
  }
}
