import { MaterialsError } from '../../db/errors.js';
import { clamp01, mixColor, scaleColor } from '../color.js';
import { Pattern, type PatternParams, type Point, type Texel, smoothstep } from './Pattern.js';
import { mod } from './grid.js';
import { valueNoise } from './noise.js';

/** Tilted metal blades with folded lips and optional punched openings. */
export class Louvre extends Pattern {
  private readonly pitch: number;
  private readonly crossPitch: number;

  constructor(params: PatternParams) {
    super(params);
    const along = params.axis === 'y' ? 1 : 0;
    this.pitch = params.world[along] / params.cells[along];
    this.crossPitch = params.world[1 - along] / params.cells[1 - along];
    if (params.line + 2 * params.bevel >= this.pitch || params.bevel <= 0
      || (params.opening && (params.opening[0] >= this.crossPitch || params.opening[1] >= (this.pitch - params.line) * 0.4))) {
      throw new MaterialsError('E_SCHEMA', 'louvre needs room for its face, bevel and optional opening inside each cell');
    }
  }

  protected texel(at: Point): Texel {
    const { axis, colors, world, seed, grain, roughness, depth } = this.params;
    const { relief, cavity } = this.profile(at);
    const brushing = valueNoise(at.x / world[0], at.y / world[1], axis === 'y' ? 2 : 128,
      axis === 'y' ? 128 : 2, seed);
    const metal = scaleColor(colors[0], 1 + (brushing - 0.5) * grain * 2);
    const dx = (this.profile({ ...at, x: at.x + at.px / 2 }).relief
      - this.profile({ ...at, x: at.x - at.px / 2 }).relief) * depth * this.pitch / at.px;
    const dy = (this.profile({ ...at, y: at.y + at.py / 2 }).relief
      - this.profile({ ...at, y: at.y - at.py / 2 }).relief) * depth * this.pitch / at.py;
    return {
      color: mixColor(metal, colors[1] ?? scaleColor(colors[0], 0.18), cavity),
      height: clamp01(0.5 + depth * (relief - 0.5)),
      normal: [-dx, dy, 1],
      roughness: clamp01(roughness + cavity * 0.16 + (brushing - 0.5) * this.params.sheen),
    };
  }

  private profile(at: Point): { relief: number; cavity: number } {
    const { axis, line, bevel, opening } = this.params;
    const along = mod(axis === 'y' ? at.y : at.x, this.pitch);
    const across = mod(axis === 'y' ? at.x : at.y, this.crossPitch);
    const aa = (axis === 'y' ? at.py : at.px) / 2;
    const edge = Math.min(along, this.pitch - along);
    const gap = this.line(edge, line / 2, aa);
    const face = smoothstep(line / 2 - aa, line / 2 + bevel, along)
      * (1 - smoothstep(this.pitch - line / 2 - bevel, this.pitch - line / 2 + aa, along));
    const ramp = clamp01((along - line / 2) / (this.pitch - line));
    let punch = 0;
    if (opening) {
      const crossAa = (axis === 'y' ? at.px : at.py) / 2;
      punch = this.line(across - this.crossPitch / 2, opening[0] / 2, crossAa)
        * this.line(along - this.pitch * 0.68, opening[1] / 2, aa);
    }
    return { relief: face * (0.24 + ramp * 0.76) * (1 - punch), cavity: Math.max(gap, punch) };
  }
}
