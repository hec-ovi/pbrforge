import type { Gray, Rgb } from '../pixels.js';
import type { Pattern } from './Pattern.js';

/** What a pattern draws: the surface itself, its relief, and its gloss. */
export interface PatternMaps {
  basecolor: Rgb;
  height: Gray;
  roughness: Gray;
  opacity?: Gray;
}

/** Rasterizes a pattern, one sample per pixel centre, each anti-aliased against its own pixel. */
export function renderPattern(pattern: Pattern, width: number, height: number): PatternMaps {
  const color = new Uint8Array(width * height * 3);
  const relief = new Float32Array(width * height);
  const gloss = new Float32Array(width * height);
  const opacity = new Float32Array(width * height);
  let hasOpacity = false;
  const du = 1 / width;
  const dv = 1 / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const texel = pattern.sample((x + 0.5) * du, (y + 0.5) * dv, du, dv);
      const i = y * width + x;
      color[i * 3] = Math.round(texel.color.r * 255);
      color[i * 3 + 1] = Math.round(texel.color.g * 255);
      color[i * 3 + 2] = Math.round(texel.color.b * 255);
      relief[i] = texel.height;
      gloss[i] = texel.roughness;
      if (texel.opacity !== undefined) {
        opacity[i] = texel.opacity;
        hasOpacity = true;
      }
    }
  }
  return {
    basecolor: { data: color, width, height },
    height: { data: relief, width, height },
    roughness: { data: gloss, width, height },
    ...(hasOpacity ? { opacity: { data: opacity, width, height } } : {}),
  };
}
