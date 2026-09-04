export type MapName = 'basecolor' | 'normal' | 'roughness' | 'metallic' | 'height' | 'ao' | 'opacity' | 'emission';

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

/** The pixel structure a screen is shown through. */
export interface Display {
  kind: 'led-dot' | 'scanline-billboard' | 'glyph-panel';
  pitch?: number;
}

/** What a screen variant shows: the display it is shown on and the brandless picture behind it, so a rebrand re-composites text only. */
export interface ScreenShown extends Display {
  artwork: string;
}

/** World-space placement metadata for a visible surface division. */
export interface SurfaceLayout {
  family: 'continuous' | 'panel' | 'band' | 'lane';
  /** Visible module width and height in metres. Omitted for a continuous field. */
  moduleSize?: [number, number];
  /** Visible joint width in metres. Zero means no authored joint. */
  jointWidth?: number;
  /** Stable world-space grid origin in metres. */
  origin: [number, number];
  orientation: 'horizontal' | 'vertical' | 'isotropic';
  /** Height of a continuous architectural band in metres. */
  bandHeight?: number;
}

/** Exact surface placement rules for a transparent incident decal. */
export interface DecalPlacement {
  /** Width and height of the fitted receiver quad in world metres. */
  worldSize: [number, number];
  /** Fully transparent border kept inside every edge, in metres. */
  edgeInset: number;
  /** Separation from the receiving face, in metres, to prevent z-fighting. */
  surfaceOffset: number;
  /** Exact decals clamp their UVs and never repeat beyond the receiver. */
  wrapMode: 'clamp';
  /** The texture is fitted to one selected surface instead of volume-projected through geometry. */
  projection: 'surface-fit';
}

export interface Variant {
  id: string;
  /** How the maps were made. Consumers read the maps the same way either way. */
  class?: 'image' | 'pattern' | 'flat' | 'plate';
  resolution: [number, number];
  maps: Partial<Record<MapName, string>> & { basecolor: string; normal: string; roughness: string; metallic: string };
  /** Present on a screen variant painted by the create lane; a brand variant derives from one of these. */
  screen?: ScreenShown;
  /** How visible divisions align in world space. Fine material grain is not a division. */
  layout?: SurfaceLayout;
}

export interface MaterialEntry {
  key: string;
  aliases?: string[];
  alignment: 'tile' | 'exact';
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  decal?: DecalPlacement;
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
export interface Screen extends Display {
  description: string;
  /** A provided source image used as the artwork, instead of diffusing one. */
  imagePath?: string;
  brandName?: string;
  businessKind?: string;
}

export type PatternKind =
  | 'concrete'
  | 'hexagon'
  | 'panel-grid'
  | 'slab'
  | 'stripe'
  | 'two-tone'
  | 'noise'
  | 'lane'
  | 'puddle'
  | 'lamp'
  | 'glyph-atlas'
  | 'grille'
  | 'water'
  | 'incident-blood'
  | 'incident-tyre';

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
  wet?: number;
  wear?: number;
  /** Water only: strength of crossing wave directions, 0 for long parallel ripples and 1 for chop. */
  chop?: number;
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
  decal?: DecalPlacement;
  physical?: Physical;
  finish?: FinishSpec;
  flatColor?: string;
  /** Exact baked image with flat physical maps and matching basecolor and emission. */
  sourceImage?: { path: string };
  flatNoise?: number;
  pattern?: PatternSpec;
  /** Published world-space placement metadata for this variant. */
  layout?: SurfaceLayout;
  recolor?: Recolor;
  emission?: 'none' | 'luminance' | 'color-mask' | 'image';
  screens?: Screen[];
  variants?: number;
  variantId?: string;
  append?: boolean;
  /** On append, the variant becomes variant 0, the canonical one. */
  canonical?: boolean;
  seed?: number;
  resolution?: [number, number];
  overwrite?: boolean;
}

/** The parcel types that advertise: what a business is, for the rebrand lane. */
export type BusinessKind = 'hotel' | 'commerce' | 'mall' | 'restaurant' | 'coffee_shop' | 'corpo' | 'clinic';

export type Tier = 'poor' | 'mid' | 'rich' | 'high_rich';

/** One establishment of the named world, to be advertised on its own screens. */
export interface Business {
  brandName: string;
  businessKind: BusinessKind;
  tier: Tier;
}

export interface RebrandRequest {
  theme: string;
  businesses: Business[];
}
