import { clamp01, scaleColor } from '../color.js';
import { FractureField } from './FractureField.js';
import { Pattern, smoothstep, type PatternParams, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

/** Continuous paving mineral: local aggregate and pores, independent smooth roughness. */
export class MineralFinish extends Pattern {
  private readonly fractures: FractureField;

  constructor(params: PatternParams) {
    super(params);
    this.fractures = new FractureField(params.world, params.seed + 1301);
  }

  protected texel(at: Point): Texel {
    const { world, seed, colors, depth, grain, variation, wear, sheen, roughness } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const noise = (metres: number, offset: number) => valueNoise(u, v,
      Math.max(1, Math.round(world[0] / metres)), Math.max(1, Math.round(world[1] / metres)), seed + offset);
    const visible = Math.min(1, 0.003 / Math.max(at.px, at.py));
    const aggregate = (noise(0.006, 113) * 0.7 + noise(0.011, 227) * 0.3 - 0.5) * visible;
    const binder = noise(0.055, 331) - 0.5;
    const pores = smoothstep(0.7, 0.94, noise(0.009, 443)) * visible;
    const weathering = smoothstep(0.61, 0.88, noise(0.11, 557))
      * smoothstep(0.45, 0.85, noise(0.022, 661));
    const fracture = wear > 0.5
      ? this.fractures.sample(u, v, Math.max(at.px, at.py))
        * smoothstep(0.5, 0.85, noise(0.22, 773)) * wear : 0;
    return {
      color: scaleColor(colors[0], 1 + aggregate * grain * 2 + binder * variation
        - pores * 0.12 - weathering * wear * 0.25 - fracture * 0.32),
      height: clamp01(0.5 + aggregate * depth * 0.5 - pores * depth * 0.4 - fracture * depth),
      roughness: clamp01(roughness + (noise(0.14, 887) - 0.5) * sheen
        + weathering * wear * 0.07),
    };
  }
}
