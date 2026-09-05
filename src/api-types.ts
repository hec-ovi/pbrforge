import type { FinishSpec, MaterialEntry, Physical } from './db/types.js';

export type ComfyGraph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/** Generation backend accepted by MaterialsOptions. */
export interface ComfyRuntime {
  ready(): Promise<boolean>;
  upload(image: Buffer, name: string): Promise<string>;
  render(graph: ComfyGraph): Promise<Buffer>;
}

export interface MaterialFilter {
  theme?: string;
  kind?: string;
  tier?: string;
}

export interface MaterialsOptions {
  /** Theme database root. Defaults to the themes folder shipped beside this package. */
  themesDir?: string;
  /** Generation backend. Omit to use COMFY_URL or the local ComfyUI default. */
  comfy?: ComfyRuntime;
}

/** What to re-read, under which finish, and the factors the entry is to carry. */
export interface RefinishRequest {
  key: string;
  finish?: FinishSpec;
  /** Merged into the entry's physical before the maps are read. */
  physical?: Physical;
}

export interface RefinishResult {
  entry: MaterialEntry;
  variants: string[];
}

/** Adds or refreshes the packed metallic-roughness map for an existing entry. */
export interface PackRequest {
  key: string;
}

export interface PackResult {
  entry: MaterialEntry;
  /** Variants whose packed reference or pixels were written; empty on an unchanged repeat. */
  variants: string[];
}

/** One screen variant written by the rebrand lane. */
export interface Branded {
  key: string;
  variantId: string;
  /** The screen variant whose artwork the brand landed on. */
  from: string;
  lines: number;
}
