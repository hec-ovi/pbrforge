import { clamp01, mixColor, scaleColor } from '../color.js';
import { Pattern, smoothstep, type PatternParams, type Point, type Texel } from './Pattern.js';
import { FractureField } from './FractureField.js';
import { valueNoise } from './noise.js';

/** Aggregate and binder keep separate physical scales from weathering and reflection fields. */
export class AggregateField extends Pattern {
  private readonly fractures: FractureField;

  constructor(params: PatternParams) {
    super(params);
    this.fractures = new FractureField(params.world, params.seed + 701);
  }

  protected texel(at: Point): Texel {
    const { world, seed, colors, depth, grain, wear, wet, sheen, roughness } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const noise = (metres: number, offset: number) => valueNoise(u, v,
      Math.max(1, Math.round(world[0] / metres)), Math.max(1, Math.round(world[1] / metres)), seed + offset);
    const binder = noise(0.16, 11);
    const stones = noise(0.008, 17);
    const pores = smoothstep(0.73, 0.94, noise(0.012, 23));
    const patches = noise(0.7, 31);
    const damp = smoothstep(1 - wet * 0.85, 1 - wet * 0.3, noise(0.5, 41));
    const fracture = wear > 0.3 ? this.fractures.sample(u, v, Math.max(at.px, at.py)) * wear : 0;
    const grainVisibility = Math.min(1, 0.004 / Math.max(at.px, at.py));
    const face = mixColor(colors[0], colors[1], smoothstep(0.22, 0.8, stones));
    const dryRoughness = clamp01(roughness + (patches - 0.5) * sheen * 2 + fracture * 0.06);
    return {
      color: scaleColor(face, (0.92 + binder * 0.16 + (patches - 0.5) * wear * 0.5)
        * (1 - pores * grain * grainVisibility - fracture * 0.48 - damp * 0.16)),
      height: clamp01(0.5 + (stones - 0.5) * depth * grainVisibility
        - pores * depth * 0.2 - fracture * depth * 0.65),
      roughness: dryRoughness + (Math.min(dryRoughness, 0.5) - dryRoughness) * damp,
    };
  }
}
