import type { Rgb } from './pixels.js';
import { wrapBlur } from './pixels.js';

/**
 * Procedural near-uniform basecolor for surfaces diffusion cannot produce
 * (glass, plain colors): a flat fill modulated by faint seeded wrap-around
 * noise so the derived maps get believable micro-detail. Deterministic.
 */
export function synthesizeFlat(hex: string, seed: number, width: number, height: number, amplitude = 0.04): Rgb {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  let state = (seed >>> 0) || 1;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const raw = new Float32Array(width * height);
  for (let i = 0; i < raw.length; i++) raw[i] = rand();
  const fine = wrapBlur({ data: raw, width, height }, 2, 2);
  const coarse = wrapBlur({ data: raw, width, height }, Math.max(8, Math.round(width / 24)), 3);

  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < raw.length; i++) {
    const n = 1 + ((fine.data[i] - 0.5) * 0.6 + (coarse.data[i] - 0.5)) * 2 * amplitude;
    data[i * 3] = Math.max(0, Math.min(255, Math.round(r * n)));
    data[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g * n)));
    data[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b * n)));
  }
  return { data, width, height };
}
