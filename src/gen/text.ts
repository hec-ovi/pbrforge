import { ADVANCE, BOX, CAP, GLYPHS } from './alphabet.js';
import { type Rgb, wrapBlur } from './pixels.js';

/**
 * Deterministic wordmark: ad artwork is generated brandless and the business
 * name is stroked in afterwards from the box's own alphabet, so a screen
 * rebrands without a new render and without depending on any installed font.
 * It goes across the lower third of the artwork, white on a soft dark scrim.
 */
export function stampBrand(image: Rgb, brand: string): Rgb {
  const chars = [...brand.toUpperCase()].filter((c) => c in GLYPHS);
  if (!chars.length) return image;

  const { width: w, height: h } = image;
  const capPx = Math.max(6, h * 0.09);
  const span = (chars.length - 1) * ADVANCE + BOX;
  const scale = Math.min(capPx / CAP, (w * 0.86) / span);
  const stroke = Math.max(1, capPx * 0.15);
  const x0 = (w - span * scale) / 2;
  const y0 = h * 0.88 - CAP * scale;

  const cover = new Float32Array(w * h);
  chars.forEach((char, i) => {
    for (const poly of GLYPHS[char]) {
      for (let p = 1; p < poly.length; p++) {
        stroke2(cover, w, h, stroke / 2, {
          ax: x0 + (i * ADVANCE + poly[p - 1][0]) * scale,
          ay: y0 + poly[p - 1][1] * scale,
          bx: x0 + (i * ADVANCE + poly[p][0]) * scale,
          by: y0 + poly[p][1] * scale,
        });
      }
    }
  });

  const scrim = wrapBlur({ data: cover, width: w, height: h }, Math.max(2, Math.round(stroke)), 2);
  const data = new Uint8Array(image.data.length);
  for (let i = 0; i < cover.length; i++) {
    const shade = 1 - 0.85 * Math.min(1, scrim.data[i] * 2.2);
    for (let c = 0; c < 3; c++) {
      const under = image.data[i * 3 + c] * shade;
      data[i * 3 + c] = Math.round(under + (255 - under) * cover[i]);
    }
  }
  return { data, width: w, height: h };
}

/** Anti-aliased round-capped segment, accumulated as maximum coverage. */
function stroke2(
  cover: Float32Array,
  w: number,
  h: number,
  half: number,
  s: { ax: number; ay: number; bx: number; by: number },
): void {
  const pad = Math.ceil(half + 1);
  const xs = Math.max(0, Math.floor(Math.min(s.ax, s.bx)) - pad);
  const xe = Math.min(w - 1, Math.ceil(Math.max(s.ax, s.bx)) + pad);
  const ys = Math.max(0, Math.floor(Math.min(s.ay, s.by)) - pad);
  const ye = Math.min(h - 1, Math.ceil(Math.max(s.ay, s.by)) + pad);
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = ys; y <= ye; y++) {
    for (let x = xs; x <= xe; x++) {
      const px = x + 0.5 - s.ax;
      const py = y + 0.5 - s.ay;
      const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
      const d = Math.hypot(px - dx * t, py - dy * t);
      const value = Math.min(1, Math.max(0, half + 0.5 - d));
      const i = y * w + x;
      if (value > cover[i]) cover[i] = value;
    }
  }
}
