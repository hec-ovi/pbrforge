import { type Rgb, wrapBlur } from './pixels.js';

/**
 * Deterministic wordmark. Ad artwork is generated brandless; the business name is
 * stroked in afterwards from a built-in geometric alphabet, so a screen rebrands
 * without a new render and without depending on the fonts installed on a machine.
 *
 * Glyphs are polylines on a 6 wide, 10 tall box, y downwards from the cap line.
 */
type Poly = [number, number][];

const O: Poly = [[1.5, 0], [4.5, 0], [6, 2], [6, 8], [4.5, 10], [1.5, 10], [0, 8], [0, 2], [1.5, 0]];
const P_BOWL: Poly = [[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 4], [4.5, 5.5], [0, 5.5]];

const GLYPHS: Record<string, Poly[]> = {
  A: [[[0, 10], [3, 0], [6, 10]], [[1, 6.7], [5, 6.7]]],
  B: [[[0, 0], [4, 0], [6, 1.5], [6, 3.5], [4, 5], [0, 5]], [[0, 5], [4.5, 5], [6, 6.5], [6, 8.5], [4.5, 10], [0, 10], [0, 0]]],
  C: [[[6, 2], [4.5, 0], [1.5, 0], [0, 2], [0, 8], [1.5, 10], [4.5, 10], [6, 8]]],
  D: [[[0, 0], [4, 0], [6, 2], [6, 8], [4, 10], [0, 10], [0, 0]]],
  E: [[[6, 0], [0, 0], [0, 10], [6, 10]], [[0, 5], [4.5, 5]]],
  F: [[[6, 0], [0, 0], [0, 10]], [[0, 5], [4.5, 5]]],
  G: [[[6, 2], [4.5, 0], [1.5, 0], [0, 2], [0, 8], [1.5, 10], [4.5, 10], [6, 8], [6, 5.5], [3.5, 5.5]]],
  H: [[[0, 0], [0, 10]], [[6, 0], [6, 10]], [[0, 5], [6, 5]]],
  I: [[[3, 0], [3, 10]], [[1, 0], [5, 0]], [[1, 10], [5, 10]]],
  J: [[[4.5, 0], [4.5, 8], [3, 10], [1.5, 10], [0, 8]]],
  K: [[[0, 0], [0, 10]], [[6, 0], [0.5, 5.2]], [[1.5, 4.4], [6, 10]]],
  L: [[[0, 0], [0, 10], [6, 10]]],
  M: [[[0, 10], [0, 0], [3, 4], [6, 0], [6, 10]]],
  N: [[[0, 10], [0, 0], [6, 10], [6, 0]]],
  O: [O],
  P: [P_BOWL],
  Q: [O, [[3.5, 7], [6, 10]]],
  R: [P_BOWL, [[2.5, 5.5], [6, 10]]],
  S: [[[6, 1.5], [4.5, 0], [1.5, 0], [0, 1.5], [0, 3.5], [1.5, 5], [4.5, 5], [6, 6.5], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5]]],
  T: [[[0, 0], [6, 0]], [[3, 0], [3, 10]]],
  U: [[[0, 0], [0, 8], [1.5, 10], [4.5, 10], [6, 8], [6, 0]]],
  V: [[[0, 0], [3, 10], [6, 0]]],
  W: [[[0, 0], [1.5, 10], [3, 4], [4.5, 10], [6, 0]]],
  X: [[[0, 0], [6, 10]], [[6, 0], [0, 10]]],
  Y: [[[0, 0], [3, 5], [6, 0]], [[3, 5], [3, 10]]],
  Z: [[[0, 0], [6, 0], [0, 10], [6, 10]]],
  '0': [O, [[1, 8], [5, 2]]],
  '1': [[[1, 2], [3, 0], [3, 10]], [[1, 10], [5, 10]]],
  '2': [[[0, 2], [1.5, 0], [4.5, 0], [6, 2], [6, 3.5], [0, 10], [6, 10]]],
  '3': [[[0, 0], [6, 0], [2.5, 4.5], [4.5, 4.5], [6, 6], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5]]],
  '4': [[[4.5, 0], [0, 7], [6, 7]], [[4.5, 0], [4.5, 10]]],
  '5': [[[6, 0], [0, 0], [0, 4.5], [4.5, 4.5], [6, 6], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5]]],
  '6': [[[5, 0], [2, 0], [0, 3], [0, 8.5], [1.5, 10], [4.5, 10], [6, 8.5], [6, 6.5], [4.5, 5], [1.5, 5], [0, 6.5]]],
  '7': [[[0, 0], [6, 0], [2, 10]]],
  '8': [[[1.5, 0], [4.5, 0], [6, 1.5], [6, 3.5], [4.5, 5], [1.5, 5], [0, 3.5], [0, 1.5], [1.5, 0]], [[1.5, 5], [4.5, 5], [6, 6.5], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5], [0, 6.5], [1.5, 5]]],
  '9': [[[1, 10], [4, 10], [6, 7], [6, 1.5], [4.5, 0], [1.5, 0], [0, 1.5], [0, 3.5], [1.5, 5], [4.5, 5], [6, 3.5]]],
  '-': [[[1, 5], [5, 5]]],
  '.': [[[2.7, 9.7], [3.3, 9.7]]],
  ' ': [],
};

const BOX = 6;
const ADVANCE = 7.6; // glyph box plus tracking
const CAP = 10;

/** Strokes the business name across the lower third of the artwork, white on a soft dark scrim. */
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
