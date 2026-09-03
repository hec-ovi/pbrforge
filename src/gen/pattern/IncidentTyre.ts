import { mixColor } from '../color.js';
import { Pattern, smoothstep, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

/**
 * One fitted rubber transfer: three related tread ribs following the same
 * shallow curve, faint at the approach and dense toward the impact end.
 */
export class IncidentTyre extends Pattern {
  protected texel(at: Point): Texel {
    const { colors, roughness, world, edgeInset, seed } = this.params;
    const innerWidth = world[0] - edgeInset * 2;
    const innerHeight = world[1] - edgeInset * 2;
    const u = (at.x - edgeInset) / innerWidth;
    const v = (at.y - edgeInset) / innerHeight;
    const aa = Math.max(at.px / innerWidth, at.py / innerHeight) * 1.5;

    const centre = 0.64 - 0.24 * u + 0.025 * Math.sin(Math.PI * u);
    const halfRib = 0.024;
    let tread = 0;
    for (const offset of [-0.075, 0, 0.075]) {
      tread = Math.max(tread, 1 - smoothstep(halfRib - aa, halfRib + aa, Math.abs(v - centre - offset)));
    }

    const approach = smoothstep(0.04, 0.17, u);
    const stop = 1 - smoothstep(0.88, 0.98, u);
    const direction = 0.3 + 0.7 * smoothstep(0.12, 0.82, u);
    const treadTransfer = 0.72 + 0.28 * valueNoise(u, v, 18, 3, seed + 17);
    const border = Math.min(at.x, world[0] - at.x, at.y, world[1] - at.y);
    const safe = smoothstep(edgeInset - Math.max(at.px, at.py), edgeInset, border);
    const opacity = tread * approach * stop * direction * treadTransfer * safe;

    const rubber = colors[1] ?? colors[0];
    const color = mixColor(rubber, colors[0], 0.45 + 0.35 * valueNoise(u, v, 9, 2, seed + 29));
    return { color, height: 0.5, roughness, opacity };
  }
}
