import { clamp01, mixColor, scaleColor } from '../color.js';
import { Pattern, type Point, type Texel, smoothstep } from './Pattern.js';
import { fbmNoise, valueNoise } from './noise.js';

/** Blades of the fan seen through the grille, the hub as a share of the grille, and how far in from the edge dirt collects, in metres. */
const BLADES = 5;
const HUB = 0.22;
const EDGE_DIRT = 0.14;
/** Dirt blotches run on a lattice this many cells across the face. */
const BLOTCH_CELLS = 5;

/**
 * One condenser face per sheet: a painted housing with a folded edge, a round
 * flange, and a wire grille of concentric rings on four spokes over the dark
 * fan cavity behind it. `line` is the ring pitch and `bevel` the flange width,
 * both in metres; `split` is the grille diameter as a fraction of the face;
 * `wear` is the dirt: grime at the housing edges, rust at the flange, streaks
 * under the grille. Colors: the paint, the cavity, the dirt.
 */
export class Grille extends Pattern {
  protected texel(at: Point): Texel {
    const { world, colors, line, bevel, split, joint, depth, roughness, variation, grain, seed } = this.params;
    const aa = Math.max(at.px, at.py) / 2;
    const dx = at.x - world[0] / 2;
    const dy = at.y - world[1] / 2;
    const r = Math.hypot(dx, dy);
    const radius = (split * Math.min(world[0], world[1])) / 2;
    const mottle = this.mottle(at);

    const cavity = colors[1] ?? scaleColor(colors[0], 0.12);
    const dirt = colors[2] ?? scaleColor(colors[0], 0.45);
    const paint = scaleColor(colors[0], 1 + (mottle - 0.5) * 2 * variation + (mottle - 0.5) * 2 * grain);
    const wire = mixColor(paint, cavity, joint);

    // the housing: a flat painted face with a folded edge lip along the sheet border
    const inset = Math.min(at.x, world[0] - at.x, at.y, world[1] - at.y);
    const lip = 1 - smoothstep(bevel / 2 - aa, bevel / 2 + aa, inset);
    let color = paint;
    let height = 0.55 + 0.08 * lip;
    let gloss = roughness;

    // the flange: a raised painted ring around the opening, chamfered on both sides
    const flange = smoothstep(radius - aa, radius + aa, r) * (1 - smoothstep(radius + bevel - aa, radius + bevel + aa, r));
    const chamfer = Math.min(smoothstep(0, bevel * 0.35, r - radius), smoothstep(0, bevel * 0.35, radius + bevel - r));
    height = mix(height, 0.62 + 0.14 * chamfer, flange);

    // the cavity: the fan hub and its blades, sunk behind the grille
    const inside = 1 - smoothstep(radius - aa, radius + aa, r);
    if (inside > 0) {
      const theta = Math.atan2(dy, dx);
      const blade = smoothstep(0.45, 0.8, Math.cos(BLADES * (theta - (r / radius) * 1.2)));
      const hub = 1 - smoothstep(HUB * radius - aa, HUB * radius + aa, r);
      const fan = mixColor(mixColor(cavity, scaleColor(cavity, 1.9), blade * 0.6), scaleColor(cavity, 2.2), hub);
      color = mixColor(color, fan, inside);
      height = mix(height, 0.08 + 0.1 * blade + 0.18 * hub, inside);
      gloss = mix(gloss, Math.max(roughness, 0.8), inside);
    }

    // the grille: rings at the pitch and four spokes, painted wire over the cavity
    const ringHalf = line * 0.11;
    const nearest = Math.round(r / line) * line;
    const rings = nearest >= line && nearest <= radius - line * 0.4 ? this.line(r - nearest, ringHalf, aa) : 0;
    const spokes = r < radius - line * 0.4 ? Math.max(this.line(dx, line * 0.28, aa), this.line(dy, line * 0.28, aa)) : 0;
    const grille = Math.max(rings, spokes) * inside;
    color = mixColor(color, wire, grille);
    height = mix(height, 0.42, grille);
    gloss = mix(gloss, roughness, grille);

    // the dirt: a soft grime toward the housing edges, rust in a thin band at the flange edge, and
    // streaks running down under the grille, each in blotches a few centimetres wide
    const wear = this.params.wear;
    if (wear > 0) {
      const blotch = fbmNoise(at.x / world[0], at.y / world[1], BLOTCH_CELLS, BLOTCH_CELLS, 2, seed + 5);
      const edge = (1 - smoothstep(0, EDGE_DIRT, inset)) ** 1.5 * (0.35 + 0.65 * blotch);
      const rim = (1 - smoothstep(0, bevel * 0.6, Math.abs(r - radius - bevel))) * smoothstep(0.4, 0.7, blotch);
      const streak = valueNoise(at.x / world[0], at.y / (world[1] * 6), 18, 1, seed + 3);
      const below = smoothstep(radius + bevel, radius + bevel + 0.1, dy) * smoothstep(0.55, 0.85, streak) * blotch;
      const outside = 1 - inside;
      color = mixColor(color, dirt, wear * edge * 0.55 * outside);
      color = mixColor(color, dirt, wear * rim * 0.85 * outside);
      color = mixColor(color, dirt, wear * below * 0.5 * outside);
      gloss = clamp01(gloss + wear * (edge + rim + below) * 0.2 * outside);
    }

    return { color, height: clamp01(0.5 + depth * (height - 0.5)), roughness: clamp01(gloss) };
  }
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
