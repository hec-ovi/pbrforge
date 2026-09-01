import type { Finish, FinishSpec, Physical } from '../db/types.js';
import { clamp01 } from './color.js';

/** Half width of the band around the entry's roughness factor when a request states none. */
const SPREAD = 0.05;
const GRAIN = 0.2;
const RELIEF = 2;

/**
 * A photograph carries its own gloss and grain in every pixel, and read
 * straight out it makes bright specks shiny and dark blotches damp. The finish
 * is what a surface is instead: a roughness band it never leaves, and how much
 * of the fine speckle is relief rather than noise.
 */
export function resolveFinish(spec: FinishSpec | undefined, physical: Physical): Finish {
  const factor = physical.roughnessFactor ?? 1;
  const [lo, hi] = spec?.roughness ?? [factor - SPREAD, factor + SPREAD];
  return {
    roughness: [round(clamp01(Math.min(lo, hi))), round(clamp01(Math.max(lo, hi)))],
    grain: spec?.grain ?? GRAIN,
    relief: spec?.relief ?? RELIEF,
  };
}

/** The band is authored in hundredths; a default computed off the factor is kept as readable. */
function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
