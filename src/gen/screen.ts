import type { Screen } from '../db/types.js';
import { type Rgb, luminance, wrapBlur } from './pixels.js';

/**
 * Display structure, applied procedurally over flat ad artwork. The diffusion image
 * carries only the advertisement; the lattice, the scan bands, the colour fringing
 * and the blown-out hotspots are what turn it into a screen.
 */

/** Emission map of one screen: the artwork seen through its pixel structure. */
export function screenEmission(artwork: Rgb, screen: Screen): Rgb {
  if (screen.kind === 'glyph-panel') return artwork;
  const pitch = pitchOf(screen, artwork.width);
  const { mask, rowShift } = lattice(screen, artwork.width, artwork.height, pitch);
  return compose(artwork, mask, rowShift, pitch);
}

/** Unlit basecolor: near-black display glass with the faint structure of its own pixels. */
export function screenGlass(glass: Rgb, screen: Screen): Rgb {
  if (screen.kind === 'glyph-panel') return glass;
  const { mask } = lattice(screen, glass.width, glass.height, pitchOf(screen, glass.width));
  const data = new Uint8Array(glass.data.length);
  for (let i = 0; i < mask.length; i++) {
    const lift = 1 + 0.9 * mask[i];
    for (let c = 0; c < 3; c++) data[i * 3 + c] = clamp255(glass.data[i * 3 + c] * lift);
  }
  return { data, width: glass.width, height: glass.height };
}

function pitchOf(screen: Screen, width: number): number {
  return screen.pitch ?? Math.max(4, Math.round(width / 160));
}

/** Per-pixel structure amount, plus the horizontal sample shift that breaks scan bands apart. */
function lattice(screen: Screen, w: number, h: number, pitch: number): { mask: Float32Array; rowShift: Int32Array } {
  const mask = new Float32Array(w * h);
  const rowShift = new Int32Array(h);
  if (screen.kind === 'led-dot') {
    const radius = pitch * 0.42;
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / pitch) * pitch + pitch / 2;
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / pitch) * pitch + pitch / 2;
        mask[y * w + x] = 1 - smoothstep(0.72, 1, Math.hypot(x - cx, y - cy) / radius);
      }
    }
    return { mask, rowShift };
  }
  // scanline-billboard: bright bands with dark gaps, each band nudged sideways, beating into moire.
  for (let y = 0; y < h; y++) {
    const band = Math.floor(y / pitch);
    const t = (y - band * pitch) / pitch;
    const profile = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t - 0.5)));
    const beat = 0.85 + 0.15 * Math.cos((2 * Math.PI * y) / (pitch * 6.5));
    rowShift[y] = (Math.imul(band, 2654435761) >>> 0) % 5 - 2;
    mask.fill(profile * beat, y * w, y * w + w);
  }
  return { mask, rowShift };
}

/** Structure over artwork: channels split by a pixel, bright content blowing out and bleeding past the gaps. */
function compose(artwork: Rgb, mask: Float32Array, rowShift: Int32Array, pitch: number): Rgb {
  const { width: w, height: h } = artwork;
  const lum = luminance(artwork);
  const hot = new Float32Array(lum.data.length);
  for (let i = 0; i < hot.length; i++) hot[i] = smoothstep(0.72, 0.96, lum.data[i]);
  const bloom = wrapBlur({ data: hot, width: w, height: h }, Math.max(2, Math.round(pitch * 0.6)), 2);

  const fringe = [1, 0, -1]; // R and B split sideways: the colour fringing of a filmed display
  const data = new Uint8Array(artwork.data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const glow = Math.min(1, bloom.data[i] * 1.4);
      const lit = Math.min(1, mask[i] + glow * (1 - mask[i]) * 0.8);
      for (let c = 0; c < 3; c++) {
        const sx = Math.min(w - 1, Math.max(0, x + rowShift[y] + fringe[c]));
        data[i * 3 + c] = clamp255(artwork.data[(y * w + sx) * 3 + c] * lit + hot[i] * 70);
      }
    }
  }
  return { data, width: w, height: h };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp255(v: number): number {
  return Math.round(Math.min(255, Math.max(0, v)));
}
