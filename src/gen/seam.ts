import type { Rgb } from './pixels.js';

/**
 * Seam metric: the mean absolute difference across the wrap edge, relative to
 * the LARGEST interior column/row difference. A toroidal image's wrap column
 * behaves like any interior column (structure boundaries included), so its
 * ratio stays near or below 1; a genuine seam is a discontinuity harder than
 * anything inside the image and scores well above it.
 */
export function seamScore(img: Rgb): { x: number; y: number } {
  const { width: w, height: h } = img;
  const colDiff = (a: number, b: number) => {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + a) * 3;
      const j = (y * w + b) * 3;
      sum += Math.abs(img.data[i] - img.data[j]) + Math.abs(img.data[i + 1] - img.data[j + 1]) + Math.abs(img.data[i + 2] - img.data[j + 2]);
    }
    return sum / (h * 3);
  };
  const rowDiff = (a: number, b: number) => {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      const i = (a * w + x) * 3;
      const j = (b * w + x) * 3;
      sum += Math.abs(img.data[i] - img.data[j]) + Math.abs(img.data[i + 1] - img.data[j + 1]) + Math.abs(img.data[i + 2] - img.data[j + 2]);
    }
    return sum / (w * 3);
  };

  let maxInteriorX = 1e-3;
  for (let x = 0; x < w - 1; x++) maxInteriorX = Math.max(maxInteriorX, colDiff(x, x + 1));
  let maxInteriorY = 1e-3;
  for (let y = 0; y < h - 1; y++) maxInteriorY = Math.max(maxInteriorY, rowDiff(y, y + 1));

  return { x: colDiff(w - 1, 0) / maxInteriorX, y: rowDiff(h - 1, 0) / maxInteriorY };
}

export const SEAM_THRESHOLD = 1.2;

export function isSeamless(img: Rgb): boolean {
  const score = seamScore(img);
  return score.x <= SEAM_THRESHOLD && score.y <= SEAM_THRESHOLD;
}
