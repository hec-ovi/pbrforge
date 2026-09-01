import type { Physical } from '../db/types.js';
import { type Gray, type Rgb, luminance, wrapBlur, wrapSobel } from './pixels.js';

/**
 * Deterministic derivation of the non-color maps from a seamless basecolor.
 * v1 estimator lane: procedural, wrap-aware, standalone. The neural lane
 * (Marigold/DSINE inside ComfyUI) plugs in behind the same signatures later.
 */

/** Height: band-passed luminance (fine relief without the large-scale shading), centered at 0.5. */
export function deriveHeight(basecolor: Rgb): Gray {
  const lum = luminance(basecolor);
  const low = wrapBlur(lum, Math.max(4, Math.round(basecolor.width / 64)));
  const out = new Float32Array(lum.data.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, 0.5 + (lum.data[i] - low.data[i]) * 2));
  return { data: out, width: lum.width, height: lum.height };
}

/** Normal from height, wrap Sobel, OpenGL-style +Y up. Kept shallow: city materials are seen from meters away. */
export function deriveNormal(height: Gray, strength = 2): Rgb {
  const { dx, dy } = wrapSobel(height);
  const out = new Uint8Array(height.width * height.height * 3);
  for (let i = 0; i < dx.length; i++) {
    const nx = -dx[i] * strength;
    const ny = dy[i] * strength; // +Y up: brighter pixels below push the normal up
    const inv = 1 / Math.hypot(nx, ny, 1);
    out[i * 3] = Math.round((nx * inv * 0.5 + 0.5) * 255);
    out[i * 3 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
    out[i * 3 + 2] = Math.round((inv * 0.5 + 0.5) * 255);
  }
  return { data: out, width: height.width, height: height.height };
}

/** Roughness: the material's factor as base, brighter in cavities (rough dirt settles low). */
export function deriveRoughness(height: Gray, physical: Physical): Gray {
  const base = physical.roughnessFactor ?? 1;
  const out = new Float32Array(height.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.min(1, Math.max(0, base * (1 + (0.5 - height.data[i]) * 0.4)));
  }
  return { data: out, width: height.width, height: height.height };
}

/** Metallic: flat fill from the factor; per-pixel variation comes with the neural lane. */
export function deriveMetallic(size: { width: number; height: number }, physical: Physical): Gray {
  const value = physical.metallicFactor ?? 0;
  return { data: new Float32Array(size.width * size.height).fill(value), width: size.width, height: size.height };
}

/** AO: occlusion where height sits below its local average. */
export function deriveAo(height: Gray, strength = 1.5): Gray {
  const local = wrapBlur(height, Math.max(4, Math.round(height.width / 96)));
  const out = new Float32Array(height.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.min(1, Math.max(0, 1 - strength * Math.max(0, local.data[i] - height.data[i])));
  }
  return { data: out, width: height.width, height: height.height };
}

/** Emission: basecolor masked by luminance (bright sources) or by saturated color (neon). */
export function deriveEmission(basecolor: Rgb, mode: 'luminance' | 'color-mask'): Rgb {
  const out = new Uint8Array(basecolor.data.length);
  for (let i = 0; i < basecolor.data.length / 3; i++) {
    const r = basecolor.data[i * 3] / 255;
    const g = basecolor.data[i * 3 + 1] / 255;
    const b = basecolor.data[i * 3 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const mask =
      mode === 'luminance'
        ? smoothstep(0.7, 0.9, 0.2126 * r + 0.7152 * g + 0.0722 * b)
        : smoothstep(0.35, 0.6, (max === 0 ? 0 : (max - min) / max) * max);
    out[i * 3] = Math.round(basecolor.data[i * 3] * mask);
    out[i * 3 + 1] = Math.round(basecolor.data[i * 3 + 1] * mask);
    out[i * 3 + 2] = Math.round(basecolor.data[i * 3 + 2] * mask);
  }
  return { data: out, width: basecolor.width, height: basecolor.height };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
