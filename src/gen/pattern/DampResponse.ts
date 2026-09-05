import type { SurfaceResponse } from '../../db/types.js';
import { smoothstep } from './Pattern.js';
import { valueNoise } from './noise.js';
import type { PatternMaps } from './render.js';

/** One periodic mask coordinates local darkening, smoothness and reduced mineral relief. */
export class DampResponse {
  constructor(
    private readonly response: SurfaceResponse,
    private readonly world: [number, number],
    private readonly seed: number,
  ) {}

  apply(maps: PatternMaps): PatternMaps {
    const { width, height } = maps.basecolor;
    const field = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      field[y * width + x] = this.field((x + 0.5) / width, (y + 0.5) / height);
    }
    // Rank at the actual output resolution. All smooth-transition texels count toward support.
    const ranked = field.slice().sort();
    const count = field.length;
    const support = Math.floor(count * this.response.coverage);
    const edge = ranked[count - support - 1];
    const core = ranked[count - Math.max(1, Math.floor(support * 0.4))];
    for (let i = 0; i < count; i++) {
      if (field[i] <= edge) continue;
      const mask = smoothstep(edge, core, field[i]);
      const tint = 1 - mask * this.response.darkening;
      for (let channel = 0; channel < 3; channel++) {
        const index = i * 3 + channel;
        maps.basecolor.data[index] = Math.round(maps.basecolor.data[index] * tint);
      }
      maps.height.data[i] = 0.5 + (maps.height.data[i] - 0.5)
        * (1 - mask * (1 - this.response.reliefRetention));
      maps.roughness.data[i] += (this.response.roughness - maps.roughness.data[i]) * mask;
    }
    return maps;
  }

  private field(u: number, v: number): number {
    const x = Math.round(this.world[0] / this.response.patchScale);
    const y = Math.round(this.world[1] / this.response.patchScale);
    const noise = (a: number, b: number, scale: number, offset: number) =>
      valueNoise(a, b, x * scale, y * scale, this.seed + offset);
    const warpedU = u + (noise(u, v, 2, 2017) - 0.5) * 0.3 / x;
    const warpedV = v + (noise(u, v, 2, 2131) - 0.5) * 0.3 / y;
    return noise(warpedU, warpedV, 1, 2269) * 0.78 + noise(warpedU, warpedV, 4, 2371) * 0.22;
  }
}
