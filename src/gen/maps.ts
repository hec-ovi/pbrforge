import type { Finish, Physical } from '../db/types.js';
import { clamp01 } from './color.js';
import { type Gray, type Rgb, luminance, wrapBlur, wrapSobel } from './pixels.js';

type Size = { width: number; height: number };

/**
 * Deterministic derivation of the non-color maps from a seamless basecolor.
 * v1 estimator lane: procedural, wrap-aware, standalone. The neural lane
 * (Marigold/DSINE inside ComfyUI) plugs in behind the same signatures later.
 */

/**
 * The two scales a photographed surface is read at: `feature` is the finest
 * blur that still holds a joint, a brick edge or a piece of aggregate, and
 * `shading` is the one that holds the large-scale lighting of the photograph.
 * What sits below the feature scale is the camera's speckle, not relief.
 */
function scales(width: number): { feature: number; shading: number } {
  const feature = Math.max(1, Math.round(width / 384));
  return { feature, shading: Math.max(feature * 4, Math.round(width / 64)) };
}

/**
 * Height: the surface between the two scales, centered at 0.5. Shape comes
 * through at full gain; the pixel-scale speckle under it is attenuated to the
 * finish's grain, which is what keeps a normal map from glittering at night.
 */
export function deriveHeight(basecolor: Rgb, finish: Finish): Gray {
  const lum = luminance(basecolor);
  const { feature, shading } = scales(basecolor.width);
  const shape = wrapBlur(lum, feature);
  const flat = wrapBlur(lum, shading);
  const out = new Float32Array(lum.data.length);
  for (let i = 0; i < out.length; i++) {
    const relief = shape.data[i] - flat.data[i];
    const speckle = lum.data[i] - shape.data[i];
    out[i] = clamp01(0.5 + finish.relief * (relief + finish.grain * speckle));
  }
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

/**
 * Roughness: the finish's band, rougher in cavities (dirt settles low) and
 * smoother on the crests. It is read off a blurred relief and clamped to the
 * band, so gloss moves over centimetres of surface and never per pixel: no
 * glitter on the specks, no damp patch where the photograph happened to be dark.
 */
export function deriveRoughness(height: Gray, finish: Finish): Gray {
  const [lo, hi] = finish.roughness;
  const mid = (lo + hi) / 2;
  const slope = 2 * (hi - lo);
  const shape = wrapBlur(height, Math.max(2, Math.round(height.width / 128)));
  const out = new Float32Array(height.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.min(hi, Math.max(lo, mid + (0.5 - shape.data[i]) * slope));
  }
  return { data: out, width: height.width, height: height.height };
}

/** Metallic: flat fill from the factor; per-pixel variation comes with the neural lane. */
export function deriveMetallic(size: Size, physical: Physical): Gray {
  return constantGray(size, physical.metallicFactor ?? 0);
}

/** Single-channel constant fill (a factor with no per-pixel variation). */
export function constantGray(size: Size, value: number): Gray {
  return { data: new Float32Array(size.width * size.height).fill(value), width: size.width, height: size.height };
}

/** Tangent-space normal with no relief: every texel points straight out. Screens are flat glass. */
export function flatNormal(size: Size): Rgb {
  const data = new Uint8Array(size.width * size.height * 3);
  for (let i = 0; i < size.width * size.height; i++) {
    data[i * 3] = 128;
    data[i * 3 + 1] = 128;
    data[i * 3 + 2] = 255;
  }
  return { data, width: size.width, height: size.height };
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
