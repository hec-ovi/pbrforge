import { BOX, CAP, glyphDistance } from '../alphabet.js';
import { clamp01, mixColor } from '../color.js';
import { Pattern, type Point, type Texel, smoothstep } from './Pattern.js';

/** The sheet: one glyph per cell, row-major, this charset in this grid. Published in CONTRACT.md. */
export const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+ ";
export const GRID = { columns: 8, rows: 6 };

/** How much of a cell the cap height fills; the rest is the margin a lit glyph glows into. */
export const CAP_FILL = 0.62;

/**
 * A lit letter sheet: every character of the charset stroked into its own cell,
 * as a bright core with a colored halo over a dark plate. Exterior places one
 * cell per letter of a sign, so a whole modular sign system runs off one sheet
 * and no render is needed to spell a new name.
 *
 * `line` is the core width and `bevel` the halo reach, both as a fraction of a
 * cell: a thin core with a wide halo is a neon tube, a wide core with a short
 * halo is a backlit panel.
 */
export class GlyphAtlas extends Pattern {
  protected texel(at: Point): Texel {
    const { world, colors, line, bevel, depth, roughness } = this.params;
    const u = at.x / world[0];
    const v = at.y / world[1];
    const column = Math.min(GRID.columns - 1, Math.floor(u * GRID.columns));
    const row = Math.min(GRID.rows - 1, Math.floor(v * GRID.rows));
    const char = CHARSET[row * GRID.columns + column] ?? ' ';

    // the glyph box centred in its cell, cap height filling CAP_FILL of it
    const unit = CAP_FILL / CAP;
    const x = (u * GRID.columns - column - 0.5) / unit + BOX / 2;
    const y = (v * GRID.rows - row - 0.5) / unit + CAP / 2;
    const distance = glyphDistance(char, x, y) * unit;

    const aa = Math.max(at.px * GRID.columns, at.py * GRID.rows) / 2;
    const core = 1 - smoothstep(line / 2 - aa, line / 2 + aa, distance);
    const halo = bevel === 0 ? 0 : Math.exp(-Math.max(0, distance - line / 2) / bevel);

    const plate = colors[2] ?? colors[1] ?? colors[0];
    const glow = colors[1] ?? colors[0];
    const lit = mixColor(mixColor(plate, glow, halo), colors[0], core);
    return {
      color: lit,
      height: clamp01(0.5 + depth * (core - 0.5)),
      roughness: clamp01(roughness - core * 0.25),
    };
  }
}
