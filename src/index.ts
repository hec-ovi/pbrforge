import { fileURLToPath } from 'node:url';
import { Database } from './db/Database.js';
import { MaterialsError } from './db/errors.js';
import type { CreateRequest, MaterialEntry, RebrandRequest } from './db/types.js';
import { Generator } from './gen/Generator.js';
import type { ComfyRuntime } from './gen/ComfyClient.js';
import { Refinisher, type RefinishRequest, type RefinishResult } from './gen/Refinish.js';
import { Rebrander, type Branded } from './gen/rebrand/Rebrander.js';

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

const bundledThemesDir = fileURLToPath(new URL('../themes', import.meta.url));

function database(options: MaterialsOptions): Database {
  return new Database(options.themesDir ?? bundledThemesDir);
}

export function resolve(key: string, options: MaterialsOptions = {}): MaterialEntry {
  return database(options).resolve(key);
}

export function list(filter: MaterialFilter = {}, options: MaterialsOptions = {}): string[] {
  return database(options).list(filter);
}

export function create(request: CreateRequest, options: MaterialsOptions = {}): Promise<MaterialEntry> {
  return new Generator(database(options), options.comfy).create(request);
}

export function refinish(request: RefinishRequest, options: MaterialsOptions = {}): Promise<RefinishResult> {
  return new Refinisher(database(options)).refinish(request);
}

export function rebrand(request: RebrandRequest, options: MaterialsOptions = {}): Promise<Branded[]> {
  return new Rebrander(database(options)).rebrand(request);
}

export { MaterialsError };
export type { MaterialsErrorCode } from './db/errors.js';
export type {
  Business,
  BusinessKind,
  CreateRequest,
  DecalPlacement,
  Display,
  Finish,
  FinishSpec,
  MapName,
  MaterialEntry,
  PatternKind,
  PatternSpec,
  Physical,
  RebrandRequest,
  Recolor,
  Screen,
  ScreenShown,
  SurfaceLayout,
  ThemeIndex,
  Tier,
  Variant,
} from './db/types.js';
export { ComfyClient } from './gen/ComfyClient.js';
export type { ComfyGraph, ComfyRuntime } from './gen/ComfyClient.js';
export type { RefinishRequest, RefinishResult } from './gen/Refinish.js';
export type { Branded } from './gen/rebrand/Rebrander.js';
