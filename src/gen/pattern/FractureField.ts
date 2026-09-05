import { hash2, valueNoise } from './noise.js';
import { smoothstep } from './Pattern.js';

/** Sparse surface fractures, periodic at the tile edges and measured in metres. */
export class FractureField {
  constructor(private readonly world: [number, number], private readonly seed: number) {}

  sample(u: number, v: number, pixelSize: number): number {
    const [w, h] = this.world;
    const nx = Math.max(2, Math.round(w * 2));
    const ny = Math.max(2, Math.round(h * 2));
    const x = u * nx + (valueNoise(u, v, nx * 8, ny * 8, this.seed + 1) - 0.5) * 0.08;
    const y = v * ny + (valueNoise(u, v, nx * 8, ny * 8, this.seed + 2) - 0.5) * 0.08;
    let first = Infinity;
    let second = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      const hx = ((cx % nx) + nx) % nx;
      const hy = ((cy % ny) + ny) % ny;
      const px = cx + 0.25 + hash2(hx, hy, this.seed + 3) * 0.5;
      const py = cy + 0.25 + hash2(hx, hy, this.seed + 4) * 0.5;
      const distance = Math.hypot((x - px) * w / nx, (y - py) * h / ny);
      if (distance < first) { second = first; first = distance; }
      else if (distance < second) second = distance;
    }
    const edge = (second - first) * 0.5;
    const line = 1 - smoothstep(0.001, 0.003 + pixelSize, edge);
    const coverage = smoothstep(0.45, 0.7, valueNoise(u, v, nx, ny, this.seed + 5));
    return line * coverage;
  }
}
