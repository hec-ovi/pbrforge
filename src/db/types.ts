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

export interface Variant {
  id: string;
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
  variants: Variant[];
}

export interface ThemeIndex {
  theme: string;
  entries: Record<string, MaterialEntry>;
}

export interface CreateRequest {
  key: string;
  aliases?: string[];
  alignment: 'tile' | 'exact';
  description: string;
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  physical?: Physical;
  flatColor?: string;
  flatNoise?: number;
  emission?: 'none' | 'luminance' | 'color-mask';
  variants?: number;
  seed?: number;
  resolution?: [number, number];
  overwrite?: boolean;
}
