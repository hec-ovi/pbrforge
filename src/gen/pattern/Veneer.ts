import { clamp01, mixColor, scaleColor } from '../color.js';
import { Pattern, smoothstep, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

interface GrainPoint {
  across: number;
  along: number;
  width: number;
  length: number;
  pixelAcross: number;
  pixelAlong: number;
}

/** Continuous quarter-sawn veneer: fine fibres under a quiet, independent varnish. */
export class Veneer extends Pattern {
  protected texel(at: Point): Texel {
    const { colors, depth, grain, variation, sheen, roughness, wear, axis } = this.params;
    const point = this.orient(at);
    const fibres = this.field(point, 0.04, 0.65, 11);
    const grainField = this.structure(point);
    const tone = this.field(point, 0.14, 0.45, 73);
    const varnish = this.field(point, 0.045, 0.11, 181);
    const handling = smoothstep(0.58, 0.85, this.field(point, 0.2, 0.3, 223) + 0.5);
    const color = mixColor(colors[0], colors[1] ?? scaleColor(colors[0], 0.76),
      clamp01(0.35 + fibres * 0.5 + tone * variation));

    // Metric derivatives preserve the shallow pore response when map size changes.
    // depth=1 corresponds to at most 3 mm of raw surface structure, before finishing.
    const across = Math.max(point.pixelAcross, 0.0001);
    const along = Math.max(point.pixelAlong, 0.0001);
    const slopeAcross = (this.structure({ ...point, across: point.across + across / 2 }).height
      - this.structure({ ...point, across: point.across - across / 2 }).height) * depth * 0.003 / across;
    const slopeAlong = (this.structure({ ...point, along: point.along + along / 2 }).height
      - this.structure({ ...point, along: point.along - along / 2 }).height) * depth * 0.003 / along;
    const dx = axis === 'y' ? slopeAcross : slopeAlong;
    const dy = axis === 'y' ? slopeAlong : slopeAcross;
    return {
      color: scaleColor(color, 1 + grainField.tone * grain + tone * variation * 0.16
        - handling * wear * 0.045),
      height: clamp01(0.5 + grainField.height * depth),
      normal: [-dx, dy, 1],
      roughness: clamp01(roughness + varnish * sheen + handling * wear * 0.04),
    };
  }

  private orient(at: Point): GrainPoint {
    const { axis, world } = this.params;
    return axis === 'y'
      ? { across: at.x, along: at.y, width: world[0], length: world[1], pixelAcross: at.px, pixelAlong: at.py }
      : { across: at.y, along: at.x, width: world[1], length: world[0], pixelAcross: at.py, pixelAlong: at.px };
  }

  private structure(point: GrainPoint): { tone: number; height: number } {
    // The warp itself is periodic, so growth lines remain continuous at both tile edges.
    const bend = this.field(point, 0.09, 0.35, 31) * 0.009;
    const warped = { ...point, across: point.across + bend };
    const growth = this.field(warped, 0.015, 0.28, 43);
    const fibres = this.field(warped, 0.006, 0.09, 59);
    const pores = this.field(warped, 0.003, 0.04, 97);
    const vessels = smoothstep(0.06, 0.3, fibres * 0.35 + pores * 0.65);
    return {
      tone: growth * 0.3 + fibres * 0.65 + pores * 0.25 - vessels * 0.38,
      height: fibres * 0.18 + pores * 0.3 - vessels * 0.18,
    };
  }

  /** Centre unresolved noise at its mean instead of letting subpixel fibres glitter. */
  private field(point: GrainPoint, acrossMetres: number, alongMetres: number, offset: number): number {
    const nx = Math.max(1, Math.round(point.width / acrossMetres));
    const ny = Math.max(1, Math.round(point.length / alongMetres));
    const crossPitch = point.width / nx;
    const alongPitch = point.length / ny;
    const visible = (1 - smoothstep(crossPitch / 3, crossPitch, point.pixelAcross))
      * (1 - smoothstep(alongPitch / 3, alongPitch, point.pixelAlong));
    if (visible === 0) return 0;
    return (valueNoise(point.across / point.width, point.along / point.length, nx, ny,
      this.params.seed + offset) - 0.5) * visible;
  }
}
