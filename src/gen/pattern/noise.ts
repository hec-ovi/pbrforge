/**
 * Tileable value noise: a lattice of hashed values, smoothly interpolated, with
 * the lattice indices taken modulo the cell counts so the field wraps exactly.
 */

/** Deterministic hash of a lattice point, 0..1. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise over a wrapping lattice of cellsX by cellsY, sampled at u, v in 0..1. */
export function valueNoise(u: number, v: number, cellsX: number, cellsY: number, seed: number): number {
  const x = u * cellsX;
  const y = v * cellsY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep01(x - x0);
  const fy = smoothstep01(y - y0);
  const wrap = (i: number, n: number) => ((i % n) + n) % n;
  const ax = wrap(x0, cellsX);
  const ay = wrap(y0, cellsY);
  const bx = wrap(x0 + 1, cellsX);
  const by = wrap(y0 + 1, cellsY);
  const top = lerp(hash2(ax, ay, seed), hash2(bx, ay, seed), fx);
  const bottom = lerp(hash2(ax, by, seed), hash2(bx, by, seed), fx);
  return lerp(top, bottom, fy);
}

/**
 * Octaves of that noise, each four times finer at half the weight: one call
 * covers both the tonal patches of a surface and the speckle in it, which is
 * what asphalt and worn concrete need. Every octave keeps whole cell counts, so
 * the sum still wraps.
 */
export function fbmNoise(
  u: number,
  v: number,
  cellsX: number,
  cellsY: number,
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(u, v, cellsX * frequency, cellsY * frequency, seed + o * 17);
    total += amplitude;
    amplitude /= 2;
    frequency *= 4;
  }
  return sum / total;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}
