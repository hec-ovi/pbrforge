import { Pattern, smoothstep, type Point, type Texel } from './Pattern.js';
import { valueNoise } from './noise.js';

/** Translucent mineral runoff on one fitted wall receiver, with clear edges. */
export class WindowGrime extends Pattern {
  protected texel(at: Point): Texel {
    const { world, seed, edgeInset, colors, roughness, wear } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const edge = Math.min(at.x, at.y, world[0] - at.x, world[1] - at.y);
    const border = smoothstep(edgeInset, edgeInset + 0.06, edge);
    const streak = valueNoise(u, v, Math.max(4, Math.round(world[0] * 18)), 2, seed);
    const clouds = valueNoise(u, v, 7, 5, seed + 19);
    const runoff = Math.exp(-v * (2.8 + clouds * 2)) * (0.25 + streak * 0.75);
    return { color: colors[0], height: 0.5, roughness, opacity: border * runoff * wear * 0.3 };
  }
}
