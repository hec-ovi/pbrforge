import { clamp01, scaleColor } from '../color.js';
import { PanelGrid } from './PanelGrid.js';
import { FractureField } from './FractureField.js';
import { smoothstep, type PatternParams, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

/** Mineral paving finish with isotropic wear, separate from its optional structural panel grid. */
export class PavingField extends PanelGrid {
  private readonly fractures: FractureField;

  constructor(params: PatternParams) {
    super(params);
    this.fractures = new FractureField(params.world, params.seed + 1701);
  }

  protected texel(at: Point): Texel {
    const { world, seed, wear, colors } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const field = this.params.line === 0
      ? this.finish(colors[0], 0.5, 0, at, 0.5)
      : super.texel(at);
    const noise = (metres: number, offset: number) => valueNoise(u, v,
      Math.max(1, Math.round(world[0] / metres)), Math.max(1, Math.round(world[1] / metres)), seed + offset);
    const mineral = noise(0.18, 131) - 0.5;
    const aggregate = noise(0.012, 227) - 0.5;
    const pores = smoothstep(0.76, 0.95, noise(0.02, 331));
    const stain = smoothstep(0.4, 0.85, noise(0.55, 433));
    const fracture = wear > 0.5 && this.params.line > 0
      ? this.fractures.sample(u, v, Math.max(at.px, at.py)) * wear : 0;
    return {
      color: scaleColor(field.color, 1 + mineral * 0.2 + aggregate * 0.075
        - pores * 0.07 - stain * wear * 0.22 - fracture * 0.28),
      height: clamp01(field.height + aggregate * 0.007 + mineral * 0.002
        - pores * 0.006 - fracture * 0.025),
      roughness: clamp01(field.roughness + mineral * 0.055 + stain * wear * 0.09),
    };
  }
}
