import type { Point } from './Pattern.js';

/** Which cell of a rectangular grid a point is in, and how far it is from the joint around it. */
export interface RectCell {
  idX: number;
  idY: number;
  /** Metres to the nearest joint centre line. */
  edge: number;
}

/** Positive modulo: cells to the left of the origin still land in the grid. */
export function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

/** Integer index wrapped into 0..n-1, so a cell across the tile edge keeps one identity. */
export function wrapInt(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/** A rectangular grid of cells, optionally laid in a running bond (every other row shifted half a cell). */
export function rectCell(
  at: Point,
  cells: [number, number],
  world: [number, number],
  bond: 'stack' | 'running',
): RectCell {
  const [nx, ny] = cells;
  const cellWidth = world[0] / nx;
  const cellHeight = world[1] / ny;
  const row = Math.floor(at.y / cellHeight);
  const shifted = bond === 'running' && wrapInt(row, ny) % 2 === 1 ? at.x - cellWidth / 2 : at.x;
  const column = Math.floor(shifted / cellWidth);
  const dx = cellWidth / 2 - Math.abs(mod(shifted, cellWidth) - cellWidth / 2);
  const dy = cellHeight / 2 - Math.abs(mod(at.y, cellHeight) - cellHeight / 2);
  return { idX: wrapInt(column, nx), idY: wrapInt(row, ny), edge: Math.min(dx, dy) };
}
