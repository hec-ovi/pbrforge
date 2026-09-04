import { clamp01, scaleColor } from '../color.js';
import { PanelGrid } from './PanelGrid.js';
import { smoothstep, type Point, type Texel } from './Pattern.js';
import { fbmNoise, valueNoise } from './noise.js';

/** Cast cement: mineral clouds, casting traces and sparse pores beneath structural joints. */
export class Concrete extends PanelGrid {
  protected texel(at: Point): Texel {
    const { world, seed, wear, colors } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const field = this.params.line === 0
      ? this.finish(colors[0], 0.5, 0, at, 0.5)
      : super.texel(at);
    const sampleField = (x: number, y: number, offset: number) => valueNoise(u, v, Math.max(1, Math.round(world[0] * x)), Math.max(1, Math.round(world[1] * y)), seed + offset);
    const mineral = fbmNoise(u, v, Math.max(1, Math.round(world[0] * 2.5)), Math.max(1, Math.round(world[1] * 2.5)), 3, seed + 71) - 0.5;
    const cast = sampleField(16, 1.5, 109) - 0.5;
    const pores = smoothstep(0.78, 0.97, sampleField(64, 64, 211));
    const staining = smoothstep(0.55, 0.85, sampleField(3.5, 1, 313));
    // Broad stains affect albedo. Only shallow surface structure affects normals.
    const tone = 1 + mineral * 0.42 + cast * wear * 0.32 - staining * wear * 0.22 - pores * (0.045 + wear * 0.025);
    return {
      color: scaleColor(field.color, tone),
      height: clamp01(field.height + mineral * 0.012 + cast * wear * 0.008 - pores * 0.004),
      roughness: clamp01(field.roughness + mineral * 0.045 + cast * wear * 0.025),
    };
  }
}
