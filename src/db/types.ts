export type MapName = 'basecolor' | 'normal' | 'roughness' | 'metallic' | 'height' | 'ao' | 'emission';

export interface Physical {
  breakable?: boolean;
  metallicFactor?: number;
  roughnessFactor?: number;
  transmission?: number;
  ior?: number;
  tint?: string;
  emissiveStrength?: number;
  alphaMode?: 'OPAQUE' | 'BLEND' | 'MASK';
}

/** How a photographed surface is read into relief and gloss: stated on the entry, resolved. */
export interface Finish {
  /** The band the roughness map stays inside, [min, max]. */
  roughness: [number, number];
  /** How much of the pixel-scale speckle survives into the relief: 0 keeps feature scale alone. */
  grain: number;
  /** Gain on the feature-scale relief: joints, bricks, aggregate. */
  relief: number;
}

/** A finish as authored: what a request leaves out comes from the surface's own roughness. */
export type FinishSpec = Partial<Finish>;

export interface Variant {
  id: string;
  /** How the maps were made. Consumers read the maps the same way either way. */
  class?: 'image' | 'pattern';
  resolution: [number, number];
  maps: Partial<Record<MapName, string>> & { basecolor: string; normal: string; roughness: string; metallic: string };
}

export interface MaterialEntry {
  key: string;
  aliases?: string[];
  alignment: 'tile' | 'exact';
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  physical: Physical;
  /** Present when the entry has photographed variants: the finish their maps were read under. */
  finish?: Finish;
  variants: Variant[];
}

export interface ThemeIndex {
  theme: string;
  entries: Record<string, MaterialEntry>;
}

/** One screen variant: what the advertisement shows and which display it is shown on. */
export interface Screen {
  kind: 'led-dot' | 'scanline-billboard' | 'glyph-panel';
  description: string;
  brandName?: string;
  businessKind?: string;
  pitch?: number;
}

export type PatternKind = 'hexagon' | 'panel-grid' | 'slab' | 'stripe' | 'two-tone' | 'noise' | 'glyph-atlas';

/** A surface stated as parameters instead of photographed: what the pattern class draws. */
export interface PatternSpec {
  kind: PatternKind;
  /** Face color first; a second and third are the band and trim colors of the kinds that take them. */
  colors: string[];
  cells?: [number, number];
  /** Joint or edge line width, in metres. */
  line?: number;
  /** Chamfer width beside a joint, in metres. */
  bevel?: number;
  depth?: number;
  joint?: number;
  variation?: number;
  sheen?: number;
  grain?: number;
  octaves?: number;
  bond?: 'stack' | 'running';
  axis?: 'x' | 'y';
  split?: number;
}

/** A tint variant: another variant of the same entry, repainted. */
export interface Recolor {
  from: string;
  /** The paint: its hue is taken whole. */
  color: string;
  strength?: number;
  value?: number;
}

export interface CreateRequest {
  key: string;
  aliases?: string[];
  alignment: 'tile' | 'exact';
  description: string;
  brandName?: string;
  businessKind?: string;
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  physical?: Physical;
  finish?: FinishSpec;
  flatColor?: string;
  flatNoise?: number;
  pattern?: PatternSpec;
  recolor?: Recolor;
  emission?: 'none' | 'luminance' | 'color-mask' | 'image';
  screens?: Screen[];
  variants?: number;
  variantId?: string;
  append?: boolean;
  seed?: number;
  resolution?: [number, number];
  overwrite?: boolean;
}
