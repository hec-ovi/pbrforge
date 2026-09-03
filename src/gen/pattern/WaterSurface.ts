import { clamp01, mixColor } from '../color.js';
import { hash2 } from './noise.js';
import { Pattern, type Point, type Texel } from './Pattern.js';

const TAU = Math.PI * 2;

/** Periodic crossing waves for a moving water normal map. */
export class WaterSurface extends Pattern {
  protected texel(at: Point): Texel {
    const { axis, cells, chop, colors, depth, roughness, seed, world } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const along = axis === 'y' ? v : u;
    const across = axis === 'y' ? u : v;
    const alongCycles = axis === 'y' ? cells[1] : cells[0];
    const acrossCycles = axis === 'y' ? cells[0] : cells[1];

    const primary = wave(along * alongCycles, phase(seed, 1));
    const crossing = wave(along * (alongCycles + 1) + across * acrossCycles, phase(seed, 2));
    const short = wave(along * alongCycles * 2 - across * (acrossCycles + 1), phase(seed, 3));
    const divisor = 1 + chop * 0.75;
    const signal = (primary + chop * (crossing * 0.5 + short * 0.25)) / divisor;
    const crest = clamp01(0.5 + signal * 0.5);

    return {
      color: mixColor(colors[0], colors[1], 0.18 + crest * 0.64),
      height: clamp01(0.5 + signal * depth * 0.5),
      roughness: clamp01(roughness + (0.5 - crest) * 0.08 + chop * 0.04),
    };
  }
}

function phase(seed: number, waveIndex: number): number {
  return hash2(waveIndex, seed, seed + waveIndex * 31) * TAU;
}

function wave(cycles: number, phaseOffset: number): number {
  return Math.sin(TAU * cycles + phaseOffset);
}
