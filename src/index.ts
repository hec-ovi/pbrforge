import { fileURLToPath } from 'node:url';
import type {
  Branded,
  ComfyRuntime,
  MaterialFilter,
  MaterialsOptions,
  RefinishRequest,
  RefinishResult,
} from './api-types.js';
import { Database } from './db/Database.js';
import { MaterialsError } from './db/errors.js';
import type { CreateRequest, MaterialEntry, RebrandRequest } from './db/types.js';
import { Generator } from './gen/Generator.js';
import { Refinisher } from './gen/Refinish.js';
import { Rebrander } from './gen/rebrand/Rebrander.js';

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
export type {
  Branded,
  ComfyGraph,
  ComfyRuntime,
  MaterialFilter,
  MaterialsOptions,
  RefinishRequest,
  RefinishResult,
} from './api-types.js';
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
