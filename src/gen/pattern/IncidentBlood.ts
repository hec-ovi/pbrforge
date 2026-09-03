import { mixColor, scaleColor } from '../color.js';
import { Pattern, smoothstep, type Point, type Texel } from './Pattern.js';
import { fbmNoise } from './noise.js';

/**
 * A fitted incident pool with a broad source and a narrowing transfer in +X.
 * The shape stays inside the declared transparent inset, and the color under
 * transparent texels remains blood-toned so mipmaps cannot grow a black halo.
 */
export class IncidentBlood extends Pattern {
  protected texel(at: Point): Texel {
    const { colors, roughness, world, edgeInset, seed } = this.params;
    const innerWidth = world[0] - edgeInset * 2;
    const innerHeight = world[1] - edgeInset * 2;
    const u = (at.x - edgeInset) / innerWidth;
    const v = (at.y - edgeInset) / innerHeight;
    const aa = Math.max(at.px / innerWidth, at.py / innerHeight) * 1.5;

    const main = this.ellipse(u, v, 0.32, 0.53, 0.29, 0.31, aa, seed + 3);
    const bridge = this.ellipse(u, v, 0.53, 0.49, 0.23, 0.18, aa, seed + 7);
    const transfer = this.ellipse(u, v, 0.73, 0.43, 0.18, 0.085, aa, seed + 11);
    const tip = this.ellipse(u, v, 0.86, 0.39, 0.075, 0.038, aa, seed + 13);
    const shape = Math.max(main, bridge * 0.94, transfer * 0.82, tip * 0.62);

    const border = Math.min(at.x, world[0] - at.x, at.y, world[1] - at.y);
    const safe = smoothstep(edgeInset - Math.max(at.px, at.py), edgeInset, border);
    const opacity = shape * safe;
    const stainNoise = fbmNoise(u, v, 5, 4, 2, seed + 31);
    const dried = colors[1] ?? scaleColor(colors[0], 0.58);
    const color = mixColor(dried, colors[0], 0.55 + 0.35 * stainNoise);

    return {
      color,
      height: 0.5,
      roughness: roughness + (0.54 - roughness) * opacity,
      opacity,
    };
  }

  private ellipse(
    u: number,
    v: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    aa: number,
    seed: number,
  ): number {
    const angle = Math.atan2((v - cy) / ry, (u - cx) / rx);
    const irregular = 0.97 + 0.055 * Math.sin(angle * 5 + seed * 0.013) + 0.03 * Math.sin(angle * 9 - seed * 0.019);
    const radius = Math.hypot((u - cx) / rx, (v - cy) / ry) / irregular;
    return 1 - smoothstep(1 - aa, 1 + aa, radius);
  }
}
