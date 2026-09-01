import type { Rgb } from './pixels.js';

/**
 * Seam metric: mean absolute difference across the wrap edges, relative to the
 * image's mean neighbor difference. A seamless image scores near 1; a hard seam
 * scores several times the interior contrast.
 */
export function seamScore(img: Rgb): { x: number; y: number } {
  const { data, width: w, height: h } = img;
  const px = (x: number, y: number, c: number) => data[(y * w + x) * 3 + c];

  let interior = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) interior += Math.abs(px(x, y, c) - px(x + 1, y, c));
      count += 3;
    }
  }
  const meanInterior = Math.max(interior / count, 1e-3);

  let seamX = 0;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) seamX += Math.abs(px(w - 1, y, c) - px(0, y, c));
  }
  let seamY = 0;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) seamY += Math.abs(px(x, h - 1, c) - px(x, 0, c));
  }
  return { x: seamX / (h * 3) / meanInterior, y: seamY / (w * 3) / meanInterior };
}

export const SEAM_THRESHOLD = 2.5;

export function isSeamless(img: Rgb): boolean {
  const score = seamScore(img);
  return score.x <= SEAM_THRESHOLD && score.y <= SEAM_THRESHOLD;
}
