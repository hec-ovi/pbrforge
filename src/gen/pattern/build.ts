import { MaterialsError } from '../../db/errors.js';
import type { PatternSpec } from '../../db/types.js';
import { parseHex } from '../color.js';
import { GlyphAtlas } from './GlyphAtlas.js';
import { Grille } from './Grille.js';
import { IncidentBlood } from './IncidentBlood.js';
import { IncidentTyre } from './IncidentTyre.js';
import { HexagonGrid } from './HexagonGrid.js';
import { Lamp } from './Lamp.js';
import { LaneField } from './LaneField.js';
import { NoiseField } from './NoiseField.js';
import { PanelGrid } from './PanelGrid.js';
import { Pattern, type PatternParams } from './Pattern.js';
import { PuddleField } from './PuddleField.js';
import { SlabTiling } from './SlabTiling.js';
import { Stripe } from './Stripe.js';
import { TwoTone } from './TwoTone.js';

/** Sensible middle of the library: a 15 mm joint with a 10 mm chamfer, a shallow relief, faint grain. */
const DEFAULTS = {
  cells: [4, 4] as [number, number],
  line: 0.015,
  bevel: 0.01,
  depth: 0.4,
  joint: 0.45,
  variation: 0.05,
  sheen: 0,
  grain: 0.02,
  octaves: 1,
  wet: 0.35,
  wear: 0,
  bond: 'stack' as const,
  axis: 'y' as const,
  split: 0.5,
};

/** Kinds that read as two materials meeting, so they need a second color. */
const TWO_COLOR: PatternSpec['kind'][] = ['stripe', 'two-tone', 'noise', 'lane', 'puddle', 'glyph-atlas'];

/**
 * The pattern a spec asks for, with defaults filled in and the cross-field
 * rules checked: the parameters alone decide the surface, so the same spec on
 * the same tile always draws the same maps.
 */
export function buildPattern(
  spec: PatternSpec,
  world: [number, number],
  roughness: number,
  seed: number,
  edgeInset = 0,
): Pattern {
  const cells = spec.cells ?? DEFAULTS.cells;
  if (TWO_COLOR.includes(spec.kind) && spec.colors.length < 2) {
    throw new MaterialsError('E_SCHEMA', `pattern ${spec.kind} needs two colors`);
  }
  if ((spec.bond ?? DEFAULTS.bond) === 'running' && cells[1] % 2 !== 0) {
    throw new MaterialsError('E_SCHEMA', 'a running bond needs an even row count so the offset wraps');
  }
  if (spec.kind === 'hexagon' && cells[0] < 2) {
    throw new MaterialsError('E_SCHEMA', 'a hexagon grid needs at least two columns');
  }

  const params: PatternParams = {
    kind: spec.kind,
    colors: spec.colors.map(parseHex),
    cells,
    line: spec.line ?? DEFAULTS.line,
    bevel: spec.bevel ?? DEFAULTS.bevel,
    depth: spec.depth ?? DEFAULTS.depth,
    joint: spec.joint ?? DEFAULTS.joint,
    variation: spec.variation ?? DEFAULTS.variation,
    sheen: spec.sheen ?? DEFAULTS.sheen,
    grain: spec.grain ?? DEFAULTS.grain,
    octaves: spec.octaves ?? DEFAULTS.octaves,
    wet: spec.wet ?? DEFAULTS.wet,
    wear: spec.wear ?? DEFAULTS.wear,
    bond: spec.bond ?? DEFAULTS.bond,
    axis: spec.axis ?? DEFAULTS.axis,
    split: spec.split ?? DEFAULTS.split,
    roughness,
    world,
    edgeInset,
    seed,
  };

  switch (spec.kind) {
    case 'hexagon':
      return new HexagonGrid(params);
    case 'panel-grid':
      return new PanelGrid(params);
    case 'slab':
      return new SlabTiling(params);
    case 'stripe':
      return new Stripe(params);
    case 'two-tone':
      return new TwoTone(params);
    case 'noise':
      return new NoiseField(params);
    case 'lane':
      return new LaneField(params);
    case 'puddle':
      return new PuddleField(params);
    case 'lamp':
      return new Lamp(params);
    case 'glyph-atlas':
      return new GlyphAtlas(params);
    case 'grille':
      return new Grille(params);
    case 'incident-blood':
      return new IncidentBlood(params);
    case 'incident-tyre':
      return new IncidentTyre(params);
  }
}
